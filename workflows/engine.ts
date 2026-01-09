import { Effect, Console, Schedule } from "effect";
import * as S from "@effect/schema/Schema";
import { MySQLService } from "../infrastructure/repository";
import { WorkflowTask, TaskPayload } from "../domain/schemas";
import { runAgendamentoCompraCDB } from "./agendamento";

export const processTask = (task: WorkflowTask) =>
    Effect.gen(function* (_) {
        const mysql = yield* _(MySQLService);

        yield* _(Console.log(`[Engine] Processing task ${task.id} (Type: ${task.type})`));

        // Update status to PROCESSING
        yield* _(mysql.query(
            "UPDATE workflow_tasks SET status = 'PROCESSING' WHERE id = ?",
            [task.id]
        ));

        // Execute workflow based on type
        let resultEffect: Effect.Effect<any, any, any>;
        if (task.type === "AgendamentoCompraCDB") {
            // Decode payload
            const payload = yield* _(S.decodeUnknown(TaskPayload)(task.payload));
            resultEffect = runAgendamentoCompraCDB(payload as any);
        } else {
            return yield* _(Effect.fail(new Error(`Unknown task type: ${task.type}`)));
        }

        // Run workflow and handle results
        yield* _(
            resultEffect.pipe(
                Effect.tap(() =>
                    mysql.query(
                        "UPDATE workflow_tasks SET status = 'COMPLETED' WHERE id = ?",
                        [task.id]
                    )
                ),
                Effect.catchAll((error) =>
                    mysql.query(
                        "UPDATE workflow_tasks SET status = 'FAILED', last_error = ?, retry_count = retry_count + 1 WHERE id = ?",
                        [(error as Error).stack || (error as Error).message, task.id]
                    )
                )
            )
        );
    });

export const pollAndLockTask = () =>
    Effect.gen(function* (_) {
        const mysql = yield* _(MySQLService);

        return yield* _(
            mysql.withTransaction((conn) =>
                Effect.gen(function* (_) {
                    const [rows]: any = yield* _(Effect.promise(() =>
                        conn.query(
                            "SELECT * FROM workflow_tasks WHERE status = 'PENDING' OR (status = 'FAILED' AND retry_count < 5) ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED"
                        )
                    ));

                    const taskRaw = rows[0];
                    if (!taskRaw) return null;

                    // Parse to Schema
                    return yield* _(S.decodeUnknown(WorkflowTask)(taskRaw));
                })
            )
        );
    });

export const engineLoop = () =>
    Effect.gen(function* (_) {
        yield* _(Console.log("[Engine] Starting polling loop..."));

        yield* _(
            Effect.repeat(
                Effect.gen(function* (_) {
                    const task = yield* _(pollAndLockTask());
                    if (task) {
                        yield* _(processTask(task));
                    } else {
                        // No tasks, wait a bit
                        yield* _(Effect.sleep("1 seconds"));
                    }
                }),
                Schedule.forever
            )
        );
    });
