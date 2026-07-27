/**
 * @kernel/coordination/application/coordinate-work — the spine use-case.
 *
 * Orchestrates the full coordination spine for a single Demand:
 *
 *   Demand ──► MatchingEngine.match ──► MatchResult
 *                                       │ (top match)
 *                                       ▼
 *                              ReservationEngine.create → .confirm
 *                                       │ (commitmentId minted)
 *                                       ▼
 *                              CommitmentEngine.create
 *                                       │
 *                                       ▼
 *                              AssignmentEngine.assign → Assignment
 *
 * Returns the FULL coordination result: the selected Match, the confirmed
 * Reservation, the materialised Commitment, and the pending Assignment — plus
 * a `diagnostics` bag and a coarse `outcome` enum (`"assigned"` | `"no-match"`
 * | `"failed"`). The use-case is pure: every timestamp comes from the input's
 * `now`; engines are injected at construction time.
 *
 * Determinism rule: identical inputs + identical engine implementations →
 * identical outputs. No `Date.now()`, no `Math.random()`.
 */

import type {
  Demand,
  Resource,
  Capability,
  TaskId,
  ExecutionPlanId,
  TenantId,
  ProvenanceRef,
  Reservation,
  Commitment,
  Assignment,
  Match,
} from "@kernel/shared-kernel";

import type {
  MatchRequest,
  MatchResult,
  MatchPolicy,
  MatchingEngine,
  ReservationEngine,
  CommitmentEngine,
  AssignmentEngine,
} from "../domain";

/**
 * The full input to `CoordinateWork`. Pure data.
 */
export interface CoordinateWorkInput {
  readonly demand: Demand;
  readonly resources: readonly Resource[];
  readonly capabilities: readonly Capability[];
  readonly matchPolicies: readonly MatchPolicy[];
  readonly taskId: TaskId;
  readonly executionPlanId?: ExecutionPlanId;
  readonly reservationTtlMs: number;
  readonly tenantId: TenantId;
  readonly correlationId: string;
  readonly provenance: ProvenanceRef;
  /**
   * The capability-type the demand targets. Defaults to `demand.resourceType`
   * (the demand's "what kind of resource do I need" string is treated as the
   * capability type the matcher looks up).
   */
  readonly capabilityType?: string;
  /** Clock-sourced epoch-millis — sourced by the caller. */
  readonly now: number;
}

/**
 * Coarse outcome of the coordination spine.
 *   - `"assigned"`    — every step succeeded; the assignment is `pending`.
 *   - `"no-match"`    — the matching engine produced no `selected` candidate.
 *   - `"no-capacity"` — match succeeded but reservation failed (capacity gone).
 *   - `"failed"`      — any other failure (returned as a diagnostic).
 */
export type CoordinateWorkOutcome =
  | "assigned"
  | "no-match"
  | "no-capacity"
  | "failed";

/**
 * The full coordination result. Fields are `undefined` when the corresponding
 * step was not reached.
 */
export interface CoordinateWorkResult {
  readonly outcome: CoordinateWorkOutcome;
  readonly match?: Match;
  readonly matchResult: MatchResult;
  readonly reservation?: Reservation;
  readonly commitment?: Commitment;
  readonly assignment?: Assignment;
  readonly diagnostics: readonly string[];
}

/**
 * The use-case PORT. Implementations orchestrate the four engines.
 */
export interface CoordinateWork {
  execute(input: CoordinateWorkInput): CoordinateWorkResult;
}

/**
 * Default implementation. Constructed with the four engines (typically the
 * in-memory implementations from `infrastructure/`).
 */
export class CoordinateWorkUseCase implements CoordinateWork {
  constructor(
    private readonly matchingEngine: MatchingEngine,
    private readonly reservationEngine: ReservationEngine,
    private readonly commitmentEngine: CommitmentEngine,
    private readonly assignmentEngine: AssignmentEngine
  ) {}

  execute(input: CoordinateWorkInput): CoordinateWorkResult {
    const diagnostics: string[] = [];
    const capabilityType = input.capabilityType ?? input.demand.resourceType;

    // ── 1. Match ──────────────────────────────────────────────────────────
    const matchRequest: MatchRequest = {
      demandId: input.demand.id,
      tenantId: input.tenantId,
      capabilityType,
      quantity: input.demand.quantity,
      window: input.demand.temporalWindow,
      constraints: input.demand.constraints,
      resources: input.resources,
      capabilities: input.capabilities,
      policies: input.matchPolicies,
      now: input.now,
    };
    const matchResult = this.matchingEngine.match(matchRequest);
    diagnostics.push(
      `match: ${matchResult.candidates.length} candidate(s)` +
        (matchResult.selected ? ` → selected ${matchResult.selected.resourceId}` : "")
    );

    if (!matchResult.selected) {
      return {
        outcome: "no-match",
        matchResult,
        diagnostics,
      };
    }

    // ── 2. Reserve the top match's resource ───────────────────────────────
    let reservation: Reservation;
    try {
      reservation = this.reservationEngine.create(
        matchResult.selected.resourceId,
        input.tenantId,
        capabilityType,
        input.demand.quantity,
        input.demand.temporalWindow,
        input.reservationTtlMs,
        input.now
      );
      reservation = this.reservationEngine.confirm(reservation, input.now);
    } catch (e) {
      diagnostics.push(
        `reservation: failed — ${e instanceof Error ? e.message : String(e)}`
      );
      return {
        outcome: "no-capacity",
        match: matchResult.selected,
        matchResult,
        diagnostics,
      };
    }
    diagnostics.push(
      `reservation: ${reservation.id} (commitmentId=${reservation.commitmentId ?? "<none>"})`
    );

    // ── 3. Materialise the commitment ─────────────────────────────────────
    const commitment = this.commitmentEngine.create(
      reservation,
      input.provenance,
      input.now
    );
    diagnostics.push(`commitment: ${commitment.id} (status=${commitment.status})`);

    // ── 4. Assign ─────────────────────────────────────────────────────────
    const assignment = this.assignmentEngine.assign({
      taskId: input.taskId,
      executionPlanId: input.executionPlanId,
      resourceId: matchResult.selected.resourceId,
      capabilityId: matchResult.selected.capabilityId,
      commitmentId: commitment.id,
      tenantId: input.tenantId,
      provenance: input.provenance,
      now: input.now,
    });
    diagnostics.push(`assignment: ${assignment.id} (status=${assignment.status})`);

    return {
      outcome: "assigned",
      match: matchResult.selected,
      matchResult,
      reservation,
      commitment,
      assignment,
      diagnostics,
    };
  }
}
