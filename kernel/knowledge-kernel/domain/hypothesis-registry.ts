/**
 * @kernel/knowledge-kernel/domain/hypothesis-registry — the HypothesisRegistry
 * PORT.
 *
 * A `Hypothesis` is a testable claim that MAY become a fact — proposed,
 * tested, then confirmed or refuted. The Hypothesis Registry owns the
 * canonical `Hypothesis` record and provides lifecycle transitions
 * (`confirm` / `refute`) that append evidence and stamp `resolvedAt`.
 *
 * Hypotheses are universal across operational industries: "this cleaning
 * agent removes this biofilm within 5 minutes" (cleaning), "this medication
 * is contraindicated for patients with this condition" (medical), "this
 * material fails under this load" (construction).
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 * All time flows through the `now` argument supplied to `confirm` /
 * `refute`.
 */

import type { HypothesisId } from "@kernel/shared-kernel";
import type {
  Hypothesis,
  HypothesisStatus,
  Evidence,
} from "@kernel/shared-kernel";

/**
 * The HypothesisRegistry PORT.
 */
export interface HypothesisRegistry {
  /** Registers (or replaces) a hypothesis record. */
  register(hypothesis: Hypothesis): void;
  /** Returns the hypothesis record, or `undefined` if unknown. */
  get(id: HypothesisId): Hypothesis | undefined;
  /** Returns all hypotheses (insertion order). */
  list(): readonly Hypothesis[];
  /**
   * Returns all hypotheses whose `status` matches, sorted by id
   * lexicographic.
   */
  listByStatus(status: HypothesisStatus): readonly Hypothesis[];
  /**
   * Marks `id` as confirmed. Produces a new hypothesis record with
   * `status = "confirmed"`, `evidence = old.evidence ++ [evidence]`,
   * `resolvedAt = now`. No-op if `id` is unknown. Returns nothing — callers
   * re-fetch via `get` if they need the updated record.
   */
  confirm(id: HypothesisId, evidence: Evidence, now: number): void;
  /**
   * Marks `id` as refuted. Produces a new hypothesis record with
   * `status = "refuted"`, `evidence = old.evidence ++ [evidence]`,
   * `resolvedAt = now`. No-op if `id` is unknown.
   */
  refute(id: HypothesisId, evidence: Evidence, now: number): void;
}
