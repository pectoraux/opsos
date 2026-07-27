/**
 * @kernel/compiler/infrastructure/default-compiler-pipeline — reference
 * `CompilerPipeline`.
 *
 * Holds registered stages (kernel-provided defaults + any protocol-registered).
 * `compile()` sorts stages deterministically by `(phaseRank, order, name)` and
 * runs them sequentially, threading the `CompilationContext`. On the first
 * error it stops and returns a failed `CompilerResult` with the trace. On
 * success it returns the final `ExecutionGraph`.
 *
 * Determinism:
 *   - Stage ordering is `(phaseRank asc, order asc, name asc)` — independent of
 *     insertion order or map iteration order.
 *   - Stages receive `ctx.clock` / `ctx.random`; no `Date.now()` / `Math.random()`
 *     in this file.
 *   - `failOnErrorDiagnostic` (default false) aborts if any stage produced an
 *     `error`-severity diagnostic.
 */

import type { KernelError } from "@kernel/shared-kernel";
import type { Intent } from "@kernel/shared-kernel";
import type { CompilerStage } from "../domain/compiler-stage";
import { phaseRank } from "../domain/compiler-stage";
import type {
  CompilerPipeline,
  CompilerOptions,
  CompilerResult,
  StageTrace,
} from "../domain/compiler-pipeline";
import type { CompilationContext } from "../domain/compilation-context";
import { AbortCompilationError } from "../domain/compiler-error";

export interface DefaultCompilerPipelineDeps {
  /** The initial set of stages (typically `createDefaultStages(deps)`). */
  readonly stages: readonly CompilerStage[];
}

export class DefaultCompilerPipeline implements CompilerPipeline {
  private readonly stages: Map<string, CompilerStage> = new Map();

  constructor(deps: DefaultCompilerPipelineDeps) {
    for (const s of deps.stages) this.stages.set(s.name, s);
  }

  registerStage(stage: CompilerStage): void {
    this.stages.set(stage.name, stage);
  }

  unregisterStage(name: string): void {
    this.stages.delete(name);
  }

  listStages(): readonly CompilerStage[] {
    return this.ordered();
  }

  /** Deterministic stage ordering: `(phaseRank asc, order asc, name asc)`. */
  private ordered(): CompilerStage[] {
    return Array.from(this.stages.values()).sort((a, b) => {
      const pr = phaseRank(a.phase) - phaseRank(b.phase);
      if (pr !== 0) return pr;
      const or = a.order - b.order;
      if (or !== 0) return or;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }

  async compile(
    intent: Intent,
    ctx: CompilationContext,
    options: CompilerOptions = {}
  ): Promise<CompilerResult> {
    const stages = this.ordered();
    const trace: StageTrace[] = [];
    const failOnError = options.failOnErrorDiagnostic ?? false;
    let current = ctx;

    for (const stage of stages) {
      const started = current.clock.now();
      try {
        const result = await stage.run(current);
        const ended = current.clock.now();
        if (!result.ok) {
          trace.push({
            name: stage.name,
            phase: stage.phase,
            order: stage.order,
            ran: true,
            durationMs: ended - started,
            error: result.error.message,
          });
          // Aborted (e.g. policy deny) — return failed result with the decision.
          const aborted =
            result.error instanceof AbortCompilationError
              ? { reason: result.error.reason, decision: result.error.decision }
              : undefined;
          return {
            ok: false,
            diagnostics: current.state.diagnostics,
            stages: trace,
            aborted,
          };
        }
        current = result.value;
        trace.push({
          name: stage.name,
          phase: stage.phase,
          order: stage.order,
          ran: true,
          durationMs: ended - started,
        });

        // Optional: abort on error-severity diagnostics.
        if (failOnError) {
          const hasError = current.state.diagnostics.some(
            (d) => d.severity === "error"
          );
          if (hasError) {
            return {
              ok: false,
              diagnostics: current.state.diagnostics,
              stages: trace,
              aborted: { reason: "error-severity diagnostic produced" },
            };
          }
        }
      } catch (e) {
        const ended = current.clock.now();
        const message = e instanceof Error ? e.message : String(e);
        trace.push({
          name: stage.name,
          phase: stage.phase,
          order: stage.order,
          ran: true,
          durationMs: ended - started,
          error: message,
        });
        return {
          ok: false,
          diagnostics: current.state.diagnostics,
          stages: trace,
        };
      }
    }

    return {
      ok: true,
      graph: current.state.graph,
      plan: current.state.plan,
      diagnostics: current.state.diagnostics,
      stages: trace,
    };
  }
}
