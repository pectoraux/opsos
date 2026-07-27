/**
 * @kernel/composition/infrastructure/default-composition-pipeline —
 * `DefaultCompositionPipeline`.
 *
 * Orchestrates the deterministic composition pipeline:
 *
 *   resolve → validate → link → bundle → sign → package
 *
 * Each stage:
 *   - emits `PackageDiagnostic` records (never throws).
 *   - on `error`/`fatal`, the pipeline continues to collect further
 *     diagnostics but does NOT proceed to stages that depend on the failed
 *     one's output. Concretely: if `resolve` fails, the pipeline still tries
 *     `validate` and `link` (they don't depend on resolved deps), but skips
 *     `bundle`, `sign`, and `package`.
 *   - on `fatal`, the pipeline aborts immediately and returns whatever it has.
 *
 * Determinism guarantees (enforced):
 *   - The `now` argument from `CompositionInput` is the ONLY source of time.
 *     It flows into `manifest.buildTimestamp` and `signature.signedAt`.
 *   - The `DigestProvider` produces a deterministic hash.
 *   - The `Signer` produces a deterministic signature.
 *   - Stage ordering is fixed (`COMPOSITION_STAGES`).
 *
 * The default pipeline uses the in-memory validator, linker, resolver,
 * packaging engine, and (optionally) a signer + signature store. If no signer
 * is supplied, the `sign` stage is skipped (with a `warn` diagnostic).
 */

import type { ProtocolManifest } from "@kernel/protocol-sdk";
import type { DomainDefinition } from "@kernel/domain-modeling";
import type {
  CompositionInput,
  CompositionPipeline,
  CompositionResult,
  CompositionStageResult,
  OperationalPackage,
  PackageDiagnostic,
  PackageSignature,
  Signer,
  Verifier,
  DigestProvider,
  SignatureStore,
  PackageContents,
  PackageManifest,
  PackageDependency,
} from "../domain";
import type { CompositionStage } from "../domain";
import { COMPOSITION_COMPILER_VERSION } from "../domain";
import { InMemoryCompositionValidator } from "./composition-validator";
import type { ValidatorContext } from "./composition-validator";
import { InMemoryCompositionLinker } from "./composition-linker";
import { InMemoryDependencyResolver } from "./dependency-resolver";
import { InMemoryPackagingEngine } from "./packaging-engine";

/**
 * Deps for `DefaultCompositionPipeline`. All deps are optional except the
 * digest provider (the packaging engine needs it to compute the digest).
 */
export interface DefaultCompositionPipelineDeps {
  readonly digestProvider: DigestProvider;
  readonly signer?: Signer;
  readonly verifier?: Verifier;
  readonly signatureStore?: SignatureStore;
  /** Optional context for the validator's cross-reference checks. */
  readonly validatorContext?: ValidatorContext;
  /** Optionally, the set of already-installed packages (for resolve). */
  readonly installedPackages?: readonly OperationalPackage[];
  /** Optionally, the host kernel/api/protocol versions (for resolve). */
  readonly host?: {
    readonly kernelVersion?: string;
    readonly apiVersion?: string;
    readonly protocolVersion?: string;
  };
}

/**
 * `DefaultCompositionPipeline` — orchestrates resolve → validate → link →
 * bundle → sign → package.
 *
 * Construct once per pipeline session. The deps are immutable for the lifetime
 * of the pipeline.
 */
export class DefaultCompositionPipeline implements CompositionPipeline {
  private readonly validator = new InMemoryCompositionValidator();
  private readonly linker = new InMemoryCompositionLinker();
  private readonly resolver = new InMemoryDependencyResolver();
  private readonly packagingEngine: InMemoryPackagingEngine;
  private readonly deps: DefaultCompositionPipelineDeps;

  constructor(deps: DefaultCompositionPipelineDeps) {
    this.deps = deps;
    this.packagingEngine = new InMemoryPackagingEngine(deps.digestProvider);
  }

