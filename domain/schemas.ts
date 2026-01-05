import * as S from "@effect/schema/Schema";

export const TaskStatus = S.Literal("PENDING", "PROCESSING", "COMPLETED", "FAILED");
export type TaskStatus = S.Schema.Type<typeof TaskStatus>;

export const CDBPayload = S.Struct({
    userId: S.String,
    amount: S.Number,
    cdbId: S.String,
});

export const TaskPayload = S.Union(CDBPayload);

export const WorkflowTask = S.Struct({
    id: S.String,
    idempotency_key: S.String,
    type: S.String,
    payload: S.encodedSchema(TaskPayload), // Payloads are stored as JSON in MySQL
    status: TaskStatus,
    last_error: S.optional(S.NullOr(S.String)),
    retry_count: S.Number,
});

export type WorkflowTask = S.Schema.Type<typeof WorkflowTask>;
