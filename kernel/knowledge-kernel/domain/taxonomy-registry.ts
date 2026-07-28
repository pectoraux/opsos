/**
 * @kernel/knowledge-kernel/domain/taxonomy-registry — the TaxonomyRegistry
 * PORT.
 *
 * A `Taxonomy` is a classification tree — a root `TaxonomyNode` with
 * recursive children, each carrying an optional `code` (e.g. NAICS, GHS,
 * ICD-10, UN-Hazard-Class). The Taxonomy Registry owns the canonical
 * `Taxonomy` record and provides lookup-by-code and path-from-root queries.
 *
 * Taxonomies are universal across operational industries: hazard classes
 * (GHS), medical conditions (ICD), industry sectors (NAICS), building
 * occupancy classes (IBC), food categories (GS1).
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { TaxonomyId } from "@kernel/shared-kernel";
import type { Taxonomy, TaxonomyNode } from "@kernel/shared-kernel";

/**
 * The TaxonomyRegistry PORT.
 */
export interface TaxonomyRegistry {
  /** Registers (or replaces) a taxonomy record. */
  register(taxonomy: Taxonomy): void;
  /** Returns the taxonomy record, or `undefined` if unknown. */
  get(id: TaxonomyId): Taxonomy | undefined;
  /** Returns all registered taxonomies (insertion order). */
  list(): readonly Taxonomy[];
  /**
   * Searches the taxonomy for the first node (DFS, pre-order from root)
   * whose `code` matches `code` exactly (case-sensitive). Returns
   * `undefined` if the taxonomy is unknown or no node has the code.
   */
  findNode(taxonomyId: TaxonomyId, code: string): TaxonomyNode | undefined;
  /**
   * Returns the path from the root to `nodeId` (inclusive of `nodeId`),
   * ordered root-first. Returns `[]` if the taxonomy is unknown or `nodeId`
   * is not in the tree.
   */
  getPath(taxonomyId: TaxonomyId, nodeId: string): readonly TaxonomyNode[];
}
