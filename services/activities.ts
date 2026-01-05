import { Effect, Console } from "effect";
import { ExternalApiError, BusinessRuleError } from "../domain/errors";

export const validateMarketTime = (userId: string) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Activity] Starting validateMarketTime for user ${userId}`));

        // Simulating validation logic
        const hour = new Date().getHours();
        if (hour < 9 || hour > 18) {
            yield* _(Console.error(`[Activity] Validation failed: Market closed`));
            return yield* _(Effect.fail(new BusinessRuleError({ message: "Market is closed" })));
        }

        yield* _(Console.log(`[Activity] validateMarketTime finished successfully`));
        return true;
    });

export const reserveBalance = (userId: string, amount: number) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Activity] Starting reserveBalance for user ${userId}: $${amount}`));

        // Simulate external API call
        if (amount > 10000) {
            yield* _(Console.error(`[Activity] reserveBalance failed: Insufficient funds`));
            return yield* _(Effect.fail(new ExternalApiError({
                message: "Insufficient funds in Core Banking",
                service: "CoreBanking"
            })));
        }

        yield* _(Console.log(`[Activity] reserveBalance finished successfully`));
        return "RES-12345";
    });

export const executeOrder = (cdbId: string, amount: number) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Activity] Starting executeOrder for ${cdbId}: $${amount}`));

        // Simulate brokerage API call
        if (Math.random() > 0.8) {
            yield* _(Console.error(`[Activity] executeOrder failed: Brokerage Timeout`));
            return yield* _(Effect.fail(new ExternalApiError({
                message: "Brokerage timeout",
                service: "Brokerage"
            })));
        }

        yield* _(Console.log(`[Activity] executeOrder finished successfully`));
        return "ORD-67890";
    });

export const compensateBalance = (userId: string, amount: number, reservationId: string) =>
    Effect.gen(function* (_) {
        yield* _(Console.log(`[Activity] Compensating balance for user ${userId}: Releasing reservation ${reservationId}`));
        // Logic to release balance...
        yield* _(Console.log(`[Activity] Compensation finished`));
    });
