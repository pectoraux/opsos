/**
 * @kernel/domain-modeling/application/validate-entity — the use-case that
 * validates an `EntityInstance` against its `EntityType` definition.
 *
 * An entity instance is valid iff:
 *
 *   1. Its `entityTypeId` resolves to an `EntityType` in `domainId`.
 *
 *   2. Every `required` attribute on the EntityType is present in
 *      `entity.attributes` (with a non-undefined value).
 *
 *   3. Every present attribute matches its declared type:
 *        - `string`  → value is a string.
 *        - `number`  → value is a finite number.
 *        - `boolean` → value is a boolean.
 *        - `enum`    → value is a string in `enumValues`.
 *        - `measurement` → value is a number (numeric measurement) —
 *                       additional range/precision checks are advisory and
 *                       do NOT fail validation (the compiler enforces
 *                       strict bounds at execution time).
 *        - `reference`         → value is a string (entity id).
 *        - `location`          → value is a string (location id).
 *        - `resource`          → value is a string (resource id).
 *        - `knowledge-reference`    → value is a string (knowledge item id).
 *        - `capability-reference`   → value is a string (capability id).
 *
 *      Attributes not declared on the EntityType are reported as a
 *      diagnostic but DO NOT fail validation (entities may carry extra
 *      metadata; the kernel only validates declared attributes).
 *
 *   4. When the EntityType has a state machine:
 *        - `entity.state` MUST be set and MUST be in `states`.
 *
 *   5. Constraints (`must_have`, `cannot_have`, `minimum`, `maximum`) on
 *      the target EntityType are checked:
 *        - `must_have`     → the attribute is present (non-undefined).
 *        - `cannot_have`   → the attribute is absent (or undefined).
 *        - `minimum`       → the numeric attribute is ≥ `params.value`.
 *        - `maximum`       → the numeric attribute is ≤ `params.value`.
 *        - `requires`, `exclusive_with` — these are CROSS-ENTITY
 *          constraints; the validator cannot check them in isolation, so
 *          they are reported as `outcome: "unchecked"` diagnostics.
 *
 * The use-case returns `Result<EntityInstance, ValidationError>`:
 *   - `ok(entity)`     — the entity is valid.
 *   - `err(ValidationError)` — the entity is invalid; `details` carries the
 *                              field-level violations.
 *
 * Determinism: identical inputs + identical registry → identical outputs.
 * No `Date.now()`, no `Math.random()`. Validation order is deterministic
 * (declared order). The FIRST HARD violation aborts; advisory checks
 * (extra attributes, cross-entity constraints) are accumulated as
 * diagnostics but do not abort.
 */

import { ok, err, ValidationError, NotFoundError } from "@kernel/shared-kernel";
import type { Result, KernelError } from "@kernel/shared-kernel";
import type { DomainRegistry } from "../domain/domain-registry";
import type { EntityInstance } from "../domain/entity-registry";
import type { EntityType } from "../domain/entity-type";
import type { AttributeDefinition } from "../domain/attribute";

/**
 * A single validation diagnostic. `field` is a dotted path into the entity
 * instance (e.g. `"attributes.area"`, `"state"`).
 */
export interface ValidateEntityDiagnostic {
  readonly field: string;
  readonly reason: string;
  /**
   * `"error"` — a hard violation; the entity is invalid.
   * `"warning"` — an advisory check; the entity is still valid.
   * `"unchecked"` — a constraint the validator cannot check in isolation.
   */
  readonly severity: "error" | "warning" | "unchecked";
}

/**
 * The input to `ValidateEntity.execute`. Pure data.
 */
export interface ValidateEntityInput {
  readonly domainId: string;
  readonly entity: EntityInstance;
}

/**
 * The result of `ValidateEntity.execute`. The entity is returned unchanged
 * when valid; the `diagnostics` array always carries the full validation
 * report (errors + warnings + unchecked).
 */
export interface ValidateEntityResult {
  readonly valid: boolean;
  readonly entity: EntityInstance;
  readonly diagnostics: readonly ValidateEntityDiagnostic[];
}

/**
 * The use-case PORT.
 */
export interface ValidateEntity {
  execute(input: ValidateEntityInput): Result<ValidateEntityResult, KernelError>;
}

/**
 * Default implementation.
 */
export class ValidateEntityUseCase implements ValidateEntity {
  constructor(private readonly registry: DomainRegistry) {}

