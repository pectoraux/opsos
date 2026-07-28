/**
 * @kernel/compiler/domain/compiler-pipeline — the CompilerPipeline PORT + the
 * result type.
 *
 * `compile(intent, ctx)` runs the registered stages in deterministic
 * `(phase, order, name)` order, threading `ctx` through each. On the first
 * error (typically `AbortCompilationError`), it stops and returns a failed
 * `CompilerResult`. On success it returns the final `ExecutionGraph`.
 *
 * `registerStage` / `unregisterStage` are the extension points protocols use
 * (via the extension system in a later milestone). They are NOT part of the
 * deterministic core's per-command path — stage registration happens at boot /
 * protocol-install time, OUTSIDE `RuntimeExecutor` (mirrors ADR-0006).
 */

import type { ExecutionPlan } from "@kernel/shared-kernel";
import type { ExecutionGraph } from "@kernel/runtime";
import type { CompilerStage, CompilerPhase } from "./compiler-stage";
import type { CompilerDiagnostic } from "./diagnostic";
import type { CompilationContext } from "./compilation-context";

export interface CompilerOptions {
  /** If true, an `error`-severity diagnostic aborts compilation. Default: false. */
  readonly failOnErrorDiagnostic?: boolean;
}

export interface StageTrace {
  readonly name: string;
  readonly phase: CompilerPhase;
  readonly order: number;
  readonly ran: boolean;
  readonly durationMs?: number;
  readonly error?: string;
}

export interface CompilerResult {
  readonly ok: boolean;
  readonly graph?: ExecutionGraph;
  readonly plan?: ExecutionPlan;
  readonly diagnostics: readonly CompilerDiagnostic[];
  readonly stages: readonly StageTrace[];
  /** Present when compilation was aborted (e.g. policy `deny`). */
  readonly aborted?: { readonly reason: string; readonly decision?: import("@kernel/shared-kernel").Decision };
}

export interface CompilerPipeline {
  compile(
    intent: import("@kernel/shared-kernel").Intent,
    ctx: CompilationContext,
    options?: CompilerOptions
  ): Promise<CompilerResult>;
  registerStage(stage: CompilerStage): void;
  unregisterStage(name: string): void;
  listStages(): readonly CompilerStage[];
}
