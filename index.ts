import { Effect, Layer } from "effect";
import { engineLoop } from "./workflows/engine";
import { MySQLServiceLive } from "./infrastructure/repository";

const program = engineLoop().pipe(
    Effect.provide(MySQLServiceLive)
);

// Effect.runMain handles SIGTERM, SIGINT and ensures Scope cleanup
// (closing the MySQL connection pool in our case)
Effect.runMain(program);
