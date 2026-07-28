/**
 * @kernel/intelligence/domain/explanation — the Explanation primitive and the
 * ExplanationEngine PORT.
 *
 * An Explanation answers "WHY did the kernel decide / select / schedule / fail
 * X?". It is DATA — never a function — so it can be persisted, transported, and
 * audited. Intelligence NEVER performs work and NEVER modifies state: an
 * Explanation is a read-only justification produced from the intelligence graph
 * + operational context.
 *
 * `ExplanationKind` enumerates the kernel decision classes that can be
 * explained. The list is additive (new kinds require a new version).
 *
 * AI providers (GPT, in-house reasoning engines, …) MAY implement the
 * ExplanationEngine port; the kernel never calls AI directly — it calls the
 * intelligence framework which MAY delegate to an AI-backed engine. The default
 * engine (`DefaultExplanationEngine`) is deterministic and rule-based, suitable
 * for self-test and as a baseline.
 */

/** Kinds of kernel decisions / subjects an Explanation can justify. FROZEN. */
export type ExplanationKind =
  | "compiler-decision"
  | "policy-evaluation"
  | "resource-selection"
  | "coordination"
  | "scheduling"
  | "package-validation"
  | "protocol-installation"
  | "conformance-failure";

/**
 * An alternative path the kernel could have taken but rejected. Surfacing
 * alternatives is what makes an Explanation trustworthy — the reader can see
 * what was considered and dismissed, not just the chosen outcome.
 */
export interface AlternativePath {
  readonly description: string;
  readonly outcome: string;
  readonly rejectedReason: string;
}

/** A single piece of evidence cited by an Explanation. */
export interface ExplanationEvidence {
  readonly source: string;
  readonly reference: string;
  readonly confidence: number;
}

/** Provenance — which events / input hash produced this explanation. */
export interface ExplanationProvenance {
  readonly sourceEventIds: readonly string[];
  readonly inputHash?: string;
}

/**
 * Explanation — the immutable justification for a kernel decision. All fields
 * are plain data. `confidence` ∈ [0, 1].
 */
export interface Explanation {
  readonly kind: ExplanationKind;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly rationale: string;
  readonly evidence: readonly ExplanationEvidence[];
  readonly provenance: ExplanationProvenance;
  readonly confidence: number;
  readonly assumptions: readonly string[];
  readonly alternativePaths: readonly AlternativePath[];
}

/**
 * ExplanationEngine — PORT. Produces an Explanation for a given subject.
 *
 * `context` is an opaque bag the engine may consult (e.g. graph snapshot,
 * decision inputs, event trace). Implementations MUST be deterministic given
 * identical inputs.
 */
export interface ExplanationEngine {
  explain(
    kind: ExplanationKind,
    subjectKind: string,
    subjectId: string,
    context?: Readonly<Record<string, unknown>>
  ): Explanation;
}
