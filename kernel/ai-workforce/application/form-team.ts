/**
 * @kernel/ai-workforce/application/form-team — use-case: form an AI team with
 * a director.
 *
 * Flow:
 *   1. validate the director agent exists + is registered + has the
 *      `role:director` role (or any role with `decisionAuthority: "full"`)
 *   2. validate every member agent exists + is registered
 *   3. validate the director and members are in the same organization
 *   4. construct a forming `AITeam` (via `createFormingTeam`)
 *   5. validate the team (pure structural check)
 *
 * On validation failure returns `err(ValidationError)`. On success returns
 * `ok({ team })`. The team is NOT stored by this use-case — teams live in a
 * separate team registry (the kernel's `AgentRegistry` does NOT store
 * teams). The caller is responsible for storing the team (e.g. in a
 * protocol-level team store, or in the `AIOrganization`'s `teamIds`).
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * Team formation runs at BOOT / orchestration time — OUTSIDE the
 * deterministic core.
 *
 * Pure w.r.t. `(deps, input)`: no `Date.now()`, no `Math.random()`. All time
 * via `input.now`. The team id is supplied by the caller.
 */
import {
  type KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";
import {
  type AITeam,
  type AgentRegistry,
  type AIRole,
  createFormingTeam,
  validateTeam,
} from "../domain";

/**
 * Dependencies injected by the caller.
 */
export interface FormTeamDeps {
  readonly registry: AgentRegistry;
  /**
   * Look up a role by id. Used to verify the director has director-level
   * authority. Typically backed by a role registry.
   */
  readonly roleLookup: (roleId: string) => AIRole | undefined;
}

/**
 * Input to `formTeam`. Pure data.
 */
export interface FormTeamInput {
  readonly teamId: string;
  readonly name: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly directorId: string;
  readonly memberIds?: readonly string[];
  readonly objectives?: readonly string[];
  /** Caller-supplied epoch-millis. */
  readonly now: number;
}

/**
 * Result of `formTeam`. The formed team.
 */
export interface FormTeamResult {
  readonly team: AITeam;
}

/**
 * Form an AI team with a director.
 *
 * See file-level JSDoc for the flow. Returns `err(ValidationError)` on
 * validation failure, `ok({ team })` on success.
 */
export function formTeam(
  deps: FormTeamDeps,
  input: FormTeamInput
): Result<FormTeamResult, KernelError> {
  // 1. Validate the director agent exists + has director-level authority.
  const director = deps.registry.get(input.directorId);
  if (director === undefined) {
    return err(
      new ValidationError(`director agent '${input.directorId}' not registered`, [
        { field: "directorId", reason: "no such agent" },
      ])
    );
  }
  const directorRole = deps.roleLookup(director.roleId);
  if (directorRole === undefined) {
    return err(
      new ValidationError(
        `director role '${director.roleId}' not registered`,
        [{ field: "directorId", reason: "director's role not found" }]
      )
    );
  }
  if (directorRole.decisionAuthority !== "full") {
    return err(
      new ValidationError(
        `director agent '${input.directorId}' has role '${directorRole.name}' ` +
          `with decisionAuthority '${directorRole.decisionAuthority}' — must be 'full'`,
        [{ field: "directorId", reason: "role must have full decision authority" }]
      )
    );
  }

  // 2. Validate every member agent exists + is registered + is in the same
  //    organization + tenant.
  const memberIds = input.memberIds ? Array.from(input.memberIds) : [];
  for (const memberId of memberIds) {
    const member = deps.registry.get(memberId);
    if (member === undefined) {
      return err(
        new ValidationError(`member agent '${memberId}' not registered`, [
          { field: "memberIds", reason: `no such agent: ${memberId}` },
        ])
      );
    }
    if (member.organizationId !== input.organizationId) {
      return err(
        new ValidationError(
          `member agent '${memberId}' is in organization '${member.organizationId}' — team is in '${input.organizationId}'`,
          [
            {
              field: "memberIds",
              reason: `agent ${memberId} is in a different organization`,
            },
          ]
        )
      );
    }
    if (member.tenantId !== input.tenantId) {
      return err(
        new ValidationError(
          `member agent '${memberId}' is in tenant '${member.tenantId}' — team is in '${input.tenantId}'`,
          [
            {
              field: "memberIds",
              reason: `agent ${memberId} is in a different tenant`,
            },
          ]
        )
      );
    }
  }

  // The director must also be in the same org / tenant.
  if (director.organizationId !== input.organizationId) {
    return err(
      new ValidationError(
        `director agent '${input.directorId}' is in organization '${director.organizationId}' — team is in '${input.organizationId}'`,
        [
          {
            field: "directorId",
            reason: "director is in a different organization",
          },
        ]
      )
    );
  }
  if (director.tenantId !== input.tenantId) {
    return err(
      new ValidationError(
        `director agent '${input.directorId}' is in tenant '${director.tenantId}' — team is in '${input.tenantId}'`,
        [{ field: "directorId", reason: "director is in a different tenant" }]
      )
    );
  }

  // 3. Construct the forming team.
  const team = createFormingTeam({
    id: input.teamId,
    name: input.name,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    directorId: input.directorId,
    memberIds,
    objectives: input.objectives,
    now: input.now,
  });

  // 4. Validate the team (pure structural check).
  const teamValidation = validateTeam(team);
  if (!teamValidation.ok) {
    return teamValidation;
  }

  return ok({ team });
}

/**
 * Use-case class wrapping `formTeam` with constructor-injected deps.
 */
export class FormTeam {
  constructor(private readonly deps: FormTeamDeps) {}

  execute(input: FormTeamInput): Result<FormTeamResult, KernelError> {
    return formTeam(this.deps, input);
  }
}
