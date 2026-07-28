/**
 * @kernel/ai-workforce/domain/ai-organization — the AIOrganization value object.
 *
 * An `AIOrganization` is an AI mirror of a real organization. It carries:
 *   - the real-world `organizationId` + `tenantId` it belongs to
 *   - an AI director (`directorId` — an `AIAgent` id, typically `role:director`)
 *   - the `teamIds` (references to `AITeam`s) that compose it
 *   - the `policies` (an `AIOrgPolicy[]`) that govern autonomous behavior
 *   - the `hierarchy` (an `OrgNode[]`) — a flat adjacency list describing the
 *     reporting structure between agents (each node: agentId + optional
 *     parentId + roleId)
 *
 * An AI organization MIRRORS a real organization: the real org has humans in
 * roles; the AI org has agents in those same roles, organized the same way,
 * obeying the same authority lines.
 *
 * `AIOrgPolicy` is a typed bag of rules: `kind` names the policy category
 * (e.g. `"cost-ceiling"`, `"data-residency"`, `"approval-quorum"`) and `rules`
 * is an opaque serializable record. The kernel does NOT interpret policy
 * contents; it stores and surfaces them. Protocol-level boundary checkers +
 * approval workflows MAY consult policies.
 *
 * `OrgNode` is a node in the reporting hierarchy. The hierarchy is a flat
 * adjacency list (each node names its `parentId`) rather than a tree, so the
 * same agent can sit in multiple reporting lines (matrix organizations) and
 * the structure round-trips through JSON.
 *
 * Determinism rule: no `Date.now()` / `Math.random()`. `AIOrganization` is
 * pure data. Pure structural validation.
 *
 * Layering: domain depends ONLY on `@kernel/shared-kernel`.
 */
import {
  type KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";

/**
 * A typed bag of policy rules governing an AI organization. The kernel does
 * NOT interpret the `rules` record; it stores and surfaces them. Protocol-
 * level boundary checkers + approval workflows MAY consult policies.
 */
export interface AIOrgPolicy {
  readonly id: string;
  /** Policy category, e.g. `"cost-ceiling"`, `"data-residency"`, … */
  readonly kind: string;
  /** Opaque serializable rules record. */
  readonly rules: Readonly<Record<string, unknown>>;
}

/**
 * A node in the AI organization's reporting hierarchy. The hierarchy is a
 * flat adjacency list (each node names its `parentId`) so the same agent can
 * sit in multiple reporting lines (matrix orgs) and the structure round-trips
 * through JSON.
 */
export interface OrgNode {
  readonly agentId: string;
  /** Optional parent agent id. Absent for the root / director. */
  readonly parentId?: string;
  /** The role id of the agent at this node. */
  readonly roleId: string;
}

/**
 * The immutable AIOrganization value object. See file-level JSDoc.
 */
export interface AIOrganization {
  readonly id: string;
  readonly name: string;
  /** The real-world organization this AI org mirrors. */
  readonly organizationId: string;
  readonly tenantId: string;
  /** The agent id of the AI org's director (typically `role:director`). */
  readonly directorId: string;
  /** The team ids composing this AI org. */
  readonly teamIds: readonly string[];
  /** The policies governing autonomous behavior in this AI org. */
  readonly policies: readonly AIOrgPolicy[];
  /** The reporting hierarchy as a flat adjacency list. */
  readonly hierarchy: readonly OrgNode[];
  readonly createdAt: number;
}

/**
 * Pure structural validation of an `AIOrganization`. Returns
 * `err(ValidationError)` with a `details[]` list on failure, `ok(undefined)`
 * on success.
 *
 * Checks: id non-empty, name non-empty, organizationId non-empty, tenantId
 * non-empty, directorId non-empty, teamIds is an array, policies is an array
 * (and each policy has a non-empty id + kind), hierarchy is an array (and each
 * node has a non-empty agentId + roleId), createdAt is a non-negative number.
 *
 * Cycle detection in the hierarchy is NOT performed here — it is the caller's
 * responsibility (the in-memory registry does not enforce it either, since
 * matrix orgs may legitimately have multi-parent structures). The kernel only
 * guarantees structural integrity.
 */
export function validateOrganization(
  org: AIOrganization
): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (!org.id || org.id.trim() === "") {
    details.push({ field: "id", reason: "must be non-empty" });
  }
  if (!org.name || org.name.trim() === "") {
    details.push({ field: "name", reason: "must be non-empty" });
  }
  if (!org.organizationId || org.organizationId.trim() === "") {
    details.push({ field: "organizationId", reason: "must be non-empty" });
  }
  if (!org.tenantId || org.tenantId.trim() === "") {
    details.push({ field: "tenantId", reason: "must be non-empty" });
  }
  if (!org.directorId || org.directorId.trim() === "") {
    details.push({ field: "directorId", reason: "must be non-empty" });
  }
  if (!Array.isArray(org.teamIds)) {
    details.push({ field: "teamIds", reason: "must be an array" });
  }
  if (!Array.isArray(org.policies)) {
    details.push({ field: "policies", reason: "must be an array" });
  } else {
    org.policies.forEach((p, i) => {
      if (!p || typeof p !== "object") {
        details.push({
          field: `policies[${i}]`,
          reason: "must be an object",
        });
        return;
      }
      if (!p.id || p.id.trim() === "") {
        details.push({
          field: `policies[${i}].id`,
          reason: "must be non-empty",
        });
      }
      if (!p.kind || p.kind.trim() === "") {
        details.push({
          field: `policies[${i}].kind`,
          reason: "must be non-empty",
        });
      }
      if (!p.rules || typeof p.rules !== "object") {
        details.push({
          field: `policies[${i}].rules`,
          reason: "must be an object",
        });
      }
    });
  }
  if (!Array.isArray(org.hierarchy)) {
    details.push({ field: "hierarchy", reason: "must be an array" });
  } else {
    org.hierarchy.forEach((n, i) => {
      if (!n || typeof n !== "object") {
        details.push({
          field: `hierarchy[${i}]`,
          reason: "must be an object",
        });
        return;
      }
      if (!n.agentId || n.agentId.trim() === "") {
        details.push({
          field: `hierarchy[${i}].agentId`,
          reason: "must be non-empty",
        });
      }
      if (!n.roleId || n.roleId.trim() === "") {
        details.push({
          field: `hierarchy[${i}].roleId`,
          reason: "must be non-empty",
        });
      }
    });
  }
  if (typeof org.createdAt !== "number" || org.createdAt < 0) {
    details.push({ field: "createdAt", reason: "must be a non-negative number" });
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid AI organization", details));
  }
  return ok(undefined);
}

/**
 * Helper for constructing an AI organization. Pure: returns a fresh object.
 */
export function createAIOrganization(input: {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly directorId: string;
  readonly teamIds?: readonly string[];
  readonly policies?: readonly AIOrgPolicy[];
  readonly hierarchy?: readonly OrgNode[];
  readonly now: number;
}): AIOrganization {
  return {
    id: input.id,
    name: input.name,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    directorId: input.directorId,
    teamIds: input.teamIds ? Array.from(input.teamIds) : [],
    policies: input.policies ? Array.from(input.policies) : [],
    hierarchy: input.hierarchy ? Array.from(input.hierarchy) : [],
    createdAt: input.now,
  };
}