  async compile(input: CompositionInput): Promise<CompositionResult> {
    const allDiags: PackageDiagnostic[] = [];
    const stages: CompositionStageResult[] = [];
    let aborted = false;

    const runStage = async (
      stage: CompositionStage,
      fn: () =>
        | readonly PackageDiagnostic[]
        | Promise<readonly PackageDiagnostic[]>
    ): Promise<readonly PackageDiagnostic[]> => {
      if (aborted) {
        stages.push({ stage, ok: true });
        return [];
      }
      let diags: readonly PackageDiagnostic[];
      try {
        const r = fn();
        diags = r instanceof Promise ? await r : r;
      } catch (e) {
        diags = [
          {
            stage,
            severity: "fatal",
            code: "STAGE_EXCEPTION",
            message: `Stage '${stage}' threw: ${(e as Error).message}`,
          },
        ];
      }
      const hasError = diags.some(
        (d) => d.severity === "error" || d.severity === "fatal"
      );
      const hasFatal = diags.some((d) => d.severity === "fatal");
      // durationMs is informational only; we deliberately do NOT measure
      // wall-clock time inside the deterministic core (would require
      // Date.now() / process.hrtime, both banned by the determinism rules).
      stages.push({ stage, ok: !hasError });
      allDiags.push(...diags);
      if (hasFatal) aborted = true;
      return diags;
    };

    // ── Stage 1: resolve ───────────────────────────────────────────────────
    // Parse the manifest's dependencies into PackageDependency records,
    // verify ranges are well-formed, and check (against installed packages,
    // if supplied) that required deps are present + version-compatible.
    let parsedDeps: readonly PackageDependency[] = [];
    await runStage("resolve", () => {
      const diags: PackageDiagnostic[] = [];
      const pm = input.protocolManifest;
      parsedDeps = pm.dependencies.map((d) => ({
        id: d.id,
        versionRange: d.versionRange,
        optional: d.optional ?? false,
      }));
      // Check for duplicate dep ids.
      const seen = new Set<string>();
      for (const d of parsedDeps) {
        if (seen.has(d.id)) {
          diags.push({
            stage: "resolve",
            severity: "error",
            code: "DUPLICATE_DEPENDENCY",
            message: `Duplicate dependency '${d.id}' in manifest`,
            field: "manifest.dependencies",
          });
        }
        seen.add(d.id);
      }
      // If installed packages were supplied, run the resolver to check for
      // cycles / missing / version-mismatch.
      if (this.deps.installedPackages && this.deps.installedPackages.length > 0) {
        // Build a hypothetical package for THIS manifest so the resolver
        // can include it in the graph. The contents are not yet known
        // (we're still in resolve), so we use EMPTY_PACKAGE_CONTENTS.
        const selfPkg: OperationalPackage = {
          manifest: {
            id: pm.id,
            name: pm.name,
            displayName: pm.displayName,
            version: pm.version,
            apiVersion: pm.apiVersion,
            kernelVersion: pm.minimumKernelVersion,
            protocolVersion: pm.version,
            author: { name: pm.author.name, url: pm.author.url },
            license: pm.license,
            dependencies: parsedDeps,
            permissions: pm.permissions.map((p) => p.scope),
            buildMetadata: {},
            buildTimestamp: input.now,
            compilerVersion: COMPOSITION_COMPILER_VERSION,
          },
          contents: EMPTY_PACKAGE_CONTENTS,
          digest: { algorithm: "pending", hash: "pending" },
        };
        const resolution = this.resolver.resolve(
          [...this.deps.installedPackages, selfPkg],
          this.deps.host
        );
        diags.push(...resolution.diagnostics);
      }
      return diags;
    });

    // ── Stage 2: validate ──────────────────────────────────────────────────
    let validatedContents = input.contributions;
    await runStage("validate", () => {
      // Build a provisional package for the validator (it needs the
      // manifest + contents shape). The digest is provisional.
      const provisionalPkg: OperationalPackage = {
        manifest: {
          id: input.protocolManifest.id,
          name: input.protocolManifest.name,
          displayName: input.protocolManifest.displayName,
          version: input.protocolManifest.version,
          apiVersion: input.protocolManifest.apiVersion,
          kernelVersion: input.protocolManifest.minimumKernelVersion,
          protocolVersion: input.protocolManifest.version,
          author: {
            name: input.protocolManifest.author.name,
            url: input.protocolManifest.author.url,
          },
          license: input.protocolManifest.license,
          dependencies: parsedDeps,
          permissions: input.protocolManifest.permissions.map((p) => p.scope),
          buildMetadata: {},
          buildTimestamp: input.now,
          compilerVersion: COMPOSITION_COMPILER_VERSION,
        },
        contents: input.contributions,
        digest: { algorithm: "pending", hash: "pending" },
      };
      const diags = this.validator.validate(
        provisionalPkg,
        input.protocolManifest,
        input.domainDefinition,
        this.deps.validatorContext
      );
      validatedContents = input.contributions;
      return diags;
    });

    // ── Stage 3: link ──────────────────────────────────────────────────────
    let linkedContents: PackageContents = validatedContents;
    await runStage("link", () => {
      const domainId = input.domainDefinition?.id;
      const result = this.linker.link(validatedContents, domainId);
      linkedContents = result.contents;
      return result.diagnostics;
    });

    // If validate or link produced errors, skip bundle/sign/package.
    const blocked = allDiags.some(
      (d) =>
        (d.severity === "error" || d.severity === "fatal") &&
        (d.stage === "validate" || d.stage === "link" || d.stage === "resolve")
    );
    if (blocked) {
      // Still push no-op stage results for the remaining stages.
      for (const s of ["bundle", "sign", "package"] as const) {
        stages.push({ stage: s, ok: false });
      }
      return {
        ok: false,
        diagnostics: allDiags,
        stages,
      };
    }

    // ── Stage 4: bundle ────────────────────────────────────────────────────
    let artifact: OperationalPackage | undefined;
    await runStage("bundle", () => {
      const result = this.packagingEngine.bundle({
        protocolManifest: input.protocolManifest,
        contents: linkedContents,
        now: input.now,
        domainVersion: input.domainDefinition
          ? String(input.domainDefinition.version)
          : undefined,
      });
      artifact = result.artifact;
      return result.diagnostics;
    });

    if (!artifact) {
      for (const s of ["sign", "package"] as const) {
        stages.push({ stage: s, ok: false });
      }
      return { ok: false, diagnostics: allDiags, stages };
    }

    // ── Stage 5: sign ──────────────────────────────────────────────────────
    let signedArtifact: OperationalPackage = artifact;
    await runStage("sign", () => {
      const diags: PackageDiagnostic[] = [];
      if (!this.deps.signer) {
        diags.push({
          stage: "sign",
          severity: "warn",
          code: "NO_SIGNER",
          message:
            "No signer configured; package will be unsigned (NOT production-safe)",
        });
        return diags;
      }
      const sigOrPromise = this.deps.signer.sign(artifact!.digest);
      // Handle both sync and async signers. We resolve the promise (if any)
      // before constructing the rest of the diagnostics so the signedAt
      // override is applied uniformly.
      const apply = (sig: PackageSignature): void => {
        const sigWithTime: PackageSignature = {
          ...sig,
          signedAt: input.now,
        };
        signedArtifact = {
          ...artifact!,
          signature: sigWithTime,
        };
      };
      if (sigOrPromise instanceof Promise) {
        // We cannot await inside this synchronous fn; instead, return a
        // promise that resolves once the signature is applied.
        return (async () => {
          const sig = await sigOrPromise;
          apply(sig);
          return diags;
        })();
      }
      apply(sigOrPromise);
      return diags;
    });

    // ── Stage 6: package (final assembly + optional verify + store) ────────
    await runStage("package", () => {
      const diags: PackageDiagnostic[] = [];
      if (this.deps.verifier && signedArtifact.signature) {
        const ok = this.deps.verifier.verify(signedArtifact);
        if (!ok) {
          diags.push({
            stage: "package",
            severity: "error",
            code: "SIGNATURE_VERIFICATION_FAILED",
            message: `Signature verification failed for '${signedArtifact.manifest.id}'`,
          });
        }
      }
      if (this.deps.signatureStore && signedArtifact.signature) {
        this.deps.signatureStore.save(signedArtifact);
      }
      return diags;
    });

    const ok =
      !allDiags.some(
        (d) => d.severity === "error" || d.severity === "fatal"
      ) && signedArtifact !== undefined;

    return {
      ok,
      package: ok ? signedArtifact : undefined,
      diagnostics: allDiags,
      stages,
    };
  }
}

const EMPTY_PACKAGE_CONTENTS: PackageContents = {
  domainBindings: {},
  knowledgeRefs: [],
  compilerExtensions: [],
  policies: [],
  capabilities: [],
  workflows: [],
  resourceRequirements: [],
  measurements: [],
  uiExtensions: [],
  apiRoutes: [],
  analytics: [],
  configDefaults: {},
};