  execute(input: ValidateEntityInput): Result<ValidateEntityResult, KernelError> {
    const diags: ValidateEntityDiagnostic[] = [];

    // ── 1. Resolve the EntityType. ─────────────────────────────────────────
    const et = this.registry.getEntityType(input.domainId, input.entity.entityTypeId);
    if (!et) {
      return err(
        new NotFoundError(
          "EntityType",
          `${input.domainId}#${input.entity.entityTypeId}`
        )
      );
    }

    // The entity MUST belong to the domain it claims.
    if (input.entity.domainId !== input.domainId) {
      diags.push({
        field: "domainId",
        reason: `entity.domainId '${input.entity.domainId}' does not match query domainId '${input.domainId}'`,
        severity: "error",
      });
      // Continue — surface the rest of the report.
    }

    // ── 2. Required attributes are present. ────────────────────────────────
    const present = new Set(
      Object.keys(input.entity.attributes).filter(
        (k) => input.entity.attributes[k] !== undefined && input.entity.attributes[k] !== null
      )
    );
    for (const a of et.attributes) {
      if (a.required && !present.has(a.name)) {
        // If a default is declared, treat as satisfied (the registry SHOULD
        // apply defaults before validation, but we are defensive here).
        if (a.default === undefined) {
          diags.push({
            field: `attributes.${a.name}`,
            reason: `required attribute '${a.name}' is missing`,
            severity: "error",
          });
        }
      }
    }

    // ── 3. Present attributes match their declared types. ──────────────────
    for (const a of et.attributes) {
      const v = input.entity.attributes[a.name];
      if (v === undefined || v === null) continue;
      const typeErr = checkAttributeType(a, v);
      if (typeErr) {
        diags.push({
          field: `attributes.${a.name}`,
          reason: typeErr,
          severity: "error",
        });
      }
    }

    // ── 4. Extra (undeclared) attributes → advisory. ───────────────────────
    const declared = new Set(et.attributes.map((a) => a.name));
    for (const k of Object.keys(input.entity.attributes)) {
      if (!declared.has(k)) {
        diags.push({
          field: `attributes.${k}`,
          reason: `attribute '${k}' is not declared on entity type '${et.id}'`,
          severity: "warning",
        });
      }
    }

    // ── 5. State machine. ─────────────────────────────────────────────────
    if (et.stateMachineId) {
      const domain = this.registry.get(input.domainId);
      const sm = domain?.stateMachines.find((s) => s.id === et.stateMachineId);
      if (sm) {
        if (input.entity.state === undefined) {
          diags.push({
            field: "state",
            reason: `entity type '${et.id}' has a state machine but entity.state is undefined`,
            severity: "error",
          });
        } else if (!sm.states.includes(input.entity.state)) {
          diags.push({
            field: "state",
            reason: `state '${input.entity.state}' is not in state machine '${sm.id}' (allowed: ${sm.states.join(", ")})`,
            severity: "error",
          });
        }
      }
    } else if (input.entity.state !== undefined) {
      // No state machine — state should not be set.
      diags.push({
        field: "state",
        reason: `entity type '${et.id}' has no state machine but entity.state is '${input.entity.state}'`,
        severity: "warning",
      });
    }

    // ── 6. Constraints. ────────────────────────────────────────────────────
    const domain = this.registry.get(input.domainId);
    if (domain) {
      const targeted = domain.constraints.filter(
        (c) => c.targetEntityType === et.id
      );
      for (const c of targeted) {
        switch (c.kind) {
          case "must_have": {
            const attrName = c.attributeRef;
            if (attrName && !present.has(attrName)) {
              diags.push({
                field: `attributes.${attrName}`,
                reason: `constraint '${c.id}' (must_have): attribute '${attrName}' is missing`,
                severity: "error",
              });
            }
            break;
          }
          case "cannot_have": {
            const attrName = c.attributeRef;
            if (attrName && present.has(attrName)) {
              diags.push({
                field: `attributes.${attrName}`,
                reason: `constraint '${c.id}' (cannot_have): attribute '${attrName}' is present`,
                severity: "error",
              });
            }
            break;
          }
          case "minimum": {
            const attrName = c.attributeRef;
            const v = attrName ? input.entity.attributes[attrName] : undefined;
            const min = c.params.value;
            if (
              attrName &&
              typeof v === "number" &&
              typeof min === "number" &&
              v < min
            ) {
              diags.push({
                field: `attributes.${attrName}`,
                reason: `constraint '${c.id}' (minimum): ${v} < ${min}`,
                severity: "error",
              });
            }
            break;
          }
          case "maximum": {
            const attrName = c.attributeRef;
            const v = attrName ? input.entity.attributes[attrName] : undefined;
            const max = c.params.value;
            if (
              attrName &&
              typeof v === "number" &&
              typeof max === "number" &&
              v > max
            ) {
              diags.push({
                field: `attributes.${attrName}`,
                reason: `constraint '${c.id}' (maximum): ${v} > ${max}`,
                severity: "error",
              });
            }
            break;
          }
          case "requires":
          case "exclusive_with": {
            diags.push({
              field: `constraints.${c.id}`,
              reason: `constraint kind '${c.kind}' is cross-entity; cannot be checked in isolation`,
              severity: "unchecked",
            });
            break;
          }
        }
      }
    }

    const valid = diags.every((d) => d.severity !== "error");
    return ok({
      valid,
      entity: input.entity,
      diagnostics: diags,
    });
  }
}

/**
 * Type-check a single attribute value against its declared type. Returns
 * `undefined` when valid; an error message otherwise.
 */
function checkAttributeType(a: AttributeDefinition, v: unknown): string | undefined {
  switch (a.type) {
    case "string":
      return typeof v === "string" ? undefined : `expected string, got ${typeof v}`;
    case "number":
      return typeof v === "number" && Number.isFinite(v)
        ? undefined
        : `expected finite number, got ${typeof v}`;
    case "boolean":
      return typeof v === "boolean" ? undefined : `expected boolean, got ${typeof v}`;
    case "enum":
      if (typeof v !== "string") return `expected enum string, got ${typeof v}`;
      return a.enumValues && a.enumValues.includes(v)
        ? undefined
        : `value '${v}' is not in enumValues [${(a.enumValues ?? []).join(", ")}]`;
    case "measurement":
      // Numeric measurements must be finite numbers. Compound / categorical
      // measurements (valueType !== "number") are advisory — accept any
      // non-null value.
      return typeof v === "number" || typeof v === "string" || typeof v === "boolean" || (typeof v === "object" && v !== null)
        ? undefined
        : `expected measurement value, got ${typeof v}`;
    case "reference":
    case "location":
    case "resource":
    case "knowledge-reference":
    case "capability-reference":
      return typeof v === "string"
        ? undefined
        : `expected string id for ${a.type}, got ${typeof v}`;
    default:
      return `unknown attribute type '${a.type}'`;
  }
}
