/**
 * @kernel/composition/domain/composition-pipeline — the `CompositionPipeline`
 * PORT plus its input / output / stage types.
 *
 * The pipeline turns `(ProtocolManifest, DomainDefinition, knowledge refs,
 * contributions)` into an immutable `OperationalPackage` via a deterministic
 * sequence of stages: `resolve → validate → link → bundle → sign → package`.
 * Each stage emits `PackageDiagnostic` records. The pipeline accumulates
 * diagnostics and decides whether the build succeeded.
 *
 * Implementations live in `infrastructure/default-composition-pipeline.ts`.
 *
 * Pure domain layer (interface declarations only — no implementation).
 */

import type { ProtocolManifest } from "@kernel/protocol-sdk";
import type { DomainDefinition } from "@kernel/domain-modeling";
import type { PackageContents } from "./package-artifact";
import type { PackageDiagnostic, CompositionStage } from "./package-diagnostics";
import type { OperationalPackage } from "./operational-package";

/**
 * Input to `CompositionPipeline.compile`.
 *
 *   `protocolManifest`  — the source protocol being compiled.
 *   `domainDefinition`  — optional bound domain definition. May be omitted
 *                          for protocols that ship no domain bindings.
 *   `knowledgeRefs`    — knowledge item ids the package binds to.
 *   `contributions`    — pre-collected `PackageContents` (the contributions
 *                          the protocol declares: extensions, policies,
 *                          workflows, capabilities, UI, APIs, analytics,
 *                          config defaults). The linker resolves any
 *                          references inside these.
 *   `now`              — epoch milliseconds at compile time. Used for
 *                          `manifest.buildTimestamp` and `signature.signedAt`.
 *                          MUST be supplied by the caller; never `Date.now()`.
 */
export interface CompositionInput {
  readonly protocolManifest: ProtocolManifest;
  readonly domainDefinition?: DomainDefinition;
  readonly knowledgeRefs: readonly string[];
  readonly contributions: PackageContents;
  readonly now: number;
}

/**
 * Result of a single pipeline stage.
 *
 *   `stage`       — the stage name (`resolve`, `validate`, `link`, `bundle`,
 *                   `sign`, `package`).
 *   `ok`          — true iff the stage produced no error/fatal diagnostics.
 *   `durationMs`  — optional wall-clock duration of the stage (informational;
 *                   not used for any decision).
 */
export interface CompositionStageResult {
  readonly stage: CompositionStage;
  readonly ok: boolean;
  readonly durationMs?: number;
}

/**
 * Result of `CompositionPipeline.compile`.
 *
 *   `ok`           — true iff every stage succeeded AND a package was produced.
 *   `package`      — the produced `OperationalPackage`, or `undefined` if the
 *                    build failed.
 *   `diagnostics`  — all diagnostics from every stage, in emission order.
 *   `stages`       — per-stage results, in execution order.
 */
export interface CompositionResult {
  readonly ok: boolean;
  readonly package?: OperationalPackage;
  readonly diagnostics: readonly PackageDiagnostic[];
  readonly stages: readonly CompositionStageResult[];
}

/**
 * PORT `CompositionPipeline` — turns source into an `OperationalPackage`.
 *
 * The contract is: given a `CompositionInput`, run the deterministic pipeline
 * and return a `CompositionResult`. Implementations MAY be async (a real
 * signer may need to await a KMS call); the demo pipeline is synchronous.
 */
export interface CompositionPipeline {
  compile(input: CompositionInput): Promise<CompositionResult> | CompositionResult;
}

/**
 * The canonical stage ordering. Pipeline implementations MUST execute stages
 * in this order so diagnostics are emitted deterministically.
 */
export const COMPOSITION_STAGES: readonly CompositionStage[] = [
  "resolve",
  "validate",
  "link",
  "bundle",
  "sign",
  "package",
];
