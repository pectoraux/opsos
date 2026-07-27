/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-hypothesis-registry — the
 * in-memory `HypothesisRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<HypothesisId, Hypothesis>` — canonical hypothesis records (the
 *     latest state)
 *
 * Lifecycle:
 *   - `register(hypothesis)` — replaces the record in place.
 *   - `confirm(id, evidence, now)` — produces a new hypothesis record with
 *     `status = "confirmed"`, `evidence = old.evidence ++ [evidence]`,
 *     `resolvedAt = now`, and replaces the stored record. No-op if unknown.
 *   - `refute(id, evidence, now)` — same but `status = "refuted"`.
 *
 * No `Date.now()`, no `Math.random()`. `listByStatus` returns hypotheses
 * sorted by id lexicographic ASC.
 */

import type { HypothesisId } from "@kernel/shared-kernel";
import type {
  Hypothesis,
  HypothesisStatus,
  Evidence,
} from "@kernel/shared-kernel";
import type { HypothesisRegistry } from "../domain";

export class InMemoryHypothesisRegistry implements HypothesisRegistry {
  private readonly hypotheses = new Map<HypothesisId, Hypothesis>();

  register(hypothesis: Hypothesis): void {
    this.hypotheses.set(hypothesis.id, hypothesis);
  }

  get(id: HypothesisId): Hypothesis | undefined {
    return this.hypotheses.get(id);
  }

  list(): readonly Hypothesis[] {
    return Array.from(this.hypotheses.values());
  }

  listByStatus(status: HypothesisStatus): readonly Hypothesis[] {
    const out: Hypothesis[] = [];
    for (const h of this.hypotheses.values()) {
      if (h.status === status) out.push(h);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  confirm(id: HypothesisId, evidence: Evidence, now: number): void {
    const cur = this.hypotheses.get(id);
    if (!cur) return;
    this.hypotheses.set(id, {
      ...cur,
      status: "confirmed",
      evidence: [...cur.evidence, evidence],
      resolvedAt: now,
    });
  }

  refute(id: HypothesisId, evidence: Evidence, now: number): void {
    const cur = this.hypotheses.get(id);
    if (!cur) return;
    this.hypotheses.set(id, {
      ...cur,
      status: "refuted",
      evidence: [...cur.evidence, evidence],
      resolvedAt: now,
    });
  }
}
