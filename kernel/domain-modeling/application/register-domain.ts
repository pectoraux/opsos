/**
 * @kernel/domain-modeling/application/register-domain — the use-case that
 * validates a domain definition and registers it atomically.
 *
 * A `DomainDefinition` is a complex aggregate: entity types reference state
 * machines and measurements; relationships reference entity types;
 * constraints reference entity types and attributes; attributes reference
 * measurements and other entity types. Registering an inconsistent aggregate
 * leaves the kernel in a broken state — every subsequent lookup could fail.
 *
 * This use-case is THE sanctioned write path: given a `DomainDefinition`, it
 *   1. validates the aggregate for internal consistency (unique ids,
 *      cross-references resolve, state machines are well-formed);
 *   2. if validation passes, registers it via `DomainRegistry.register`;
 *   3. returns a structured result with diagnostics.
 *
 * Atomicity: this use-case does NOT roll back partial registrations. The
 * underlying `register` call is a single pure data-structure mutation and
 * cannot fail; the use-case reports `outcome: "failed"` only when input
 * validation fails BEFORE any registry mutation. Once validation passes,
 * registration succeeds.
 *
 * Validation rules (each violation produces a diagnostic and aborts):
 *
 *   Domain-level:
 *     - `id` non-empty, `name` non-empty, `version` > 0.
 *     - `entityTypes[].id` unique within the domain.
 *     - `entityTypes[].name` unique within the domain.
 *     - `relationships[].id` unique within the domain.
 *     - `stateMachines[].id` unique within the domain.
 *     - `constraints[].id` unique within the domain.
 *     - `measurements[].metric` unique within the domain.
 *
 *   Cross-references (must resolve to an existing id within the domain):
 *     - `relationships[].sourceEntityType` → an `entityTypes[].id`.
 *     - `relationships[].targetEntityType` → an `entityTypes[].id`.
 *     - `entityTypes[].relationships[]` → a `relationships[].id` whose
 *       source OR target entity type is this entity type.
 *     - `entityTypes[].stateMachineId` (when set) → a `stateMachines[].id`.
 *     - `constraints[].targetEntityType` → an `entityTypes[].id`.
 *     - `constraints[].attributeRef` (when set) → an attribute name on the
 *       target EntityType.
 *     - For each `AttributeDefinition` of type `measurement`:
 *       `measurementMetric` → a `measurements[].metric`.
 *     - For each `AttributeDefinition` of type `reference`:
 *       `referenceEntityType` → an `entityTypes[].id`.
 *
 *   Attribute shape (per `REQUIRED_ATTRIBUTE_FIELDS`):
 *     - For each attribute, the required fields for its `type` are present.
 *
 *   State machine well-formedness:
 *     - `states` non-empty.
 *     - `initial` ∈ `states`.
 *     - every `terminal` ∈ `states`.
 *     - every `transition.from` ∈ `states` and every `transition.to` ∈
 *       `states`.
 *
 * Determinism: identical inputs + identical registry → identical outputs.
 * No `Date.now()`, no `Math.random()`. Validation order is deterministic
 * (declared order); the FIRST violation aborts and is reported.
 */

import { ValidationError } from "@kernel/shared-kernel";
import type { DomainDefinition } from "../domain/domain-definition";
import type { EntityType } from "../domain/entity-type";
import { REQUIRED_ATTRIBUTE_FIELDS } from "../domain/attribute";
import type { RelationshipDefinition } from "../domain/relationship";
import type { StateMachineDefinition } from "../domain/state-machine";
import type { DomainRegistry } from "../domain/domain-registry";

/**
 * The input to `RegisterDomain.execute`. Pure data.
 */
export interface RegisterDomainInput {
  readonly domain: DomainDefinition;
  /**
   * Clock-sourced epoch-millis. Currently informational — the registry does
   * not stamp `now` onto the domain (the domain carries its own `version`).
   * Present for symmetry with other kernel use-cases and future use.
   */
  readonly now?: number;
}

/**
 * The outcome of `RegisterDomain.execute`.
 *   - `"registered"` — domain validated and registered.
 *   - `"failed"`     — validation failed; the registry was NOT mutated.
 */
export type RegisterDomainOutcome = "registered" | "failed";

/**
 * A single validation diagnostic. `field` is a dotted path into the domain
 * aggregate (e.g. `"entityTypes[2].attributes[1].measurementMetric"`).
 */
export interface RegisterDomainDiagnostic {
  readonly field: string;
  readonly reason: string;
}

