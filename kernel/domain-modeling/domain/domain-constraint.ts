/**
 * @kernel/domain-modeling/domain/domain-constraint — `DomainConstraint` +
 * the closed set of constraint kinds.
 *
 * A domain constraint is a declarative, serialisable rule that the compiler
 * validates entity instances against. Constraints are DATA, not code — they
 * are evaluated by the compiler/policy layer, never by the domain framework
 * itself. This keeps the framework pure and replayable.
 *
 * The kernel never learns what "every room must_have a floor attribute" or
 * "patient cannot_have a duplicate MRN" means. A domain definition DECLARES
 * these via `DomainConstraint`s; the compiler enforces them.
 *
 * Constraint kinds (closed, universal):
 *
 *   `must_have`       — the target EntityType must carry the `attributeRef`
 *                       attribute (or, when `attributeRef` is omitted, the
 *                       constraint is interpreted by the compiler per
 *                       `params`).
 *   `cannot_have`     — the target EntityType must NOT carry the
 *                       `attributeRef` attribute.
 *   `requires`        — the target EntityType requires the entity referenced
 *                       by `params.targetEntityType` (or another entity type)
 *                       to be present in the same domain instance.
 *   `exclusive_with`  — the target EntityType cannot co-exist with the
 *                       entity type named in `params.withEntityType`.
 *   `minimum`         — the numeric attribute `attributeRef` must be ≥
 *                       `params.value`.
 *   `maximum`         — the numeric attribute `attributeRef` must be ≤
 *                       `params.value`.
 *
 * The `params` bag is intentionally open (`Record<string, unknown>`) — kinds
 * the kernel does not natively interpret default to "satisfied" with a
 * diagnostic warning, so protocols can ship domain constraints that future
 * compilers will understand.
 *
 * Determinism: pure data. No `Date.now()`, no `Math.random()`.
 */

/**
 * The closed set of constraint kinds. Adding a new kind requires a kernel
 * change.
 */
export type ConstraintKind =
  | "must_have"
  | "cannot_have"
  | "requires"
  | "exclusive_with"
  | "minimum"
  | "maximum";

/**
 * A declarative, serialisable constraint on an EntityType.
 *
 *   `id`                 — unique within the domain.
 *   `kind`               — one of `ConstraintKind`.
 *   `targetEntityType`   — the EntityType id the constraint applies to.
 *   `attributeRef`       — the attribute name the constraint targets. Used
 *                          by `must_have`, `cannot_have`, `minimum`,
 *                          `maximum`. Omitted for `requires` /
 *                          `exclusive_with` (which target other entity
 *                          types via `params`).
 *   `params`             — the constraint parameters. Open bag — each
 *                          `ConstraintKind` interprets it differently.
 *                          E.g. `minimum` reads `params.value` as the lower
 *                          bound; `exclusive_with` reads
 *                          `params.withEntityType` as the conflicting type.
 *   `description`        — optional human-readable description.
 */
export interface DomainConstraint {
  readonly id: string;
  readonly kind: ConstraintKind;
  readonly targetEntityType: string;
  readonly attributeRef?: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly description?: string;
}
