/**
 * @kernel/shared-kernel — kernel error hierarchy.
 *
 * All deterministic-core failures are values of these types (carried inside
 * `Result<_, KernelError>`). They never need to be thrown across module
 * boundaries, but they ARE throwable for use at the edge (interfaces layer).
 */

export abstract class KernelError extends Error {
  abstract readonly code: string;
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

/** Optimistic-concurrency violation on event-stream append. */
export class ConcurrencyConflictError extends KernelError {
  readonly code = "CONCURRENCY_CONFLICT";
  constructor(
    readonly streamId: string,
    readonly expectedVersion: number,
    readonly actualVersion: number
  ) {
    super(
      `Concurrency conflict on stream '${streamId}': expected version ${expectedVersion}, actual ${actualVersion}`
    );
  }
}

/** A command/handler rejected input as invalid. */
export class ValidationError extends KernelError {
  readonly code = "VALIDATION";
  constructor(
    message: string,
    readonly details?: ReadonlyArray<{ field: string; reason: string }>
  ) {
    super(message);
  }
}

/** Aggregate or entity not found. */
export class NotFoundError extends KernelError {
  readonly code = "NOT_FOUND";
  constructor(readonly aggregateType: string, readonly id: string) {
    super(`${aggregateType} '${id}' not found`);
  }
}

/** Principal lacks permission for the operation. */
export class UnauthorizedError extends KernelError {
  readonly code = "UNAUTHORIZED";
  constructor(message: string) {
    super(message);
  }
}

/** A determinism invariant was violated (e.g. Date.now() leaked into domain). */
export class DeterminismViolationError extends KernelError {
  readonly code = "DETERMINISM_VIOLATION";
  constructor(message: string) {
    super(message);
  }
}

/** An operation was attempted in a state that does not allow it. */
export class IllegalStateError extends KernelError {
  readonly code = "ILLEGAL_STATE";
  constructor(message: string) {
    super(message);
  }
}

/** A configured limit/policy prevented the operation. */
export class LimitExceededError extends KernelError {
  readonly code = "LIMIT_EXCEEDED";
  constructor(message: string) {
    super(message);
  }
}
