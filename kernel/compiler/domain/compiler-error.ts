/**
 * @kernel/compiler/domain/compiler-error — compiler-specific errors.
 *
 * `AbortCompilationError`: a stage deliberately aborted compilation (e.g. the
 * policy evaluator got a `deny`). Carries a reason and an optional policy
 * `Decision` so the caller can surface why compilation stopped.
 *
 * `StageFailedError`: a stage failed unexpectedly. Carries the stage name and
 * the underlying message.
 *
 * Both are `KernelError` subclasses so they flow through `Result<T, KernelError>`.
 */

import { KernelError } from "@kernel/shared-kernel";
import type { Decision } from "@kernel/shared-kernel";

export class AbortCompilationError extends KernelError {
  readonly code = "COMPILATION_ABORTED";
  constructor(
    readonly reason: string,
    readonly decision?: Decision
  ) {
    super(`Compilation aborted: ${reason}`);
  }
}

export class StageFailedError extends KernelError {
  readonly code = "STAGE_FAILED";
  constructor(
    readonly stageName: string,
    message: string
  ) {
    super(`Stage '${stageName}' failed: ${message}`);
  }
}
