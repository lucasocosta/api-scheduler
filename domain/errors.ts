import { Data } from "effect";

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly stack?: string;
}> { }

export class ExternalApiError extends Data.TaggedError("ExternalApiError")<{
  readonly message: string;
  readonly service: string;
  readonly retryable: boolean; // false = Non-retryable (Immediate failure)
  readonly stack?: string;
}> { }

export class BusinessRuleError extends Data.TaggedError("BusinessRuleError")<{
  readonly message: string;
}> { }
