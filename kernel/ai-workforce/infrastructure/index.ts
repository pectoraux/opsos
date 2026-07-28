/**
 * @kernel/ai-workforce/infrastructure — barrel + factory.
 *
 * Re-exports the in-memory implementations of every port, the default
 * boundary checker, and the `createAIWorkforce()` factory.
 *
 * Callers who want a fully-wired default workforce can use:
 *
 *   import { createAIWorkforce } from "@kernel/ai-workforce";
 *   const wf = createAIWorkforce();
 *   const result = wf.createAgent.execute({ ... });
 *
 * Callers who want custom wiring (e.g. injecting a Postgres-backed registry
 * or an AI-backed memory store) can construct the parts directly.
 *
 * Determinism: every implementation here is deterministic. No `Date.now()` /
 * `Math.random()`. The factory's default clock is a fixed clock at 0
 * (`WorkforceFixedClock`); callers may inject their own `RuntimeClock`.
 *
 * Public surface:
 *   - InMemoryAgentRegistry
 *   - InMemoryMemoryStore (+ InMemoryMemoryStoreOptions + MemoryFixedClock)
 *   - InMemoryCollaborationEngine
 *   - InMemoryApprovalWorkflow
 *   - DefaultBoundaryChecker
 *   - WorkforceFixedClock
 *   - createAIWorkforce (+ CreateAIWorkforceOptions + AIWorkforce bundle)
 *   - A small `RoleCatalog` helper that exposes the 5 predefined roles
 */
import { FixedClock, type RuntimeClock } from "@kernel/shared-kernel";
import {
  type AIRole,
  PREDEFINED_ROLES,
  getPredefinedRole,
} from "../domain";

export * from "./in-memory-agent-registry";
export * from "./in-memory-memory-store";
export * from "./in-memory-collaboration-engine";
export * from "./in-memory-approval-workflow";
export * from "./default-boundary-check";

import { InMemoryAgentRegistry } from "./in-memory-agent-registry";
import { InMemoryMemoryStore } from "./in-memory-memory-store";
import { InMemoryCollaborationEngine } from "./in-memory-collaboration-engine";
import { InMemoryApprovalWorkflow } from "./in-memory-approval-workflow";
import { DefaultBoundaryChecker } from "./default-boundary-check";
import {
  type CreateAgentDeps,
  CreateAgent,
} from "../application/create-agent";
import {
  type FormTeamDeps,
  FormTeam,
} from "../application/form-team";
import {
  type DelegateTaskDeps,
  DelegateTask,
} from "../application/delegate-task";
import {
  type RequestApprovalDeps,
  RequestApproval,
} from "../application/request-approval";
import {
  type CheckBoundariesDeps,
  CheckBoundaries,
} from "../application/check-boundaries";

/**
 * Concrete fixed clock for the AI workforce. Defaults to `now()=0`. Used as
 * the shared time source when no `RuntimeClock` is injected. Mirrors the
 * pattern in the intelligence module.
 */
export class WorkforceFixedClock extends FixedClock {
  constructor(now: number = 0) {
    super(now, 0);
  }
}

/**
 * A small role catalog backed by the 5 predefined roles. Protocols may
 * construct their own catalog (with additional custom roles) and pass it to
 * `createAIWorkforce`.
 */
export class RoleCatalog {
  private readonly roles: Map<string, AIRole> = new Map();

  constructor(extraRoles: readonly AIRole[] = []) {
    for (const role of PREDEFINED_ROLES) {
      this.roles.set(role.id, role);
    }
    for (const role of extraRoles) {
      this.roles.set(role.id, role);
    }
  }

  /** Look up a role by id. Returns `undefined` if not found. */
  lookup(roleId: string): AIRole | undefined {
    return this.roles.get(roleId) ?? getPredefinedRole(roleId);
  }

  /** List all roles, sorted by id ascending. */
  list(): readonly AIRole[] {
    return Array.from(this.roles.values()).sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    );
  }

  /** Register an additional role. Idempotent on id. */
  register(role: AIRole): void {
    this.roles.set(role.id, role);
  }
}

