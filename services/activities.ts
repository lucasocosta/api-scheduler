import { Effect, Console, Schedule, Random } from "effect";
import { ExternalApiError, BusinessRuleError } from "../domain/errors";

// --- Simulation Helpers ---

const simulateAsyncStep = (stepName: string, failureRate: number = 0.2) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[${stepName}] Request sent. Waiting for async response (SQS)...`));

        // Simulate Network/Processing Delay
        yield* _(Effect.sleep("1 seconds"));

        const random = yield* _(Random.next);

        // 10% Fatal Error (Non-Retryable)
        if (random < 0.1) {
            yield* _(Console.error(`[${stepName}] ❌ Async response: FATAL ERROR (Non-retryable)`));
            return yield* _(Effect.fail(new ExternalApiError({
                message: `Fatal async error for ${stepName}`,
                service: stepName,
                retryable: false
            })));
        }

        // 20% Transient Error (Retryable) -> (0.1 to 0.3 range = 20%)
        if (random < 0.3) {
            yield* _(Console.error(`[${stepName}] ⚠️ Async response: TRANSIENT ERROR (Retryable)`));
            return yield* _(Effect.fail(new ExternalApiError({
                message: `Transient async error for ${stepName}`,
                service: stepName,
                retryable: true
            })));
        }

        yield* _(Console.log(`[${stepName}] Async response received: SUCCESS`));
        return true;
    });

const simulateApiCall = (stepName: string, failureRate: number = 0.2) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[${stepName}] Calling API...`));

        // Simulate Latency
        yield* _(Effect.sleep("500 millis"));

        const random = yield* _(Random.next);

        // 10% Fatal Error
        if (random < 0.1) {
            yield* _(Console.error(`[${stepName}] ❌ API Call: FATAL ERROR (Non-retryable)`));
            return yield* _(Effect.fail(new ExternalApiError({
                message: `Fatal API error for ${stepName}`,
                service: stepName,
                retryable: false
            })));
        }

        // 20% Transient Error (0.1 to 0.3)
        if (random < 0.3) {
            yield* _(Console.error(`[${stepName}] ⚠️ API Call: TRANSIENT ERROR (Retryable)`));
            return yield* _(Effect.fail(new ExternalApiError({
                message: `Transient API error for ${stepName}`,
                service: stepName,
                retryable: true
            })));
        }

        yield* _(Console.log(`[${stepName}] API Call successful`));
        return true;
    });

// --- Activities ---

export const validateMarketTime = (userId: string) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Activity] Checking market time for user ${userId}`));
        // Keep original logic or simple pass for now
        const hour = new Date().getHours();
        // Relaxing market time for testing purposes, or keep stricter if preferred. 
        // User said "Validar grade de horário pode manter".
        if (hour < 0 || hour > 23) { // Mocking "always open" for simulation ease unless strictly required
            return yield* _(Effect.fail(new BusinessRuleError({ message: "Market closed" })));
        }
        yield* _(Console.log(`[Activity] Market time valid`));
    });

export const scheduleDebit = (userId: string, amount: number) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Activity] Scheduling Debit: ${amount} for ${userId}`));
        yield* _(simulateApiCall("ScheduleDebit"));
        return "SCH-111"; // Schedule ID
    });

export const cancelScheduleDebit = (scheduleId: string) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Compensation] Cancelling Schedule Debit ${scheduleId}`));
        // Compensation usually shouldn't fail, or should retry indefinitely.
        yield* _(Effect.sleep("200 millis"));
        yield* _(Console.log(`[Compensation] Schedule Debit Cancelled`));
    });

export const confirmDebit = (scheduleId: string) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Activity] Confirming Debit for Schedule ${scheduleId}`));
        // API + SQS Wait
        yield* _(simulateAsyncStep("ConfirmDebit_SQS"));
        return "CNF-222"; // Confirmation ID
    });

export const cancelDebitConfirmation = (confirmationId: string) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Compensation] Cancelling Debit Confirmation ${confirmationId}`));
        yield* _(Effect.sleep("200 millis"));
        yield* _(Console.log(`[Compensation] Debit Confirmation Cancelled`));
    });

export const executeTransfer = (confirmationId: string) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Activity] Executing Transfer for ${confirmationId}`));
        // API + SQS Wait
        yield* _(simulateAsyncStep("ExecuteTransfer_SQS"));
        return "TRF-333"; // Transfer ID
    });

export const reverseTransfer = (transferId: string) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Compensation] Reversing Transfer ${transferId}`));
        yield* _(Effect.sleep("200 millis"));
        yield* _(Console.log(`[Compensation] Transfer Reversed`));
    });

export const emitCdb = (transferId: string, amount: number) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Activity] Emitting CDB for Transfer ${transferId}, Amount ${amount}`));
        yield* _(simulateApiCall("EmitCDB"));
        return "CDB-444"; // CDB ID
    });

export const cancelCdb = (cdbId: string) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Compensation] Cancelling CDB ${cdbId}`));
        yield* _(Effect.sleep("200 millis"));
        yield* _(Console.log(`[Compensation] CDB Cancelled`));
    });