/**
 * The result of `RegisterDomain.execute`.
 */
export interface RegisterDomainResult {
  readonly outcome: RegisterDomainOutcome;
  readonly domainId: string;
  readonly diagnostics: readonly RegisterDomainDiagnostic[];
}

/**
 * Constructor dependencies. The use-case needs the `DomainRegistry` it
 * registers into.
 */
export interface RegisterDomainDeps {
  readonly registry: DomainRegistry;
}

/**
 * The use-case PORT.
 */
export interface RegisterDomain {
  execute(input: RegisterDomainInput): RegisterDomainResult;
}

/**
 * Default implementation.
 */
export class RegisterDomainUseCase implements RegisterDomain {
  constructor(private readonly deps: RegisterDomainDeps) {}

  execute(input: RegisterDomainInput): RegisterDomainResult {
    const diags: RegisterDomainDiagnostic[] = [];
    const d = input.domain;

    // ── 1. Domain-level scalar validation. ────────────────────────────────
    if (!d.id || typeof d.id !== "string") {
      diags.push({ field: "id", reason: "domain id must be a non-empty string" });
      return fail(d.id, diags);
    }
    if (!d.name || typeof d.name !== "string") {
      diags.push({ field: "name", reason: "domain name must be a non-empty string" });
      return fail(d.id, diags);
    }
    if (!Number.isInteger(d.version) || d.version <= 0) {
      diags.push({ field: "version", reason: "domain version must be a positive integer" });
      return fail(d.id, diags);
    }

    // ── 2. Index children for O(1) cross-reference resolution. ────────────
    const entityTypeIds = new Set<string>();
    const entityTypeNames = new Set<string>();
    const entityTypesById = new Map<string, EntityType>();
    const entityTypesByName = new Map<string, EntityType>();
    for (let i = 0; i < d.entityTypes.length; i++) {
      const et = d.entityTypes[i];
      if (!et.id) {
        diags.push({ field: `entityTypes[${i}].id`, reason: "entity type id must be a non-empty string" });
        return fail(d.id, diags);
      }
      if (entityTypeIds.has(et.id)) {
        diags.push({ field: `entityTypes[${i}].id`, reason: `duplicate entity type id '${et.id}'` });
        return fail(d.id, diags);
      }
      if (!et.name) {
        diags.push({ field: `entityTypes[${i}].name`, reason: "entity type name must be a non-empty string" });
        return fail(d.id, diags);
      }
      if (entityTypeNames.has(et.name)) {
        diags.push({ field: `entityTypes[${i}].name`, reason: `duplicate entity type name '${et.name}'` });
        return fail(d.id, diags);
      }
      entityTypeIds.add(et.id);
      entityTypeNames.add(et.name);
      entityTypesById.set(et.id, et);
      entityTypesByName.set(et.name, et);
    }

    const relationshipIds = new Set<string>();
    const relationshipsById = new Map<string, RelationshipDefinition>();
    for (let i = 0; i < d.relationships.length; i++) {
      const r = d.relationships[i];
      if (!r.id) {
        diags.push({ field: `relationships[${i}].id`, reason: "relationship id must be a non-empty string" });
        return fail(d.id, diags);
      }
      if (relationshipIds.has(r.id)) {
        diags.push({ field: `relationships[${i}].id`, reason: `duplicate relationship id '${r.id}'` });
        return fail(d.id, diags);
      }
      relationshipIds.add(r.id);
      relationshipsById.set(r.id, r);
    }

    const stateMachineIds = new Set<string>();
    const stateMachinesById = new Map<string, StateMachineDefinition>();
    for (let i = 0; i < d.stateMachines.length; i++) {
      const sm = d.stateMachines[i];
      if (!sm.id) {
        diags.push({ field: `stateMachines[${i}].id`, reason: "state machine id must be a non-empty string" });
        return fail(d.id, diags);
      }
      if (stateMachineIds.has(sm.id)) {
        diags.push({ field: `stateMachines[${i}].id`, reason: `duplicate state machine id '${sm.id}'` });
        return fail(d.id, diags);
      }
      stateMachineIds.add(sm.id);
      stateMachinesById.set(sm.id, sm);
    }

    const constraintIds = new Set<string>();
    for (let i = 0; i < d.constraints.length; i++) {
      const c = d.constraints[i];
      if (!c.id) {
        diags.push({ field: `constraints[${i}].id`, reason: "constraint id must be a non-empty string" });
        return fail(d.id, diags);
      }
      if (constraintIds.has(c.id)) {
        diags.push({ field: `constraints[${i}].id`, reason: `duplicate constraint id '${c.id}'` });
        return fail(d.id, diags);
      }
      constraintIds.add(c.id);
    }

    const measurementMetrics = new Set<string>();
    for (let i = 0; i < d.measurements.length; i++) {
      const m = d.measurements[i];
      if (!m.metric) {
        diags.push({ field: `measurements[${i}].metric`, reason: "measurement metric must be a non-empty string" });
        return fail(d.id, diags);
      }
      if (measurementMetrics.has(m.metric)) {
        diags.push({ field: `measurements[${i}].metric`, reason: `duplicate measurement metric '${m.metric}'` });
        return fail(d.id, diags);
      }
      measurementMetrics.add(m.metric);
    }

    // ── 3. State machine well-formedness. ─────────────────────────────────
    for (let i = 0; i < d.stateMachines.length; i++) {
      const sm = d.stateMachines[i];
      const base = `stateMachines[${i}]`;
      if (sm.states.length === 0) {
        diags.push({ field: `${base}.states`, reason: "state machine must declare at least one state" });
        return fail(d.id, diags);
      }
      const stateSet = new Set(sm.states);
      if (!stateSet.has(sm.initial)) {
        diags.push({ field: `${base}.initial`, reason: `initial state '${sm.initial}' is not in states` });
        return fail(d.id, diags);
      }
      for (let j = 0; j < sm.terminal.length; j++) {
        if (!stateSet.has(sm.terminal[j])) {
          diags.push({ field: `${base}.terminal[${j}]`, reason: `terminal state '${sm.terminal[j]}' is not in states` });
          return fail(d.id, diags);
        }
      }
      for (let j = 0; j < sm.transitions.length; j++) {
        const t = sm.transitions[j];
        if (!stateSet.has(t.from)) {
          diags.push({ field: `${base}.transitions[${j}].from`, reason: `transition.from '${t.from}' is not in states` });
          return fail(d.id, diags);
        }
        if (!stateSet.has(t.to)) {
          diags.push({ field: `${base}.transitions[${j}].to`, reason: `transition.to '${t.to}' is not in states` });
          return fail(d.id, diags);
        }
      }
    }

    // ── 4. Entity type shape + cross-references. ──────────────────────────
    for (let i = 0; i < d.entityTypes.length; i++) {
      const et = d.entityTypes[i];
      const base = `entityTypes[${i}]`;

      // 4a. State machine ref resolves.
      if (et.stateMachineId !== undefined) {
        if (!stateMachineIds.has(et.stateMachineId)) {
          diags.push({ field: `${base}.stateMachineId`, reason: `state machine '${et.stateMachineId}' not found in domain` });
          return fail(d.id, diags);
        }
      }

      // 4b. Relationship refs resolve AND mention this entity type.
      for (let j = 0; j < et.relationships.length; j++) {
        const rid = et.relationships[j];
        const r = relationshipsById.get(rid);
        if (!r) {
          diags.push({ field: `${base}.relationships[${j}]`, reason: `relationship '${rid}' not found in domain` });
          return fail(d.id, diags);
        }
        if (r.sourceEntityType !== et.id && r.targetEntityType !== et.id) {
          diags.push({
            field: `${base}.relationships[${j}]`,
            reason: `relationship '${rid}' neither source nor target is '${et.id}'`,
          });
          return fail(d.id, diags);
        }
      }

      // 4c. Attributes shape + cross-references.
      const attrNames = new Set<string>();
      for (let j = 0; j < et.attributes.length; j++) {
        const a = et.attributes[j];
        const ab = `${base}.attributes[${j}]`;
        if (!a.name) {
          diags.push({ field: `${ab}.name`, reason: "attribute name must be a non-empty string" });
          return fail(d.id, diags);
        }
        if (attrNames.has(a.name)) {
          diags.push({ field: `${ab}.name`, reason: `duplicate attribute name '${a.name}' on entity type '${et.id}'` });
          return fail(d.id, diags);
        }
        attrNames.add(a.name);

        // Required fields per type.
        const required = REQUIRED_ATTRIBUTE_FIELDS[a.type];
        if (required) {
          for (const f of required) {
            const v = (a as unknown as Record<string, unknown>)[f];
            if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
              diags.push({ field: `${ab}.${f}`, reason: `attribute type '${a.type}' requires '${f}'` });
              return fail(d.id, diags);
            }
          }
        }
        // Cross-references for typed attributes.
        if (a.type === "measurement") {
          if (!measurementMetrics.has(a.measurementMetric!)) {
            diags.push({ field: `${ab}.measurementMetric`, reason: `measurement metric '${a.measurementMetric}' not found in domain` });
            return fail(d.id, diags);
          }
        }
        if (a.type === "reference") {
          if (!entityTypeIds.has(a.referenceEntityType!)) {
            diags.push({ field: `${ab}.referenceEntityType`, reason: `reference entity type '${a.referenceEntityType}' not found in domain` });
            return fail(d.id, diags);
          }
        }
      }
    }