/** Options for `createAIWorkforce`. */
export interface CreateAIWorkforceOptions {
  readonly clock?: RuntimeClock;
  readonly now?: number;
  /** Additional roles beyond the 5 predefined. */
  readonly extraRoles?: readonly AIRole[];
  /** Max memory entries per agent before consolidation drops the oldest. */
  readonly maxMemoryEntries?: number;
}

/**
 * A fully-wired AI workforce bundle. All engines share the same `registry`,
 * `memoryStore`, and `clock`. Use-cases are pre-wired with their deps.
 */
export interface AIWorkforce {
  readonly registry: InMemoryAgentRegistry;
  readonly memoryStore: InMemoryMemoryStore;
  readonly collaboration: InMemoryCollaborationEngine;
  readonly approval: InMemoryApprovalWorkflow;
  readonly boundaryChecker: DefaultBoundaryChecker;
  readonly roleCatalog: RoleCatalog;
  readonly clock: RuntimeClock;

  // Pre-wired use-cases
  readonly createAgent: CreateAgent;
  readonly formTeam: FormTeam;
  readonly delegateTask: DelegateTask;
  readonly requestApproval: RequestApproval;
  readonly checkBoundaries: CheckBoundaries;
}

/**
 * `createAIWorkforce` — builds a fresh, fully-wired AI workforce with
 * deterministic in-memory implementations.
 *
 * - `registry` is shared by the boundary checker and all use-cases.
 * - `memoryStore` is shared by `createAgent`, `delegateTask`, and
 *   `requestApproval`.
 * - `collaboration` is shared by `delegateTask`.
 * - `approval` is shared by `requestApproval`.
 * - `clock` is shared by `memoryStore` (for expiry checks). Defaults to a
 *   fixed clock at `now` (default 0) — never `Date.now()`.
 * - `roleCatalog` is shared by `createAgent` and `formTeam` for role lookup.
 *
 * The returned bundle is ready for self-test / conformance. To plug in real
 * persistence or AI-backed memory, construct the parts directly and inject
 * custom implementations of the relevant ports.
 */
export function createAIWorkforce(
  options: CreateAIWorkforceOptions = {}
): AIWorkforce {
  const clock: RuntimeClock =
    options.clock ?? new WorkforceFixedClock(options.now ?? 0);

  const registry = new InMemoryAgentRegistry();
  const memoryStore = new InMemoryMemoryStore({
    clock,
    maxEntries: options.maxMemoryEntries,
  });
  const collaboration = new InMemoryCollaborationEngine();
  const approval = new InMemoryApprovalWorkflow();
  const boundaryChecker = new DefaultBoundaryChecker(registry);
  const roleCatalog = new RoleCatalog(options.extraRoles);

  const roleLookup = (roleId: string): AIRole | undefined =>
    roleCatalog.lookup(roleId);

  const createAgentDeps: CreateAgentDeps = {
    registry,
    memoryStore,
    roleLookup,
  };
  const formTeamDeps: FormTeamDeps = {
    registry,
    roleLookup,
  };
  const delegateTaskDeps: DelegateTaskDeps = {
    registry,
    collaboration,
    memoryStore,
  };
  const requestApprovalDeps: RequestApprovalDeps = {
    registry,
    approval,
    memoryStore,
    boundaryChecker,
  };
  const checkBoundariesDeps: CheckBoundariesDeps = {
    registry,
    boundaryChecker,
  };

  return {
    registry,
    memoryStore,
    collaboration,
    approval,
    boundaryChecker,
    roleCatalog,
    clock,
    createAgent: new CreateAgent(createAgentDeps),
    formTeam: new FormTeam(formTeamDeps),
    delegateTask: new DelegateTask(delegateTaskDeps),
    requestApproval: new RequestApproval(requestApprovalDeps),
    checkBoundaries: new CheckBoundaries(checkBoundariesDeps),
  };
}
