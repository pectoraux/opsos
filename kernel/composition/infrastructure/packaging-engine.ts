/**
 * @kernel/composition/infrastructure/packaging-engine —
 * `InMemoryPackagingEngine`.
 *
 * Bundles a validated + linked `PackageContents` together with a
 * `PackageManifest` into a `PackageArtifact` (the immutable in-memory
 * representation of a `.opspkg` file). Computes the deterministic digest over
 * the serialised contents using the injected `DigestProvider`.
 *
 * The engine is the FINAL step before signing: it produces the artifact, then
 * the pipeline signs it. The engine does NOT sign — signing is a separate
 * concern (see `demo-signer.ts`).
 *
 * Determinism:
 *   - The manifest is built from the source `ProtocolManifest` + build
 *     metadata supplied by the caller; the engine does NOT invent fields.
 *   - The digest is computed by the `DigestProvider` over a canonical
 *     JSON serialisation (sorted keys) — see `DemoDigestProvider` for the
 *     reference implementation.
 */

import type { ProtocolManifest } from "@kernel/protocol-sdk";
import type {
  PackageArtifact,
  PackageContents,
  PackageDigest,
  PackageManifest,
} from "../domain";
import type { DigestProvider } from "../domain";
import type { PackageDiagnostic } from "../domain";
import type { CompositionStage } from "../domain";
import { diagnostic } from "../domain";
import { COMPOSITION_COMPILER_VERSION } from "../domain";

const STAGE: CompositionStage = "bundle";

/** Input to `InMemoryPackagingEngine.bundle`. */
export interface BundleInput {
  readonly protocolManifest: ProtocolManifest;
  readonly contents: PackageContents;
  readonly now: number;
  /** Optional extra build metadata (merged into `manifest.buildMetadata`). */
  readonly buildMetadata?: Readonly<Record<string, unknown>>;
  /** Optional knowledge version stamp. */
  readonly knowledgeVersion?: string;
  /** Optional domain version stamp (derived from a `DomainDefinition`). */
  readonly domainVersion?: string;
}

/** Result of `bundle`: the artifact (or undefined on failure) + diagnostics. */
export interface BundleResult {
  readonly artifact?: PackageArtifact;
  readonly diagnostics: readonly PackageDiagnostic[];
}

/**
 * `InMemoryPackagingEngine` — bundles validated + linked contents into a
 * `PackageArtifact` and computes the digest.
 *
 * Stateless.
 */
export class InMemoryPackagingEngine {
  constructor(private readonly digestProvider: DigestProvider) {}

  bundle(input: BundleInput): BundleResult {
    const diags: PackageDiagnostic[] = [];
    const pm = input.protocolManifest;

    // Build the manifest. Every field is sourced from the input — the engine
    // does NOT invent fields. `buildTimestamp` is `now`; `compilerVersion`
    // is the current composition compiler version.
    const manifest: PackageManifest = {
      id: pm.id,
      name: pm.name,
      displayName: pm.displayName,
      version: pm.version,
      apiVersion: pm.apiVersion,
      kernelVersion: pm.minimumKernelVersion,
      domainVersion: input.domainVersion,
      protocolVersion: pm.version,
      knowledgeVersion: input.knowledgeVersion,
      author: { name: pm.author.name, url: pm.author.url },
      license: pm.license,
      dependencies: pm.dependencies.map((d) => ({
        id: d.id,
        versionRange: d.versionRange,
        optional: d.optional,
      })),
      permissions: pm.permissions.map((p) => p.scope),
      buildMetadata: { ...input.buildMetadata },
      buildTimestamp: input.now,
      compilerVersion: COMPOSITION_COMPILER_VERSION,
    };

    // Compute the digest over the contents.
    let digest: PackageDigest;
    try {
      digest = this.digestProvider.compute(input.contents);
    } catch (e) {
      diags.push(
        diagnostic(
          STAGE,
          "fatal",
          "DIGEST_FAILED",
          `Digest computation failed: ${(e as Error).message}`,
          "contents"
        )
      );
      return { diagnostics: diags };
    }

    // Verify the digest is well-formed.
    if (!digest || !digest.algorithm || !digest.hash) {
      diags.push(
        diagnostic(
          STAGE,
          "error",
          "MALFORMED_DIGEST",
          `Digest provider returned a malformed digest`,
          "digest"
        )
      );
      return { diagnostics: diags };
    }

    const artifact: PackageArtifact = {
      manifest,
      contents: input.contents,
      digest,
    };
    return { artifact, diagnostics: diags };
  }
}
