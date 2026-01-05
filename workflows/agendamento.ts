import { Effect, Schedule } from "effect";
import { CDBPayload } from "../domain/schemas";
import * as Activities from "../services/activities";

export const runAgendamentoCompraCDB = (payload: typeof CDBPayload.Type) =>
    Effect.gen(function* (_) {
        // 1. Validate Market Time
        yield* _(Activities.validateMarketTime(payload.userId));

        // 2. Reserve Balance (with compensation)
        const reservationId = yield* _(Activities.reserveBalance(payload.userId, payload.amount));

        // Define compensation for balance reservation
        const compensation = Activities.compensateBalance(payload.userId, payload.amount, reservationId);

        // 3. Execute Order (Retry logic for network issues)
        const orderResult = yield* _(
            Activities.executeOrder(payload.cdbId, payload.amount).pipe(
                Effect.retry(
                    Schedule.exponential("100 millis").pipe(
                        Schedule.andThen(Schedule.recurs(5))
                    )
                ),
                // Saga Pattern: If order fails after retries, compensate the balance
                Effect.onInterrupt(() => compensation),
                Effect.catchAll((error) =>
                    compensation.pipe(Effect.flatMap(() => Effect.fail(error)))
                )
            )
        );

        return orderResult;
    });