    // ── 5. Relationship cross-references. ─────────────────────────────────
    for (let i = 0; i < d.relationships.length; i++) {
      const r = d.relationships[i];
      const base = `relationships[${i}]`;
      if (!entityTypeIds.has(r.sourceEntityType)) {
        diags.push({ field: `${base}.sourceEntityType`, reason: `source entity type '${r.sourceEntityType}' not found in domain` });
        return fail(d.id, diags);
      }
      if (!entityTypeIds.has(r.targetEntityType)) {
        diags.push({ field: `${base}.targetEntityType`, reason: `target entity type '${r.targetEntityType}' not found in domain` });
        return fail(d.id, diags);
      }
      if (r.bidirectional && (!r.inverseName || r.inverseName.length === 0)) {
        diags.push({ field: `${base}.inverseName`, reason: "bidirectional relationship should declare inverseName" });
        return fail(d.id, diags);
      }
    }

    // ── 6. Constraint cross-references. ───────────────────────────────────
    for (let i = 0; i < d.constraints.length; i++) {
      const c = d.constraints[i];
      const base = `constraints[${i}]`;
      const target = entityTypesById.get(c.targetEntityType);
      if (!target) {
        diags.push({ field: `${base}.targetEntityType`, reason: `target entity type '${c.targetEntityType}' not found in domain` });
        return fail(d.id, diags);
      }
      if (c.attributeRef !== undefined) {
        const attrExists = target.attributes.some((a) => a.name === c.attributeRef);
        if (!attrExists) {
          diags.push({ field: `${base}.attributeRef`, reason: `attribute '${c.attributeRef}' not found on entity type '${c.targetEntityType}'` });
          return fail(d.id, diags);
        }
      }
      // kind-specific params sanity (informational — does not abort).
      if ((c.kind === "minimum" || c.kind === "maximum") && c.params.value === undefined) {
        diags.push({ field: `${base}.params.value`, reason: `constraint kind '${c.kind}' expects params.value` });
        return fail(d.id, diags);
      }
      if (c.kind === "exclusive_with" && c.params.withEntityType === undefined) {
        diags.push({ field: `${base}.params.withEntityType`, reason: `constraint kind 'exclusive_with' expects params.withEntityType` });
        return fail(d.id, diags);
      }
      if (c.kind === "requires" && c.params.withEntityType === undefined && c.attributeRef === undefined) {
        diags.push({ field: `${base}.params`, reason: `constraint kind 'requires' expects params.withEntityType or attributeRef` });
        return fail(d.id, diags);
      }
    }

