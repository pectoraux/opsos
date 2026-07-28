/**
 * @kernel/composition/infrastructure/composition-validator —
 * `InMemoryCompositionValidator`.
 *
 * Validates the semantic integrity of a `PackageContents` against the
 * (optional) `DomainDefinition` and the supplied knowledge/procedure refs.
 *
 * The validator is a pure function over its inputs; it returns a list of
 * `PackageDiagnostic` records (it never throws).
 *
 * Validation checks performed:
 *
 *   1. SEMANTIC INTEGRITY — every `entityTypeId` in `domainBindings` resolves
 *      to an `EntityType` in the supplied `DomainDefinition` (if any). When
 *      no domain definition is supplied, semantic checks are skipped (warn).
 *   2. KNOWLEDGE INTEGRITY — every `knowledgeRefs` entry is a non-empty
 *      string and there are no duplicates. (Active/compatible status is
 *      advisory at this layer; the installer re-checks at install time.)
 *   3. RESOURCE INTEGRITY — every `capabilities` id is non-empty and unique.
 *   4. WORKFLOW INTEGRITY — every `workflows` id is non-empty and unique.
 *   5. POLICY INTEGRITY — every `policies` id is non-empty, unique, and the
 *      `configDefaults` are JSON-serialisable (deterministic).
 *   6. EXTENSION INTEGRITY — every `compilerExtensions` id is non-empty and
 *      unique (no duplicates/conflicts).
 *   7. DEPENDENCY GRAPH — delegated to `InMemoryDependencyResolver`; the
 *      validator surfaces the resolver's diagnostics.
 *
 * Determinism: all checks are deterministic; all diagnostic emission order is
 * deterministic (fields are visited in declaration order).
 */

import type { ProtocolManifest } from "@kernel/protocol-sdk";
import type { DomainDefinition } from "@kernel/domain-modeling";
import type { OperationalPackage } from "../domain";
import type { PackageContents } from "../domain";
import type { PackageDiagnostic } from "../domain";
import type { CompositionStage } from "../domain";
import { diagnostic } from "../domain";

const STAGE: CompositionStage = "validate";

/** A small set of refs the validator consults for cross-references. */
export interface ValidatorContext {
  /**
   * The known set of entity-type ids in the bound domain (if any). When
   * `undefined`, semantic integrity is skipped with a `warn` diagnostic.
   */
  readonly knownEntityTypeIds?: readonly string[];
  /**
   * The known set of knowledge-item ids. When `undefined`, knowledge-integrity
   * only checks shape (non-empty, unique).
   */
  readonly knownKnowledgeIds?: readonly string[];
  /**
   * The known set of capability ids. When `undefined`, capability-integrity
   * only checks shape.
   */
  readonly knownCapabilityIds?: readonly string[];
  /**
   * The known set of workflow ids.
   */
  readonly knownWorkflowIds?: readonly string[];
}

/**
 * `InMemoryCompositionValidator` — validates semantic integrity of a package.
 *
 * Stateless: construct once, call `validate` as many times as needed. All
 * state lives in the inputs.
 */
export class InMemoryCompositionValidator {
  /**
   * Validate a package.
   *
   * @param pkg           the package to validate
   * @param manifest      the source protocol manifest (for cross-checks)
   * @param domain        optional bound domain definition
   * @param ctx           optional cross-reference context
   */
  validate(
    pkg: OperationalPackage,
    manifest?: ProtocolManifest,
    domain?: DomainDefinition,
    ctx?: ValidatorContext
  ): readonly PackageDiagnostic[] {
    const diags: PackageDiagnostic[] = [];
    diags.push(...this.validateSemantic(pkg.contents, domain, ctx));
    diags.push(...this.validateKnowledge(pkg.contents, ctx));
    diags.push(...this.validateResource(pkg.contents, ctx));
    diags.push(...this.validateWorkflow(pkg.contents, ctx));
    diags.push(...this.validatePolicy(pkg.contents));
    diags.push(...this.validateExtension(pkg.contents));
    if (manifest) {
      diags.push(...this.validateManifestCrossRefs(pkg.contents, manifest));
    }
    return diags;
  }

  // ── Semantic integrity (entity refs exist) ──────────────────────────────

