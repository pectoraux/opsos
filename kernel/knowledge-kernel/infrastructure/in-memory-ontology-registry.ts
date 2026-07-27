/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-ontology-registry — the
 * in-memory `OntologyRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<OntologyId, Ontology>` — canonical ontology records
 *   - `Map<OntologyId, Map<string, OntologyNode>>` — per-ontology node lookup
 *   - `Map<OntologyId, Map<string, OntologyNode[]>>` — per-ontology children
 *     (parentId → direct children)
 *
 * No `Date.now()`, no `Math.random()`. `getChildren` returns nodes sorted by
 * id lexicographic ASC. `getAncestors` walks up `parentId` links.
 */

import type { OntologyId } from "@kernel/shared-kernel";
import type { Ontology, OntologyNode } from "@kernel/shared-kernel";
import type { OntologyRegistry } from "../domain";

export class InMemoryOntologyRegistry implements OntologyRegistry {
  private readonly ontologies = new Map<OntologyId, Ontology>();
  private readonly nodeMaps = new Map<OntologyId, Map<string, OntologyNode>>();
  private readonly childrenMaps = new Map<
    OntologyId,
    Map<string, OntologyNode[]>
  >();

  register(ontology: Ontology): void {
    this.ontologies.set(ontology.id, ontology);
    const nodes = new Map<string, OntologyNode>();
    const children = new Map<string, OntologyNode[]>();
    for (const node of ontology.nodes) {
      nodes.set(node.id, node);
      const parent = node.parentId ?? "__root__";
      let list = children.get(parent);
      if (!list) {
        list = [];
        children.set(parent, list);
      }
      list.push(node);
    }
    this.nodeMaps.set(ontology.id, nodes);
    this.childrenMaps.set(ontology.id, children);
  }

  get(id: OntologyId): Ontology | undefined {
    return this.ontologies.get(id);
  }

  list(): readonly Ontology[] {
    return Array.from(this.ontologies.values());
  }

  getNode(ontologyId: OntologyId, nodeId: string): OntologyNode | undefined {
    return this.nodeMaps.get(ontologyId)?.get(nodeId);
  }

  getChildren(ontologyId: OntologyId, parentId: string): readonly OntologyNode[] {
    const children = this.childrenMaps.get(ontologyId);
    if (!children) return [];
    const list = children.get(parentId);
    if (!list) return [];
    const out = list.slice();
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  getAncestors(ontologyId: OntologyId, nodeId: string): readonly OntologyNode[] {
    const nodes = this.nodeMaps.get(ontologyId);
    if (!nodes) return [];
    const out: OntologyNode[] = [];
    let current = nodes.get(nodeId);
    if (!current) return [];
    const seen = new Set<string>([nodeId]);
    while (current && current.parentId !== undefined) {
      if (seen.has(current.parentId)) break; // defensive: cycle break
      seen.add(current.parentId);
      const parent = nodes.get(current.parentId);
      if (!parent) break;
      out.push(parent);
      current = parent;
    }
    return out;
  }
}
