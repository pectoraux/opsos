/**
 * @kernel/knowledge-kernel/application/register-knowledge — the use-case that
 * atomically registers a knowledge item + its evidence + its specific
 * artifact (procedure / standard / regulation / guideline / fact).
 *
 * Knowledge artifacts in OpsOS are composite: a `KnowledgeItem` carries the
 * universal envelope (kind, applicability, version, confidence, provenance,
 * evidence, ownerProtocolId); the kind-specific record (e.g. `Procedure` with
 * its steps, `Regulation` with its jurisdiction + severity) is linked back
 * to the parent item by `knowledgeItemId`. Protocols register them together
 * — registering the parent without the artifact, or vice versa, leaves the
 * kernel in an inconsistent state.
 *
 * This use-case is THE sanctioned write path: given a `KnowledgeItem` plus
 * an optional artifact, it:
 *   1. validates the artifact's `knowledgeItemId` matches the item's id
 *      (when both are supplied; if the artifact has no `knowledgeItemId`,
 *      the use-case does NOT mutate it — the caller is expected to have
 *      stamped it — but warns in diagnostics);
 *   2. registers the item via `KnowledgeRegistry.register`;
 *   3. indexes any evidence records in the `EvidenceRegistry` (the item
 *      already carries them in `item.evidence`; indexing them in the
 *      EvidenceRegistry is for cross-source lookup);
 *   4. dispatches the artifact to the appropriate sibling registry
 *      (`FactRegistry`, `ProcedureRegistry`, `StandardRegistry`,
 *      `RegulationRegistry`, `GuidelineRegistry`).
 *
 * Atomicity: this use-case does NOT roll back partial registrations. Each
 * underlying `register` call is a pure data-structure mutation and cannot
 * fail; the use-case reports `outcome: "failed"` only when input validation
 * fails BEFORE any registry mutation. Once validation passes, all
 * registrations succeed.
 *
 * Determinism rule: identical inputs + identical registries → identical
 * outputs. No `Date.now()`, no `Math.random()`.
 */

import type {
  KnowledgeItemId,
  Fact,
  Procedure,
  Standard,
  Regulation,
  Guideline,
  Evidence,
  KnowledgeItem,
} from "@kernel/shared-kernel";
import type {
  KnowledgeRegistry,
  EvidenceRegistry,
  FactRegistry,
  ProcedureRegistry,
  StandardRegistry,
  RegulationRegistry,
  GuidelineRegistry,
} from "../domain";

/**
 * A discriminated union of the kind-specific artifacts a knowledge item may
 * carry. The `kind` discriminator selects the target registry.
 */
export type RegisterKnowledgeArtifact =
  | { readonly kind: "fact"; readonly fact: Fact }
  | { readonly kind: "procedure"; readonly procedure: Procedure }
  | { readonly kind: "standard"; readonly standard: Standard }
  | { readonly kind: "regulation"; readonly regulation: Regulation }
  | { readonly kind: "guideline"; readonly guideline: Guideline };

/**
 * The input to `RegisterKnowledge.execute`. Pure data.
 */
export interface RegisterKnowledgeInput {
  /** The knowledge item — the universal envelope. */
  readonly item: KnowledgeItem;
  /**
   * Optional additional evidence to index in the EvidenceRegistry. The
   * item's own `evidence` array is always indexed; this is for evidence
   * records the caller wants searchable across sources but didn't embed in
   * the item.
   */
  readonly evidence?: readonly Evidence[];
  /** Optional kind-specific artifact to dispatch to a sibling registry. */
  readonly artifact?: RegisterKnowledgeArtifact;
  /** Clock-sourced epoch-millis. Currently informational. */
  readonly now: number;
}

/**
 * The outcome of `RegisterKnowledge.execute`.
 *   - `"registered"` — item (+ evidence + artifact, if supplied) registered.
 *   - `"failed"`     — input validation failed; no registry was mutated.
 */
export type RegisterKnowledgeOutcome = "registered" | "failed";

/**
 * The result of `RegisterKnowledge.execute`.
 */
export interface RegisterKnowledgeResult {
  readonly outcome: RegisterKnowledgeOutcome;
  readonly knowledgeItemId: KnowledgeItemId;
  /** The id of the registered artifact, when one was supplied. */
  readonly artifactId?: string;
  readonly diagnostics: readonly string[];
}

/**
 * Constructor dependencies. The use-case needs the KnowledgeRegistry plus
 * every sibling registry it may dispatch an artifact to. All are required
 * (not optional) so the use-case can dispatch any artifact kind without
 * runtime "registry missing" failures.
 */