    // ── 7. Register. ──────────────────────────────────────────────────────
    this.deps.registry.register(d);
    diags.push({
      field: "domain",
      reason: `registered domain '${d.id}' v${d.version} with ${d.entityTypes.length} entity type(s), ${d.relationships.length} relationship(s), ${d.stateMachines.length} state machine(s), ${d.measurements.length} measurement(s), ${d.constraints.length} constraint(s)`,
    });
    return {
      outcome: "registered",
      domainId: d.id,
      diagnostics: diags,
    };
  }
}

/** Build a `failed` result. */
function fail(
  domainId: string,
  diags: RegisterDomainDiagnostic[]
): RegisterDomainResult {
  return { outcome: "failed", domainId, diagnostics: diags };
}

/**
 * Convenience: convert a `RegisterDomainResult` into a `ValidationError`
 * (for callers that prefer the kernel error hierarchy). Returns `undefined`
 * when `outcome === "registered"`.
 */
export function toValidationError(
  result: RegisterDomainResult
): ValidationError | undefined {
  if (result.outcome === "registered") return undefined;
  const details = result.diagnostics.map((d) => ({
    field: d.field,
    reason: d.reason,
  }));
  return new ValidationError(
    `domain '${result.domainId}' failed validation: ${details
      .map((d) => `${d.field} (${d.reason})`)
      .join("; ")}`,
    details
  );
}
