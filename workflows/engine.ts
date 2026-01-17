import { Effect, Console, Schedule } from "effect";
import * as S from "@effect/schema/Schema";
import { MySQLService } from "../infrastructure/repository";
import { WorkflowTask, TaskPayload } from "../domain/schemas";
import { runAgendamentoCompraCDB } from "./agendamento";

export const processTask = (task: WorkflowTask) =>
    Effect.gen(function* (_) {
        const mysql = yield* _(MySQLService);

        yield* _(Console.log(`[Engine] Processing task ${task.id} (Type: ${task.type})`));

        // Execute workflow based on type
        let resultEffect: Effect.Effect<any, any, any>;
        if (task.type === "AgendamentoCompraCDB") {
            // Decode payload
            const payload = yield* _(S.decodeUnknown(TaskPayload)(task.payload));
            // Pass task.id to the workflow so it can persist state
            resultEffect = runAgendamentoCompraCDB(payload as any, task.id);
        } else {
            return yield* _(Effect.fail(new Error(`Unknown task type: ${task.type}`)));
        }

        // Run workflow
        // The workflow itself now handles DB updates (PROCESSING -> COMPLETED/FAILED)
        // We catch any unexpected Defect here just in case.
        yield* _(
            resultEffect.pipe(
                Effect.catchAll((error) =>
                    // Logic in workflow already handles catching and updating DB for failures.
                    // But if it fails, we log here too.
                    Console.error(`[Engine] Workflow failed for ${task.id}:`, error)
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
                    const task = yield* _(pollAndLockTask().pipe(
                        Effect.catchAll(err => {
                            Console.error("[Engine] Error polling task:", err);
                            return Effect.succeed(null);
                        })
                    ));

                    if (task) {
                        yield* _(processTask(task).pipe(
                            Effect.catchAll(err => Console.error(`[Engine] Error processing task ${task.id}:`, err))
                        ));
                    } else {
                        // No tasks, wait a bit
                        yield* _(Effect.sleep("1 seconds"));
                    }
                }),
                Schedule.forever
            )
        );
    });
