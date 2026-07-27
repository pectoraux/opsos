/**
 * @kernel/policy/application/register-policy — the pure registration command.
 *
 * Validates a `PolicyDefinition` and, if valid, registers it with the
 * supplied `PolicyStore`. Returns `Result<PolicyDefinition, KernelError>` so
 * callers can branch on success without try/catch.
 *
 * Validation rules:
 *   - `version` MUST be > 0.
 *   - `id` MUST be a non-empty branded `PolicyId` (structural check on the
 *     underlying string).
 *   - `name` MUST be a non-empty string.
 *   - Rule ids MUST be unique within the policy (no duplicates).
 *   - Each rule's `condition` MUST be a structurally-valid `PredicateSpec`
 *     (has `op: string` and `args: array`).
 *
 * PURE in the domain sense: it does not call `Date.now()` / `Math.random()`,
 * does not perform I/O beyond the injected `PolicyStore` port. The store call
 * is the only side-effect.
 */

import type {
  Result,
  KernelError,
  PolicyId,
  Rule,
} from "@kernel/shared-kernel";
import { ok, err, ValidationError } from "@kernel/shared-kernel";
import type { PolicyDefinition, PolicyStore } from "../domain/policy-definition";

/**
 * Structural check that a value is a valid `PredicateSpec` (`{ op: string,
 * args: readonly unknown[] }`). Used during registration to reject malformed
 * rules early — the evaluator itself is total and fail-closed, but failing
 * registration is better than silently producing `deferred` decisions for
 * every subject.
 */
function isValidPredicateSpec(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const obj = value as { op?: unknown; args?: unknown };
  return typeof obj.op === "string" && Array.isArray(obj.args);
}

/**
 * Validate a `PolicyDefinition`. Returns `ValidationError` (with `details`)
 * on failure, `null` on success.
 */
function validatePolicy(policy: PolicyDefinition): KernelError | null {
  const details: { field: string; reason: string }[] = [];

  if (typeof String(policy.id) !== "string" || String(policy.id).length === 0) {
    details.push({ field: "id", reason: "must be a non-empty string" });
  }
  if (typeof policy.version !== "number" || policy.version <= 0) {
    details.push({ field: "version", reason: "must be a number > 0" });
  }
  if (typeof policy.name !== "string" || policy.name.length === 0) {
    details.push({ field: "name", reason: "must be a non-empty string" });
  }
  if (!Array.isArray(policy.rules)) {
    details.push({ field: "rules", reason: "must be an array" });
  } else {
    // Duplicate rule id check.
    const seen = new Set<string>();
    for (const rule of policy.rules as readonly Rule[]) {
      const rid = String(rule.id);
      if (seen.has(rid)) {
        details.push({
          field: `rules[${rid}]`,
          reason: "duplicate rule id within policy",
        });
      } else {
        seen.add(rid);
      }
      if (!isValidPredicateSpec(rule.condition)) {
        details.push({
          field: `rules[${rid}].condition`,
          reason: "must be a valid PredicateSpec { op: string, args: unknown[] }",
        });
      }
    }
  }

  if (details.length > 0) {
    return new ValidationError(
      `Policy '${String(policy.id)}' failed validation: ${details
        .map((d) => `${d.field} (${d.reason})`)
        .join("; ")}`,
      details
    );
  }
  return null;
}

/**
 * Register a `PolicyDefinition` with the supplied `PolicyStore` after
 * validation. Returns `ok(policy)` on success, `err(ValidationError)` on
 * validation failure.
 *
 * The store's `register` is the only side-effect. This function does NOT
 * check for pre-existing policies with the same id — `PolicyStore.register`
 * is upsert-by-id semantics, so re-registering replaces the prior definition
 * (callers wanting version-gated updates should check `store.get` first).
 */
export function registerPolicy(
  store: PolicyStore,
  policy: PolicyDefinition
): Result<PolicyDefinition, KernelError> {
  const validationError = validatePolicy(policy);
  if (validationError !== null) {
    return err(validationError);
  }
  store.register(policy);
  return ok(policy);
}

/**
 * Type-only re-export so consumers can refer to `PolicyId` via this module if
 * desired. Kept as a type-only re-export to avoid polluting the value space.
 */
export type { PolicyId };
