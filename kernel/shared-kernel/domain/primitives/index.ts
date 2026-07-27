/**
 * @kernel/shared-kernel/domain/primitives — barrel.
 *
 * The 16 canonical operational primitives. The ONLY domain concepts the kernel
 * knows. None carries any industry-specific field.
 */

export type {
  Intent,
  IntentStatus,
  Demand,
  Task,
  TaskStatus,
  ExecutionPlan,
  PlanStatus,
  Capability,
  Resource,
  Workflow,
  WorkflowStatus,
  Recommendation,
  Simulation,
} from "./operational";

export type {
  Policy,
  PolicyScope,
  PolicyEffect,
  PolicyStatus,
  Rule,
  RuleEffect,
  Decision,
  DecisionOutcome,
} from "./governance";

export type {
  Event,
  EventMetadata,
  EventType,
  EventPayload,
} from "./event";

export type { Projection } from "./projection";

export type {
  Schedule,
  ScheduleSlot,
  ScheduleStatus,
  Route,
  RouteStatus,
} from "./schedule";
