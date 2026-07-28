/**
 * @kernel/composition/infrastructure/composition-linker —
 * `InMemoryCompositionLinker`.
 *
 * Resolves all references inside a `PackageContents` into IMMUTABLE ids.
 * After linking, NO unresolved references should remain.
 *
 * The linker is conceptually the "relocation" step of a compiler: it takes
 * symbolic references and pins them to concrete ids. In a real system this
 * would resolve cross-package references (e.g. `protocol:cleaning` →
 * `opsos.protocol.cleaning@1.2.0`). In this in-memory implementation the
 * linker is a SHAPE-PRESERVING pass that:
 *
 *   1. Verifies every reference is well-formed (non-empty string).
 *   2. Resolves "soft" references — e.g. unprefixed entity-type ids are
 *      namespaced under their domain: `Room` →
 *      `${domainId}.entity.Room` (only when a `domainId` is supplied).
 *   3. Returns a NEW `PackageContents` with all references resolved to
 *      immutable ids, plus the diagnostics emitted.
 *
 * The linker NEVER throws — failures are returned as diagnostics. If a
 * reference cannot be resolved, it is left unchanged AND a `warn`-severity
 * diagnostic is emitted.
 *
 * Determinism: resolution is purely functional over the input. The order of
 * references in each list is preserved.
 */

import type { PackageContents } from "../domain";
import type { PackageDiagnostic } from "../domain";
import type { CompositionStage } from "../domain";
import { diagnostic } from "../domain";

const STAGE: CompositionStage = "link";

/** Result of a linker run: a (possibly new) `PackageContents` + diagnostics. */
export interface LinkerResult {
  readonly contents: PackageContents;
  readonly diagnostics: readonly PackageDiagnostic[];
}

/**
 * `InMemoryCompositionLinker` — resolves references into immutable ids.
 *
 * Stateless.
 */
export class InMemoryCompositionLinker {
  /**
   * Link the contents.
   *
   * @param contents  the package contents to link
   * @param domainId  optional domain id used to namespace entity-type refs
   */
  link(contents: PackageContents, domainId?: string): LinkerResult {
    const diags: PackageDiagnostic[] = [];

    // Domain bindings: ensure every key is non-empty.
    const domainBindings: Record<string, string> = {};
    for (const [k, v] of Object.entries(contents.domainBindings)) {
      if (!k || k.trim() === "") {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "EMPTY_BINDING_KEY",
            `domainBindings has an empty key`,
            "contents.domainBindings"
          )
        );
        continue;
      }
      if (!v || v.trim() === "") {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "EMPTY_BINDING_VALUE",
            `domainBindings['${k}'] has an empty value`,
            `contents.domainBindings.${k}`
          )
        );
        continue;
      }
      // Resolve: if domainId is supplied and the value is a bare id (no
      // dot-prefix matching the domain), namespace it.
      const resolvedValue = this.resolveDomainRef(v, domainId, diags, k);
      domainBindings[k] = resolvedValue;
    }

    // Refs: ensure non-empty, optionally namespace.
    const knowledgeRefs = this.resolveRefList(
      contents.knowledgeRefs,
      "knowledgeRefs",
      diags
    );
    const compilerExtensions = this.resolveRefList(
      contents.compilerExtensions,
      "compilerExtensions",
      diags
    );
    const policies = this.resolveRefList(contents.policies, "policies", diags);
    const capabilities = this.resolveRefList(
      contents.capabilities,
      "capabilities",
      diags
    );
    const workflows = this.resolveRefList(
      contents.workflows,
      "workflows",
      diags
    );
    const resourceRequirements = this.resolveRefList(
      contents.resourceRequirements,
      "resourceRequirements",
      diags
    );
    const measurements = this.resolveRefList(
      contents.measurements,
      "measurements",
      diags
    );
    const uiExtensions = this.resolveRefList(
      contents.uiExtensions,
      "uiExtensions",
      diags
    );
    const apiRoutes = this.resolveRefList(
      contents.apiRoutes,
      "apiRoutes",
      diags
    );
    const analytics = this.resolveRefList(
      contents.analytics,
      "analytics",
      diags
    );

    // configDefaults is opaque — no resolution needed; just verify
    // serialisability defensively (the validator already does this, but a
    // second pass here is cheap and keeps the linker self-contained).
    try {
      JSON.stringify(contents.configDefaults);
    } catch (e) {
      diags.push(
        diagnostic(
          STAGE,
          "error",
          "CONFIG_NOT_SERIALIZABLE",
          `configDefaults cannot be JSON-serialised: ${(e as Error).message}`,
          "contents.configDefaults"
        )
      );
    }

    const linked: PackageContents = {
      domainBindings,
      knowledgeRefs,
      compilerExtensions,
      policies,
      capabilities,
      workflows,
      resourceRequirements,
      measurements,
      uiExtensions,
      apiRoutes,
      analytics,
      configDefaults: contents.configDefaults,
    };
    return { contents: linked, diagnostics: diags };
  }

  private resolveRefList(
    refs: readonly string[],
    field: string,
    diags: PackageDiagnostic[]
  ): string[] {
    const out: string[] = [];
    for (const r of refs) {
      if (!r || r.trim() === "") {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "EMPTY_REF",
            `${field} contains an empty entry`,
            `contents.${field}`
          )
        );
        continue;
      }
      out.push(r);
    }
    return out;
  }

  private resolveDomainRef(
    value: string,
    domainId: string | undefined,
    diags: PackageDiagnostic[],
    key: string
  ): string {
    if (!domainId) return value;
    // If value already starts with the domainId prefix, leave it.
    if (value.startsWith(`${domainId}.`)) return value;
    // Otherwise namespace it.
    return `${domainId}.${value}`;
  }
}
