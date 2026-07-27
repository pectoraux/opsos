/**
 * @kernel/domain-modeling/domain/attribute — Attribute types + the
 * `AttributeDefinition` value object.
 *
 * An attribute is a typed slot on an `EntityType`. Together with the
 * `RelationshipDefinition`, attributes describe the *shape* of every entity
 * in a domain — without committing the kernel to any industry's vocabulary.
 *
 * The kernel never learns what "room.area" or "patient.temperature" is. A
 * domain definition DECLARES these via `AttributeDefinition`s; the compiler
 * validates runtime entity instances against them.
 *
 * The attribute type set is closed and universal:
 *   - `string`, `number`, `boolean`, `enum`   — primitives
 *   - `measurement`                            — a typed measurement (links to
 *                                               a `DomainMeasurementDefinition`
 *                                               by metric name)
 *   - `reference`                              — a reference to ANOTHER entity
 *                                               instance (typed by
 *                                               `referenceEntityType`)
 *   - `location`                               — a Location primitive ref
 *   - `resource`                               — a ResourceRecord ref
 *   - `knowledge-reference`                    — a KnowledgeItem ref (typed by
 *                                               `knowledgeItemKind`)
 *   - `capability-reference`                   — a Capability ref (typed by
 *                                               `capabilityType`)
 *
 * Every attribute is immutable, serialisable, deterministic. No `Date.now()`,
 * no `Math.random()`.
 */

/**
 * The closed set of attribute types the domain framework understands. Adding
 * a new type requires a kernel change (deliberate friction — keeps the
 * attribute algebra small and predictable).
 */
export type AttributeType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "measurement"
  | "reference"
  | "location"
  | "resource"
  | "knowledge-reference"
  | "capability-reference";

/**
 * The definition of a single attribute on an `EntityType`.
 *
 *   `name`                 — the attribute name (unique within an EntityType).
 *   `type`                 — one of `AttributeType`.
 *   `required`             — whether the attribute must be present on a valid
 *                            entity instance.
 *   `default`              — optional default value applied when an instance
 *                            omits the attribute. Should be compatible with
 *                            `type` (validated by the application layer).
 *   `enumValues`           — required for `enum` type; the closed set of
 *                            allowed string values.
 *   `measurementMetric`    — required for `measurement` type; the metric name
 *                            matching a `DomainMeasurementDefinition.metric`.
 *   `referenceEntityType`  — required for `reference` type; the target
 *                            EntityType id (must exist in the same domain).
 *   `resourceType`         — required for `resource` type; the resource-type
 *                            string the referenced ResourceRecord must have.
 *   `knowledgeItemKind`    — required for `knowledge-reference` type; the
 *                            KnowledgeKind the referenced item must have.
 *   `capabilityType`       — required for `capability-reference` type; the
 *                            capability-type string the referenced Capability
 *                            must have.
 *   `description`          — optional human-readable description.
 */
export interface AttributeDefinition {
  readonly name: string;
  readonly type: AttributeType;
  readonly required: boolean;
  readonly default?: unknown;
  readonly enumValues?: readonly string[];
  readonly measurementMetric?: string;
  readonly referenceEntityType?: string;
  readonly resourceType?: string;
  readonly knowledgeItemKind?: string;
  readonly capabilityType?: string;
  readonly description?: string;
}

/**
 * The attributes every `AttributeType` is REQUIRED to carry. Used by the
 * application-layer validator to surface malformed definitions early.
 *
 *   `enum`                → `enumValues` (non-empty)
 *   `measurement`         → `measurementMetric`
 *   `reference`           → `referenceEntityType`
 *   `resource`            → `resourceType`
 *   `knowledge-reference` → `knowledgeItemKind`
 *   `capability-reference`→ `capabilityType`
 *
 * Primitive types (`string`, `number`, `boolean`) have no required slots.
 */
export const REQUIRED_ATTRIBUTE_FIELDS: Readonly<
  Record<AttributeType, readonly string[]>
> = Object.freeze({
  string: [],
  number: [],
  boolean: [],
  enum: ["enumValues"],
  measurement: ["measurementMetric"],
  reference: ["referenceEntityType"],
  location: [],
  resource: ["resourceType"],
  "knowledge-reference": ["knowledgeItemKind"],
  "capability-reference": ["capabilityType"],
});
