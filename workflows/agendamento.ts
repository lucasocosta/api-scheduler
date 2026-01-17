import { Effect, Schedule, Console } from "effect";
import { CDBPayload } from "../domain/schemas";
import * as Activities from "../services/activities";
import { MySQLService } from "../infrastructure/repository";

export const runAgendamentoCompraCDB = (payload: typeof CDBPayload.Type, taskId?: string) =>
    Effect.gen(function* (_) {
        const db = yield* _(MySQLService);

        if (!taskId) {
            return yield* _(Effect.dieMessage("TaskId is required for persistence."));
        }

        const currentTaskId = taskId;

        yield* _(db.updateTaskStatus(currentTaskId, "PROCESSING"));
        yield* _(Console.log(`[Workflow] Starting CDB Purchase for ${payload.userId} (Task: ${currentTaskId})`));

        const compensations: Effect.Effect<void>[] = [];

        const addCompensation = (comp: Effect.Effect<void>) => {
            compensations.push(comp);
        };

        const runCompensations = Effect.gen(function* (_) {
            if (compensations.length === 0) return;
            yield* _(Console.log(`[Workflow] ⚠️ Workflow failed. Executing compensations...`));

            yield* _(db.updateCompensationStatus(currentTaskId, "COMPENSATING"));

            // Run in reverse order (LIFO)
            const reversed = [...compensations].reverse();
            for (const comp of reversed) {
                yield* _(comp);
            }
            yield* _(Console.log(`[Workflow] Compensations completed.`));
            yield* _(db.updateCompensationStatus(currentTaskId, "COMPENSATED"));
        });

        const retryPolicy = Schedule.exponential("100 millis").pipe(
            Schedule.intersect(Schedule.recurs(3))
        );

        // Helper to apply selective retry
        const withRetry = <A, E>(effect: Effect.Effect<A, E>) =>
            effect.pipe(
                Effect.retry({
                    schedule: retryPolicy,
                    while: (error: any) => {
                        // Retry ONLY if it's explicitly marked as retryable
                        if (error && typeof error === 'object' && 'retryable' in error) {
                            return error.retryable === true;
                        }
                        // If it's another type of error (e.g. business rule), do NOT retry
                        return false;
                    }
                })
            );

        // Main Workflow Logic
        const workflowLogic = Effect.gen(function* (_) {
            // 1. Validate Market Time
            yield* _(Activities.validateMarketTime(payload.userId));

            // 2. Schedule Debit
            const scheduleId = yield* _(
                withRetry(Activities.scheduleDebit(payload.userId, payload.amount))
            );
            addCompensation(Activities.cancelScheduleDebit(scheduleId));

            // 3. Confirm Debit (Async/SQS)
            const confirmationId = yield* _(
                withRetry(Activities.confirmDebit(scheduleId))
            );
            addCompensation(Activities.cancelDebitConfirmation(confirmationId));

            // 4. Execute Transfer (Async/SQS)
            const transferId = yield* _(
                withRetry(Activities.executeTransfer(confirmationId))
            );
            addCompensation(Activities.reverseTransfer(transferId));

            // 5. Emit CDB
            const cdbId = yield* _(
                withRetry(Activities.emitCdb(transferId, payload.amount))
            );

            yield* _(Console.log(`[Workflow] ✅ CDB Purchase Complete! ID: ${cdbId}`));
            yield* _(db.updateTaskStatus(currentTaskId, "COMPLETED"));
            return cdbId;
        });

        // Execute logic and catch ANY error (Failure)
        return yield* _(
            workflowLogic.pipe(
                Effect.catchAll((error) => Effect.gen(function* (_) {
                    yield* _(Console.error(`[Workflow] ❌ Workflow Failed. Error: ${JSON.stringify(error)}`));

                    // Persist FAILED status
                    yield* _(db.updateTaskStatus(currentTaskId, "FAILED", JSON.stringify(error)));

                    // Run compensations
                    yield* _(runCompensations);

                    // Re-fail so the caller knows it failed
                    return yield* _(Effect.fail(error));
                }))
            )
        );
    });
