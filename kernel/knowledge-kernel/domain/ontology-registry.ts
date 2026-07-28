/**
 * @kernel/knowledge-kernel/domain/ontology-registry — the OntologyRegistry
 * PORT.
 *
 * An `Ontology` is a domain model — entities + relationships, expressed as
 * a flat list of `OntologyNode`s (each with an id, label, optional parent,
 * and attribute map). The Ontology Registry owns the canonical `Ontology`
 * record and provides hierarchical traversal: getNode, getChildren,
 * getAncestors.
 *
 * Ontologies are universal across operational industries: a cleaning
 * ontology might model surfaces → materials → contaminants; a medical
 * ontology might model patients → conditions → treatments; a construction
 * ontology might model structures → components → materials.
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { OntologyId } from "@kernel/shared-kernel";
import type { Ontology, OntologyNode } from "@kernel/shared-kernel";

/**
 * The OntologyRegistry PORT.
 */
export interface OntologyRegistry {
  /** Registers (or replaces) an ontology record. */
  register(ontology: Ontology): void;
  /** Returns the ontology record, or `undefined` if unknown. */
  get(id: OntologyId): Ontology | undefined;
  /** Returns all registered ontologies (insertion order). */
  list(): readonly Ontology[];
  /**
   * Returns the node with the given id within the ontology, or `undefined`
   * if the ontology or node is unknown.
   */
  getNode(ontologyId: OntologyId, nodeId: string): OntologyNode | undefined;
  /**
   * Returns all nodes whose `parentId` is `parentId` (direct children only),
   * sorted by id lexicographic. Returns `[]` if the ontology is unknown.
   */
  getChildren(ontologyId: OntologyId, parentId: string): readonly OntologyNode[];
  /**
   * Returns the ancestor chain from `nodeId` up to the root (exclusive of
   * `nodeId` itself), ordered nearest-first. Returns `[]` if the ontology or
   * node is unknown, or if the node is a root.
   */
  getAncestors(ontologyId: OntologyId, nodeId: string): readonly OntologyNode[];
}
