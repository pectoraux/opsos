/**
 * @kernel/ai-workforce/domain/ai-role — the AIRole value object.
 *
 * An `AIRole` describes WHAT KIND of agent this is and WHAT it is allowed to
 * decide / do. It is the AI analog of a job-title + permission-set + authority
 * level combined into a single immutable value object.
 *
 * Five PREDEFINED_ROLES ship with the kernel — every AI Workforce builds on
 * these and may extend with protocol-defined roles:
 *
 *   1. Director    — full authority; sets objectives; final escalation target.
 *   2. Coordinator  — conditional authority; orchestrates teams + handoffs.
 *   3. Specialist   — advisory authority; deep expertise in a narrow domain.
 *   4. Reviewer     — conditional authority; approves / rejects work output.
 *   5. Executor     — full authority within a tightly-scoped action envelope.
 *
 * `decisionAuthority` is the key escalation lever:
 *   - `none`        — agent cannot decide; only advises / informs.
 *   - `advisory`    — agent produces recommendations; humans (or a director)
 *                     make the final call.
 *   - `conditional` — agent decides WITHIN its boundaries; escalates outside.
 *   - `full`        — agent decides autonomously; escalations are exceptional.
 *
 * `escalationThreshold` is the cost / risk level at which the role MUST
 * escalate regardless of authority. Lower thresholds = more cautious.
 *
 * Determinism rule: no `Date.now()` / `Math.random()`. `AIRole` is pure data.
 * `validateRole` is a pure structural check.
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
 * The decision authority level of an AI role. See file-level JSDoc.
 */
export type DecisionAuthority =
  | "none"
  | "advisory"
  | "conditional"
  | "full";

/**
 * An immutable AI role definition. See file-level JSDoc.
 */
export interface AIRole {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Permission-type strings granted to agents in this role. */
  readonly permissions: readonly string[];
  readonly decisionAuthority: DecisionAuthority;
  /**
   * The cost / risk level at which the role MUST escalate regardless of
   * authority. A threshold of 0 = always escalate; Infinity (or a very high
   * number) = never escalate automatically.
   */
  readonly escalationThreshold: number;
}

/**
 * The five predefined roles every AI Workforce ships with. Protocols may
 * register additional roles via the registry, but these five are guaranteed
 * to exist by the kernel.
 *
 * Ids are stable strings (`role:director`, `role:coordinator`, etc.) so
 * protocols can reference them without coupling to the object identity.
 */
export const PREDEFINED_ROLES: readonly AIRole[] = Object.freeze([
  {
    id: "role:director",
    name: "Director",
    description:
      "Sets objectives, allocates authority, is the final escalation target for the AI organization.",
    permissions: [
      "objective.set",
      "team.form",
      "team.dissolve",
      "agent.assign",
      "escalation.resolve",
      "approval.override",
    ],
    decisionAuthority: "full",
    escalationThreshold: 1000,
  },
  {
    id: "role:coordinator",
    name: "Coordinator",
    description:
      "Orchestrates teams, initiates handoffs, routes work between specialists and executors.",
    permissions: [
      "team.coordinate",
      "handoff.initiate",
      "handoff.accept",
      "task.delegate",
      "memory.share",
    ],
    decisionAuthority: "conditional",
    escalationThreshold: 200,
  },
  {
    id: "role:specialist",
    name: "Specialist",
    description:
      "Deep expertise in a narrow domain; advises and produces analysis but does not execute work directly.",
    permissions: [
      "analysis.produce",
      "knowledge.query",
      "memory.record",
      "advise.issue",
    ],
    decisionAuthority: "advisory",
    escalationThreshold: 100,
  },
  {
    id: "role:reviewer",
    name: "Reviewer",
    description:
      "Reviews and approves or rejects work output against standards; conditional authority to send back for rework.",
    permissions: [
      "work.review",
      "work.approve",
      "work.reject",
      "standard.check",
    ],
    decisionAuthority: "conditional",
    escalationThreshold: 150,
  },
  {
    id: "role:executor",
    name: "Executor",
    description:
      "Executes well-scoped actions autonomously within its capability envelope; escalates on boundary breach.",
    permissions: [
      "action.execute",
      "memory.record",
      "task.complete",
    ],
    decisionAuthority: "full",
    escalationThreshold: 50,
  },
]);

/**
 * Look up a predefined role by id. Returns `undefined` if no predefined role
 * matches. Pure.
 */
export function getPredefinedRole(id: string): AIRole | undefined {
  return PREDEFINED_ROLES.find((r) => r.id === id);
}

/**
 * Pure structural validation of an `AIRole`. Returns `err(ValidationError)`
 * with a `details[]` list on failure, `ok(undefined)` on success.
 *
 * Checks: id non-empty, name non-empty, description present, permissions is an
 * array, decisionAuthority is a known value, escalationThreshold is a
 * non-negative finite number.
 */
export function validateRole(role: AIRole): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (!role.id || role.id.trim() === "") {
    details.push({ field: "id", reason: "must be non-empty" });
  }
  if (!role.name || role.name.trim() === "") {
    details.push({ field: "name", reason: "must be non-empty" });
  }
  if (role.description === undefined || role.description === null) {
    details.push({ field: "description", reason: "must be present" });
  }
  if (!Array.isArray(role.permissions)) {
    details.push({ field: "permissions", reason: "must be an array" });
  }
  const validAuthority: readonly DecisionAuthority[] = [
    "none",
    "advisory",
    "conditional",
    "full",
  ];
  if (!validAuthority.includes(role.decisionAuthority)) {
    details.push({
      field: "decisionAuthority",
      reason: `unknown authority '${role.decisionAuthority}'`,
    });
  }
  if (
    typeof role.escalationThreshold !== "number" ||
    !Number.isFinite(role.escalationThreshold) ||
    role.escalationThreshold < 0
  ) {
    details.push({
      field: "escalationThreshold",
      reason: "must be a non-negative finite number",
    });
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid AI role", details));
  }
  return ok(undefined);
}
