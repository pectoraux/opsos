/**
 * @kernel/intelligence/domain/recommendation — the Recommendation primitive and
 * the RecommendationEngine PORT.
 *
 * A Recommendation is an ADVISORY suggestion. Intelligence NEVER performs work
 * and NEVER modifies state: a Recommendation describes a proposed action, its
 * rationale, expected impact, and effort — but executing it is the caller's
 * responsibility (typically a human operator or an external automation that
 * goes through the kernel's command side).
 *
 * `RecommendationCategory` enumerates the advisory dimensions. The list is
 * additive.
 *
 * NOTE: This `Recommendation` is the intelligence-framework's own advisory
 * record, distinct from the shared-kernel operational `Recommendation`
 * primitive. They are structurally compatible but live in different modules so
 * the intelligence layer stays decoupled.
 *
 * AI providers MAY implement the RecommendationEngine port; the default
 * `DefaultRecommendationEngine` is deterministic and rule-based.
 */

/** Advisory categories for Recommendations. FROZEN. */
export type RecommendationCategory =
  | "optimization"
  | "risk-reduction"
  | "resource-utilization"
  | "policy-improvement"
  | "scheduling"
  | "knowledge-gap"
  | "capability-gap"
  | "workflow-simplification";

/** Impact / effort triage levels. */
export type ImpactLevel = "low" | "medium" | "high";
export type EffortLevel = "low" | "medium" | "high";

/** The subject a Recommendation applies to (kind + id). */
export interface RecommendationSubject {
  readonly kind: string;
  readonly id: string;
}

/**
 * Recommendation — an immutable, advisory suggestion. `priority` is a
 * non-negative number (higher = more urgent). `confidence` ∈ [0, 1].
 */
export interface Recommendation {
  readonly id: string;
  readonly category: RecommendationCategory;
  readonly subject: RecommendationSubject;
  readonly proposedAction: string;
  readonly rationale: string;
  readonly confidence: number;
  readonly impact: ImpactLevel;
  readonly effort: EffortLevel;
  readonly priority: number;
}

/**
 * RecommendationEngine — PORT. Produces a deterministic, advisory list of
 * recommendations for the given context. The list is sorted by priority
 * descending (then id ascending for stability).
 *
 * Advisory only — callers MUST NOT treat the returned list as commands.
 */
export interface RecommendationEngine {
  recommend(
    context?: Readonly<Record<string, unknown>>
  ): readonly Recommendation[];
}