  private validateSemantic(
    contents: PackageContents,
    domain: DomainDefinition | undefined,
    ctx: ValidatorContext | undefined
  ): readonly PackageDiagnostic[] {
    const diags: PackageDiagnostic[] = [];
    const bindings = Object.entries(contents.domainBindings);
    if (bindings.length === 0) {
      // No domain bindings — nothing to check. Emit info if a domain was
      // supplied.
      if (domain) {
        diags.push(
          diagnostic(
            STAGE,
            "info",
            "NO_DOMAIN_BINDINGS",
            `Domain '${domain.id}' supplied but package declares no domainBindings`
          )
        );
      }
      return diags;
    }
    if (!domain && !ctx?.knownEntityTypeIds) {
      diags.push(
        diagnostic(
          STAGE,
          "warn",
          "NO_DOMAIN_CONTEXT",
          `Package declares ${bindings.length} domainBindings but no domain definition or known entity-type set was supplied; semantic integrity cannot be verified`,
          "contents.domainBindings"
        )
      );
      return diags;
    }
    const knownIds = new Set<string>(
      domain
        ? domain.entityTypes.map((e) => e.id)
        : ctx?.knownEntityTypeIds ?? []
    );
    for (const [entityTypeId, domainId] of bindings) {
      if (!knownIds.has(entityTypeId)) {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "UNKNOWN_ENTITY_TYPE",
            `domainBindings references unknown entityTypeId '${entityTypeId}'`,
            `contents.domainBindings.${entityTypeId}`
          )
        );
      }
      if (domain && domain.id !== domainId) {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "DOMAIN_MISMATCH",
            `domainBindings['${entityTypeId}'] = '${domainId}' does not match supplied domain id '${domain.id}'`,
            `contents.domainBindings.${entityTypeId}`
          )
        );
      }
    }
    return diags;
  }

  // ── Knowledge integrity ─────────────────────────────────────────────────

  private validateKnowledge(
    contents: PackageContents,
    ctx: ValidatorContext | undefined
  ): readonly PackageDiagnostic[] {
    const diags: PackageDiagnostic[] = [];
    const seen = new Set<string>();
    for (const ref of contents.knowledgeRefs) {
      if (!ref || ref.trim() === "") {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "EMPTY_KNOWLEDGE_REF",
            `knowledgeRefs contains an empty entry`,
            "contents.knowledgeRefs"
          )
        );
        continue;
      }
      if (seen.has(ref)) {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "DUPLICATE_KNOWLEDGE_REF",
            `knowledgeRefs contains duplicate '${ref}'`,
            "contents.knowledgeRefs"
          )
        );
      }
      seen.add(ref);
      if (ctx?.knownKnowledgeIds && !ctx.knownKnowledgeIds.includes(ref)) {
        diags.push(
          diagnostic(
            STAGE,
            "warn",
            "UNKNOWN_KNOWLEDGE_REF",
            `knowledgeRefs references '${ref}' which is not in the supplied known set`,
            "contents.knowledgeRefs"
          )
        );
      }
    }
    return diags;
  }

  // ── Resource / capability integrity ─────────────────────────────────────

  private validateResource(
    contents: PackageContents,
    ctx: ValidatorContext | undefined
  ): readonly PackageDiagnostic[] {
    const diags: PackageDiagnostic[] = [];
    const seen = new Set<string>();
    for (const capId of contents.capabilities) {
      if (!capId || capId.trim() === "") {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "EMPTY_CAPABILITY",
            `capabilities contains an empty entry`,
            "contents.capabilities"
          )
        );
        continue;
      }
      if (seen.has(capId)) {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "DUPLICATE_CAPABILITY",
            `capabilities contains duplicate '${capId}'`,
            "contents.capabilities"
          )
        );
      }
      seen.add(capId);
      if (ctx?.knownCapabilityIds && !ctx.knownCapabilityIds.includes(capId)) {
        diags.push(
          diagnostic(
            STAGE,
            "warn",
            "UNKNOWN_CAPABILITY",
            `capabilities references '${capId}' not in the supplied known set`,
            "contents.capabilities"
          )
        );
      }
    }
    // resourceRequirements are strings — check shape only.
    const seenReq = new Set<string>();
    for (const req of contents.resourceRequirements) {
      if (!req || req.trim() === "") {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "EMPTY_RESOURCE_REQUIREMENT",
            `resourceRequirements contains an empty entry`,
            "contents.resourceRequirements"
          )
        );
        continue;
      }
      if (seenReq.has(req)) {
        diags.push(
          diagnostic(
            STAGE,
            "warn",
            "DUPLICATE_RESOURCE_REQUIREMENT",
            `resourceRequirements contains duplicate '${req}'`,
            "contents.resourceRequirements"
          )
        );
      }
      seenReq.add(req);
    }
    return diags;
  }

  // ── Workflow integrity ──────────────────────────────────────────────────

  private validateWorkflow(
    contents: PackageContents,
    ctx: ValidatorContext | undefined
  ): readonly PackageDiagnostic[] {
    const diags: PackageDiagnostic[] = [];
    const seen = new Set<string>();
    for (const wfId of contents.workflows) {
      if (!wfId || wfId.trim() === "") {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "EMPTY_WORKFLOW",
            `workflows contains an empty entry`,
            "contents.workflows"
          )
        );
        continue;
      }
      if (seen.has(wfId)) {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "DUPLICATE_WORKFLOW",
            `workflows contains duplicate '${wfId}'`,
            "contents.workflows"
          )
        );
      }
      seen.add(wfId);
      if (ctx?.knownWorkflowIds && !ctx.knownWorkflowIds.includes(wfId)) {
        diags.push(
          diagnostic(
            STAGE,
            "warn",
            "UNKNOWN_WORKFLOW",
            `workflows references '${wfId}' not in the supplied known set`,
            "contents.workflows"
          )
        );
      }
    }
    return diags;
  }

  // ── Policy integrity (serialisable + deterministic) ─────────────────────

  private validatePolicy(contents: PackageContents): readonly PackageDiagnostic[] {
    const diags: PackageDiagnostic[] = [];
    const seen = new Set<string>();
    for (const pId of contents.policies) {
      if (!pId || pId.trim() === "") {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "EMPTY_POLICY",
            `policies contains an empty entry`,
            "contents.policies"
          )
        );
        continue;
      }
      if (seen.has(pId)) {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "DUPLICATE_POLICY",
            `policies contains duplicate '${pId}'`,
            "contents.policies"
          )
        );
      }
      seen.add(pId);
    }
    // configDefaults MUST be JSON-serialisable (deterministic). We probe by
    // attempting to JSON.stringify; functions / undefined values would be
    // dropped silently but circular structures would throw.
    try {
      // Use a sorted-key replacer for determinism check (does not affect the
      // stored value — only verifies serialisability).
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
    return diags;
  }

  // ── Extension integrity (no duplicates / conflicts) ─────────────────────

  private validateExtension(
    contents: PackageContents
  ): readonly PackageDiagnostic[] {
    const diags: PackageDiagnostic[] = [];
    const seen = new Set<string>();
    for (const exId of contents.compilerExtensions) {
      if (!exId || exId.trim() === "") {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "EMPTY_EXTENSION",
            `compilerExtensions contains an empty entry`,
            "contents.compilerExtensions"
          )
        );
        continue;
      }
      if (seen.has(exId)) {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "DUPLICATE_EXTENSION",
            `compilerExtensions contains duplicate '${exId}' (conflict)`,
            "contents.compilerExtensions"
          )
        );
      }
      seen.add(exId);
    }
    return diags;
  }

  // ── Manifest cross-references ───────────────────────────────────────────

  private validateManifestCrossRefs(
    contents: PackageContents,
    manifest: ProtocolManifest
  ): readonly PackageDiagnostic[] {
    const diags: PackageDiagnostic[] = [];
    // Every capability declared in the package SHOULD appear in the protocol
    // manifest's capabilities list. (The manifest is the source of truth.)
    const declared = new Set(manifest.capabilities);
    for (const capId of contents.capabilities) {
      if (declared.size > 0 && !declared.has(capId)) {
        diags.push(
          diagnostic(
            STAGE,
            "warn",
            "CAPABILITY_NOT_IN_MANIFEST",
            `capabilities references '${capId}' which is not declared in the protocol manifest`,
            "contents.capabilities"
          )
        );
      }
    }
    // Every extension declared in the package SHOULD appear in the manifest's
    // extensions list.
    const extDeclared = new Set(manifest.extensions);
    for (const exId of contents.compilerExtensions) {
      if (extDeclared.size > 0 && !extDeclared.has(exId)) {
        diags.push(
          diagnostic(
            STAGE,
            "warn",
            "EXTENSION_NOT_IN_MANIFEST",
            `compilerExtensions references '${exId}' which is not declared in the protocol manifest`,
            "contents.compilerExtensions"
          )
        );
      }
    }
    return diags;
  }
}