export interface RegisterKnowledgeDeps {
  readonly registry: KnowledgeRegistry;
  readonly evidence: EvidenceRegistry;
  readonly facts: FactRegistry;
  readonly procedures: ProcedureRegistry;
  readonly standards: StandardRegistry;
  readonly regulations: RegulationRegistry;
  readonly guidelines: GuidelineRegistry;
}

/**
 * The use-case PORT.
 */
export interface RegisterKnowledge {
  execute(input: RegisterKnowledgeInput): RegisterKnowledgeResult;
}

/**
 * Default implementation. Constructed with all the registries the
 * knowledge-kernel bundle owns.
 */
export class RegisterKnowledgeUseCase implements RegisterKnowledge {
  constructor(private readonly deps: RegisterKnowledgeDeps) {}

  execute(input: RegisterKnowledgeInput): RegisterKnowledgeResult {
    const diagnostics: string[] = [];
    const itemId = input.item.id;

    // ── 1. Validate the artifact's knowledgeItemId, if supplied. ─────────
    if (input.artifact) {
      const artifactItemId = artifactKnowledgeItemId(input.artifact);
      if (artifactItemId !== undefined && artifactItemId !== itemId) {
        diagnostics.push(
          `register-knowledge: artifact knowledgeItemId '${artifactItemId}' does not match item id '${itemId}'`
        );
        return { outcome: "failed", knowledgeItemId: itemId, diagnostics };
      }
      if (artifactItemId === undefined) {
        diagnostics.push(
          `register-knowledge: artifact has no knowledgeItemId — caller should stamp it to '${itemId}'`
        );
      }
    }

    // ── 2. Register the knowledge item. ─────────────────────────────────
    this.deps.registry.register(input.item);
    diagnostics.push(
      `register-knowledge: registered item '${itemId}' kind='${input.item.kind}' version=${input.item.version}`
    );

    // ── 3. Index the item's embedded evidence + any extra evidence. ──────
    const allEvidence: readonly Evidence[] = input.evidence
      ? [...input.item.evidence, ...input.evidence]
      : input.item.evidence;
    for (const ev of allEvidence) {
      this.deps.evidence.register(ev);
    }
    if (allEvidence.length > 0) {
      diagnostics.push(
        `register-knowledge: indexed ${allEvidence.length} evidence record(s)`
      );
    }

    // ── 4. Dispatch the artifact. ───────────────────────────────────────
    let artifactId: string | undefined;
    if (input.artifact) {
      switch (input.artifact.kind) {
        case "fact":
          this.deps.facts.register(input.artifact.fact);
          artifactId = input.artifact.fact.id;
          break;
        case "procedure":
          this.deps.procedures.register(input.artifact.procedure);
          artifactId = input.artifact.procedure.id;
          break;
        case "standard":
          this.deps.standards.register(input.artifact.standard);
          artifactId = input.artifact.standard.id;
          break;
        case "regulation":
          this.deps.regulations.register(input.artifact.regulation);
          artifactId = input.artifact.regulation.id;
          break;
        case "guideline":
          this.deps.guidelines.register(input.artifact.guideline);
          artifactId = input.artifact.guideline.id;
          break;
        default: {
          // Exhaustiveness check — should be unreachable.
          const _exhaustive: never = input.artifact;
          void _exhaustive;
        }
      }
      if (artifactId) {
        diagnostics.push(
          `register-knowledge: dispatched ${input.artifact.kind} artifact '${artifactId}'`
        );
      }
    }

    return {
      outcome: "registered",
      knowledgeItemId: itemId,
      artifactId,
      diagnostics,
    };
  }
}

/**
 * Returns the `knowledgeItemId` carried by an artifact, or `undefined` if
 * the artifact doesn't have one. Pure helper.
 */
function artifactKnowledgeItemId(
  artifact: RegisterKnowledgeArtifact
): KnowledgeItemId | undefined {
  switch (artifact.kind) {
    case "fact":
      return artifact.fact.knowledgeItemId;
    case "procedure":
      return artifact.procedure.knowledgeItemId;
    case "standard":
      return artifact.standard.knowledgeItemId;
    case "regulation":
      return artifact.regulation.knowledgeItemId;
    case "guideline":
      return artifact.guideline.knowledgeItemId;
    default: {
      const _exhaustive: never = artifact;
      void _exhaustive;
      return undefined;
    }
  }
}
