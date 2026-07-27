/**
 * @kernel/domain-modeling/domain/relationship — `RelationshipDefinition` +
 * the closed set of relationship kinds.
 *
 * A relationship is a typed, directional edge between two EntityType ids.
 * Together with `AttributeDefinition`s, relationships describe the *graph
 * structure* of a domain.
 *
 * The kernel never learns what "building contains room" or "patient located_in
 * bed" means. A domain definition DECLARES these via `RelationshipDefinition`s;
 * the compiler validates runtime entity instances against them.
 *
 * Relationship kinds are a closed, universal set (ADR-0018 — Domain Modeling
 * Framework). They are the only structural verbs the kernel understands:
 *
 *   `contains`       — A physically/logically contains B (building→room).
 *   `located_in`     — A is situated inside B (room→building; bed→room).
 *   `requires`       — A needs B present to function (task→tool).
 *   `produces`       — A emits B as output (process→waste stream).
 *   `consumes`       — A takes B as input (machine→power).
 *   `depends_on`     — A's existence implies B's (wing→building).
 *   `owned_by`       — A is owned by B (asset→organization).
 *   `assigned_to`    — A is assigned to B (worker→shift).
 *   `connected_to`   — A is physically/logically adjacent to B (room→room).
 *
 * Cardinality governs how many target entities a source may have:
 *   `one-to-one`, `one-to-many`, `many-to-many`.
 *
 * A bidirectional relationship carries an `inverseName` so the target can
 * traverse back. The compiler does NOT auto-synthesize inverse relationships
 * — the domain definition is the single source of truth.
 *
 * Determinism: pure data. No `Date.now()`, no `Math.random()`.
 */

/**
 * The closed set of relationship kinds. Adding a new kind requires a kernel
 * change.
 */
export type RelationshipKind =
  | "contains"
  | "located_in"
  | "requires"
  | "produces"
  | "consumes"
  | "depends_on"
  | "owned_by"
  | "assigned_to"
  | "connected_to";

/**
 * Cardinality of a relationship — governs how many target entities a source
 * may have.
 */
export type Cardinality =
  | "one-to-one"
  | "one-to-many"
  | "many-to-many";

/**
 * The definition of a typed, directional edge between two EntityType ids.
 *
 *   `id`                  — unique within the domain. Referenced from
 *                           `EntityType.relationships`.
 *   `name`                — human-readable name (e.g. "contains").
 *   `sourceEntityType`    — the source EntityType id (must exist in the
 *                           same domain).
 *   `targetEntityType`    — the target EntityType id (must exist in the
 *                           same domain).
 *   `kind`                — one of `RelationshipKind`.
 *   `cardinality`         — one of `Cardinality`.
 *   `bidirectional`       — whether the target can traverse back to the
 *                           source. When `true`, `inverseName` SHOULD be set.
 *   `inverseName`         — the name of the reverse traversal (e.g.
 *                           `contained_in` for `contains`). Optional but
 *                           recommended when `bidirectional === true`.
 *   `description`         — optional human-readable description.
 */
export interface RelationshipDefinition {
  readonly id: string;
  readonly name: string;
  readonly sourceEntityType: string;
  readonly targetEntityType: string;
  readonly kind: RelationshipKind;
  readonly cardinality: Cardinality;
  readonly bidirectional: boolean;
  readonly inverseName?: string;
  readonly description?: string;
}
