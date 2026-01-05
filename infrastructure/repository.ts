import * as mysql from "mysql2/promise";
import { Effect, Context, Layer, Scope } from "effect";
import { DatabaseError } from "../domain/errors";

export interface MySQLService {
    readonly pool: mysql.Pool;
    readonly query: (sql: string, params?: any[]) => Effect.Effect<any, DatabaseError>;
    readonly withTransaction: <A, E, R>(
        f: (connection: mysql.PoolConnection) => Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | DatabaseError, R>;
}

export const MySQLService = Context.GenericTag<MySQLService>("MySQLService");

export const MySQLServiceLive = Layer.scoped(
    MySQLService,
    Effect.gen(function* (_) {
        const config: mysql.PoolOptions = {
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "root",
            password: process.env.DB_PASSWORD || "root",
            database: process.env.DB_NAME || "scheduler",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        };

        const pool = yield* _(
            Effect.acquireRelease(
                Effect.sync(() => mysql.createPool(config)),
                (pool) => Effect.promise(() => pool.end())
            )
        );

        const query = (sql: string, params?: any[]) =>
            Effect.tryPromise({
                try: () => pool.query(sql, params),
                catch: (error) => new DatabaseError({
                    message: `Query failing: ${sql}`,
                    stack: (error as Error).stack
                }),
            }).pipe(Effect.map(([rows]) => rows));

        const withTransaction = <A, E, R>(
            f: (connection: mysql.PoolConnection) => Effect.Effect<A, E, R>
        ) =>
            Effect.scoped(
                Effect.gen(function* (_) {
                    const connection = yield* _(
                        Effect.acquireRelease(
                            Effect.promise(() => pool.getConnection()),
                            (conn) => Effect.promise(() => conn.release())
                        )
                    );

                    yield* _(Effect.promise(() => connection.beginTransaction()));

                    return yield* _(
                        f(connection).pipe(
                            Effect.tap(() => Effect.promise(() => connection.commit())),
                            Effect.catchAll((error) =>
                                Effect.promise(() => connection.rollback()).pipe(Effect.flatMap(() => Effect.fail(error)))
                            )
                        )
                    );
                })
            );

        return { pool, query, withTransaction };
    })
);
