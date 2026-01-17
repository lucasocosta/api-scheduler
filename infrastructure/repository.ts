import * as mysql from "mysql2/promise";
import { Effect, Context, Layer, Console, Scope } from "effect";
import { DatabaseError } from "../domain/errors";

export interface MySQLService {
    readonly pool: mysql.Pool;
    readonly query: (sql: string, params?: any[]) => Effect.Effect<any, DatabaseError>;
    readonly withTransaction: <A, E, R>(
        f: (connection: mysql.PoolConnection) => Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | DatabaseError, R>;
    readonly createTask: (task: { id: string; idempotencyKey: string; type: string; payload: any }) => Effect.Effect<void, DatabaseError>;
    readonly updateTaskStatus: (id: string, status: string, lastError?: string) => Effect.Effect<void, DatabaseError>;
    readonly updateCompensationStatus: (id: string, status: string) => Effect.Effect<void, DatabaseError>;
    readonly findNextPendingTask: () => Effect.Effect<{ id: string; payload: any } | null, DatabaseError>;
    readonly failTask: (id: string, error: string, isFatal?: boolean) => Effect.Effect<void, DatabaseError>;
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
        yield* _(Console.log(`[Repository] DB Config: Host=${config.host}, User=${config.user}, DB=${config.database}`));

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
        ): Effect.Effect<A, E | DatabaseError, R> =>
            Effect.scoped(
                Effect.gen(function* (_) {
                    const connection = yield* _(
                        Effect.acquireRelease(
                            Effect.promise(() => pool.getConnection()),
                            (conn: mysql.PoolConnection) => {
                                return Effect.sync(() => conn.release());
                            }
                        )
                    );

                    yield* _(Effect.promise(() => connection.beginTransaction()));

                    const result = yield* _(
                        f(connection).pipe(
                            Effect.tap(() => Effect.promise(() => connection.commit())),
                            Effect.catchAll((error) =>
                                Effect.promise(() => connection.rollback()).pipe(
                                    Effect.flatMap(() => Effect.fail(error))
                                )
                            )
                        )
                    );

                    return result;
                })
            );

        const createTask = (task: { id: string; idempotencyKey: string; type: string; payload: any }) =>
            query(
                `INSERT INTO workflow_tasks (id, idempotency_key, type, payload) VALUES (?, ?, ?, ?)`,
                [task.id, task.idempotencyKey, task.type, JSON.stringify(task.payload)]
            ).pipe(Effect.asVoid);

        const updateTaskStatus = (id: string, status: string, lastError?: string) =>
            query(
                `UPDATE workflow_tasks SET status = ?, last_error = ? WHERE id = ?`,
                [status, lastError || null, id]
            ).pipe(Effect.asVoid);

        const updateCompensationStatus = (id: string, status: string) =>
            query(
                `UPDATE workflow_tasks SET compensation_status = ? WHERE id = ?`,
                [status, id]
            ).pipe(Effect.asVoid);

        const findNextPendingTask = () =>
            query(
                `SELECT id, payload FROM workflow_tasks WHERE status = 'PENDING' LIMIT 1`
            ).pipe(
                Effect.map((result) => {
                    const rows = result as any[];
                    if (rows.length === 0) return null;
                    return { id: rows[0].id, payload: rows[0].payload };
                })
            );

        const failTask = (id: string, error: string, isFatal: boolean = false) =>
            query(
                `UPDATE workflow_tasks SET status = 'FAILED', last_error = ?, retry_count = IF(?, 99, retry_count + 1) WHERE id = ?`,
                [error, isFatal, id]
            ).pipe(Effect.asVoid);

        return { pool, query, withTransaction, createTask, updateTaskStatus, updateCompensationStatus, findNextPendingTask, failTask };
    })
);
