/**
 * @kernel/compiler/application/compile — the `compile(intent, ctx)` use-case.
 *
 * Thin orchestrator: builds a `CompilerPipeline` from injected stages and
 * delegates to `pipeline.compile()`. Provided as a standalone function so
 * callers can compile without holding a pipeline reference (the pipeline is
 * reconstructed per call from the injected stages, which is correct because
 * stage registration happens at boot, not per command).
 */

import type { Intent } from "@kernel/shared-kernel";
import type { CompilationContext } from "../domain/compilation-context";
import type {
  CompilerPipeline,
  CompilerOptions,
  CompilerResult,
} from "../domain/compiler-pipeline";

export function compile(
  pipeline: CompilerPipeline,
  intent: Intent,
  ctx: CompilationContext,
  options?: CompilerOptions
): Promise<CompilerResult> {
  return pipeline.compile(intent, ctx, options);
}
