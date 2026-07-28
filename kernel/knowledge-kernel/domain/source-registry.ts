/**
 * @kernel/knowledge-kernel/domain/source-registry — the SourceRegistry PORT.
 *
 * A `Source` is the origin of a piece of knowledge — who/what authored it
 * (a regulator, a standard body, a manufacturer manual, an internal SOP
 * author). Every `Evidence` references exactly one Source. The Source
 * Registry is the kernel's canonical catalogue of provenance origins; it
 * carries no behaviour, just lookup.
 *
 * Source types are universal across every operational industry:
 *   regulation · standard · manual · sop · best-practice · training ·
 *   research · manufacturer · authority · internal
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 * Source records are immutable; re-registering the same `sourceId` replaces
 * the prior record in place.
 */

import type { SourceId } from "@kernel/shared-kernel";
import type { Source, SourceType } from "@kernel/shared-kernel";

/**
 * The SourceRegistry PORT.
 */
export interface SourceRegistry {
  /** Registers (or replaces) a source record. */
  register(source: Source): void;
  /** Returns the source record, or `undefined` if unknown. */
  get(id: SourceId): Source | undefined;
  /** Returns all registered sources (insertion order). */
  list(): readonly Source[];
  /** Returns all sources of the given type, sorted by id lexicographic. */
  listByType(type: SourceType): readonly Source[];
}
