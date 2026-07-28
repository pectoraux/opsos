/**
 * @kernel/knowledge-kernel/domain/evidence-registry — the EvidenceRegistry PORT.
 *
 * `Evidence` substantiates a fact, procedure, or hypothesis. Each piece of
 * evidence references a `Source` and carries a caller-supplied `confidence`
 * in `[0, 1]`. The Evidence Registry is the kernel's canonical ledger of
 * substantiation; it lets the compiler / coordination / resource kernels
 * answer "why should we trust this knowledge?" without coupling to the
 * knowledge items themselves.
 *
 * Evidence types are universal:
 *   document · citation · test · observation · measurement · expert
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { EvidenceId, SourceId } from "@kernel/shared-kernel";
import type { Evidence } from "@kernel/shared-kernel";

/**
 * The EvidenceRegistry PORT.
 */
export interface EvidenceRegistry {
  /** Registers (or replaces) an evidence record. */
  register(evidence: Evidence): void;
  /** Returns the evidence record, or `undefined` if unknown. */
  get(id: EvidenceId): Evidence | undefined;
  /** Returns all evidence records sourced from `sourceId`, sorted by id. */
  listBySource(sourceId: SourceId): readonly Evidence[];
}
