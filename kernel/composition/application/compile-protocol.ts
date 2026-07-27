/**
 * @kernel/composition/application/compile-protocol — `compileProtocol()`,
 * THE main use-case of the composition system.
 *
 * Turns a `(ProtocolManifest, DomainDefinition, knowledge refs, contributions)`
 * tuple into an immutable `OperationalPackage` via a `CompositionPipeline`.
 *
 * This use-case is a thin orchestrator: it constructs the `CompositionInput`,
 * delegates to the injected `CompositionPipeline`, and returns the result. The
 * pipeline (default in-memory implementation in
 * `infrastructure/default-composition-pipeline.ts`) runs the deterministic
 * `resolve → validate → link → bundle → sign → package` sequence.
 *
 * Pure given the pipeline + input. No I/O, no `Date.now()` (the `now`
 * argument flows through), no `Math.random()`.
 */

import type { ProtocolManifest } from "@kernel/protocol-sdk";
import type { DomainDefinition } from "@kernel/domain-modeling";
import type { CompositionPipeline, CompositionInput } from "../domain";
import type { CompositionResult } from "../domain";
import type { OperationalPackage } from "../domain";
import type { PackageContents } from "../domain";

/**
 * Input to `compileProtocol` — the same shape as `CompositionInput` but
 * named explicitly for the use-case boundary.
 */
export interface CompileProtocolInput {
  readonly protocolManifest: ProtocolManifest;
  readonly domainDefinition?: DomainDefinition;
  readonly knowledgeRefs: readonly string[];
  readonly contributions: PackageContents;
  readonly now: number;
}

/**
 * Result of `compileProtocol`. Mirrors `CompositionResult` but adds a
 * convenience `diagnostics` accessor.
 */
export type CompileProtocolResult = CompositionResult;

/**
 * Deps for `compileProtocol` — just the pipeline (the pipeline itself
 * encapsulates the validator, linker, resolver, packaging engine, signer,
 * and registry).
 */
export interface CompileProtocolDeps {
  readonly pipeline: CompositionPipeline;
}

/**
 * `compileProtocol` — THE main use-case. Compiles a protocol source
 * definition into an immutable `OperationalPackage`.
 *
 * Usage:
 *   const result = compileProtocol(
 *     { protocolManifest, domainDefinition, knowledgeRefs, contributions, now },
 *     { pipeline }
 *   );
 *   if (result.ok) { const pkg = result.package; ... }
 *   else { for (const d of result.diagnostics) console.warn(d.message); }
 *
 * The result is a `Promise<CompositionResult>` if the pipeline is async
 * (real signer); a plain `CompositionResult` if the pipeline is sync (demo).
 * Callers should `await` defensively.
 */
export function compileProtocol(
  input: CompileProtocolInput,
  deps: CompileProtocolDeps
): Promise<CompositionResult> | CompositionResult {
  const compositionInput: CompositionInput = {
    protocolManifest: input.protocolManifest,
    domainDefinition: input.domainDefinition,
    knowledgeRefs: input.knowledgeRefs,
    contributions: input.contributions,
    now: input.now,
  };
  return deps.pipeline.compile(compositionInput);
}

/**
 * Convenience wrapper that always returns a `Promise<OperationalPackage | undefined>`.
 * Rejects (throws) only on infrastructural failure; a normal "validation
 * failed" build resolves to `undefined` (callers should consult the
 * `CompositionResult` form for diagnostics).
 */
export async function compileProtocolAsync(
  input: CompileProtocolInput,
  deps: CompileProtocolDeps
): Promise<OperationalPackage | undefined> {
  const result = await deps.pipeline.compile({
    protocolManifest: input.protocolManifest,
    domainDefinition: input.domainDefinition,
    knowledgeRefs: input.knowledgeRefs,
    contributions: input.contributions,
    now: input.now,
  });
  return result.ok ? result.package : undefined;
}

/** Re-export the use-case class for callers that prefer the OO style. */
export class CompileProtocolUseCase {
  constructor(private readonly deps: CompileProtocolDeps) {}

  compile(input: CompileProtocolInput): Promise<CompositionResult> | CompositionResult {
    return compileProtocol(input, this.deps);
  }
}
