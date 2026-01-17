import { Effect, Console } from "effect";
import { runAgendamentoCompraCDB } from "../workflows/agendamento";
import { MySQLServiceLive, MySQLService } from "../infrastructure/repository";
import { CDBPayload } from "../domain/schemas";

const simulate = async () => {
    const program = Effect.gen(function* (_) {
        const db = yield* _(MySQLService);

        yield* _(Console.log("--- Starting Simulation Worker ---"));

        // Try to get a pending task
        const task = yield* _(db.findNextPendingTask());

        if (!task) {
            yield* _(Console.log("⚠️ No PENDING tasks found."));
            yield* _(Console.log("👉 Run 'npm run create-tasks' to generate new tasks first."));
            return;
        }

        yield* _(Console.log(`[Worker] Found pending task: ${task.id}`));

        // Parse payload if it's a string (though mysql2 usually handles JSON)
        const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;

        yield* _(
            runAgendamentoCompraCDB(payload, task.id).pipe(
                Effect.catchAll(error => Console.error(`[Main] workflow failed with: ${JSON.stringify(error)}`))
            )
        );
    });

    // Log error to avoid unhandled rejection in promise
    await Effect.runPromise(program.pipe(Effect.provide(MySQLServiceLive))).catch(err => console.error("Runtime fail", err));
};

simulate();
