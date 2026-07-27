/**
 * @kernel/shared-kernel — branded identifiers.
 *
 * Branded nominal types prevent accidental cross-assignment (a TaskId cannot
 * be passed where a ResourceId is expected). IDs are opaque strings; their
 * internal format is the responsibility of the producer (usually UUIDs from
 * a seeded RandomSource so generation is deterministic).
 */

export type Brand<T, B> = T & { readonly __brand: B };

// ── Canonical primitive IDs ────────────────────────────────────────────────
export type IntentId = Brand<string, "IntentId">;
export type DemandId = Brand<string, "DemandId">;
export type TaskId = Brand<string, "TaskId">;
export type ExecutionPlanId = Brand<string, "ExecutionPlanId">;
export type CapabilityId = Brand<string, "CapabilityId">;
export type ResourceId = Brand<string, "ResourceId">;
export type WorkflowId = Brand<string, "WorkflowId">;
export type PolicyId = Brand<string, "PolicyId">;
export type RuleId = Brand<string, "RuleId">;
export type ProjectionId = Brand<string, "ProjectionId">;
export type RecommendationId = Brand<string, "RecommendationId">;
export type RouteId = Brand<string, "RouteId">;
export type ScheduleId = Brand<string, "ScheduleId">;
export type ScheduleSlotId = Brand<string, "ScheduleSlotId">;
export type DecisionId = Brand<string, "DecisionId">;
export type SimulationId = Brand<string, "SimulationId">;

// ── Identity & tenancy IDs ──────────────────────────────────────────────────
export type UserId = Brand<string, "UserId">;
export type PrincipalId = Brand<string, "PrincipalId">;
export type RoleId = Brand<string, "RoleId">;
export type PermissionId = Brand<string, "PermissionId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type TenantId = Brand<string, "TenantId">;

// ── Event-sourcing IDs ──────────────────────────────────────────────────────
export type AggregateId = Brand<string, "AggregateId">;
export type StreamId = Brand<string, "StreamId">;
export type EventId = Brand<string, "EventId">;

// ── Generic typed-string IDs (composable by callers) ────────────────────────
export type TypedId<B extends string> = Brand<string, B>;

/**
 * Construct a branded ID from a plain string. Centralised so producers never
 * cast directly — this is the sanctioned boundary between the string world and
 * the branded world.
 */
export function asId<B extends string>(value: string): Brand<string, B> {
  return value as Brand<string, B>;
}

/** Build the canonical stream id for an aggregate: `${aggregateType}#${id}`. */
export function aggregateStreamId(aggregateType: string, id: string): StreamId {
  return asId<`StreamId`>(`${aggregateType}#${id}`);
}
