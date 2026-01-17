import { Effect, Console } from "effect";
import { MySQLServiceLive, MySQLService } from "../infrastructure/repository";
import { v4 as uuidv4 } from "uuid";

const createTasks = Effect.gen(function* (_) {
    const db = yield* _(MySQLService);

    yield* _(Console.log("[Script] Creating 10 random tasks..."));

    for (let i = 0; i < 10; i++) {
        const id = uuidv4();
        const payload = {
            userId: `USER-${Math.floor(Math.random() * 1000)}`,
            amount: Math.floor(Math.random() * 50000) + 1000,
            cdbId: `CDB-${i}`
        };

        yield* _(db.createTask({
            id,
            idempotencyKey: `KEY-${id}`,
            type: 'AgendamentoCompraCDB',
            payload
        }));

        yield* _(Console.log(`[Script] Created task ${id}`));
    }

    yield* _(Console.log("[Script] Done."));
});

const program = createTasks.pipe(
    Effect.provide(MySQLServiceLive)
);

Effect.runPromise(program).catch(console.error);
