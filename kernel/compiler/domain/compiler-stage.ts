/**
 * @kernel/compiler/domain/compiler-stage — the CompilerStage contract.
 *
 * A stage is a replaceable unit of the compiler pipeline. It reads a
 * `CompilationContext` and returns a new one (via `ctx.with(...)`) or an
 * error. Stages are ordered by `(phase, order, name)` for deterministic
 * execution; ties are impossible because `(name)` is unique within a pipeline.
 *
 * Per ADR-0011 each stage is replaceable; protocols register additional stages
 * via the extension system; the kernel orchestrates ordering.
 */

import type { Result, KernelError } from "@kernel/shared-kernel";
import type { CompilationContext } from "./compilation-context";

/** The pipeline phase a stage belongs to. Determines ordering. */
export type CompilerPhase =
  | "normalize"
  | "validate"
  | "evaluate"
  | "resolve"
  | "plan"
  | "optimize"
  | "schedule"
  | "route"
  | "finalize";

/** Canonical phase ordering (lower index = earlier). */
export const PHASE_ORDER: readonly CompilerPhase[] = [
  "normalize",
  "validate",
  "evaluate",
  "resolve",
  "plan",
  "optimize",
  "schedule",
  "route",
  "finalize",
];

export function phaseRank(phase: CompilerPhase): number {
  const i = PHASE_ORDER.indexOf(phase);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * A single compiler stage.
 *
 * `run` MUST be deterministic w.r.t. `(ctx.intent, ctx.clock, ctx.random,
 * ctx.registry)`. It MUST NOT call `Date.now()` / `Math.random()` — all time
 * via `ctx.clock.now()`, all randomness via `ctx.random`. It MUST NOT perform
 * I/O except reading the injected `ExtensionRegistry`.
 */
export interface CompilerStage {
  /** Unique stage name within a pipeline (e.g. `"kernel.normalizer"`). */
  readonly name: string;
  readonly phase: CompilerPhase;
  /** Ordering within a phase (lower runs earlier). */
  readonly order: number;
  /**
   * Run the stage. Returns a new context (success) or a `KernelError` (which
   * aborts the pipeline). `AbortCompilationError` carries a reason + optional
   * policy `Decision`.
   */
  run(
    ctx: CompilationContext
  ): Result<CompilationContext, KernelError> | Promise<Result<CompilationContext, KernelError>>;
}
