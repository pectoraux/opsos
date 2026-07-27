/**
 * @kernel/api/v1 — RESOURCE-KERNEL public surface (FROZEN).
 *
 * The Resource Kernel: owns universal resource concepts (state, availability,
 * capacity, location, calendar, skills, certification, twin, maintenance,
 * quality). The Coordination Kernel queries it: "give me resources capable of
 * X" (ADR-0016).
 */

// Ports
export type {
  ResourceRegistry,
  FindCapableRequest,
  CapableResource,
} from "@kernel/resource-kernel";
export type { AvailabilityEngine, AvailabilityState } from "@kernel/resource-kernel";
export type { CapacityTracker, CapacityInfo } from "@kernel/resource-kernel";
export type { LocationResolver } from "@kernel/resource-kernel";
export type { ResourceCalendar } from "@kernel/resource-kernel";
export type { SkillRegistry } from "@kernel/resource-kernel";
export type { TwinManager, TwinState } from "@kernel/resource-kernel";
export type { MaintenanceTracker } from "@kernel/resource-kernel";
export type { QualityMetrics } from "@kernel/resource-kernel";

// State machine helpers
export {
  LEGAL_AVAILABILITY_TRANSITIONS,
  canTransitionAvailability,
  isBlocked,
  ACCEPTING_STATES,
  BLOCKED_STATES,
} from "@kernel/resource-kernel";
export {
  LEGAL_MAINTENANCE_TRANSITIONS,
  canTransitionMaintenance,
} from "@kernel/resource-kernel";

// Scoring
export { computeMatchScore } from "@kernel/resource-kernel";
export {
  AVAILABLE_WEIGHT,
  CERTIFIED_WEIGHT,
  REMAINING_CAPACITY_WEIGHT,
  CONFIDENCE_WEIGHT,
} from "@kernel/resource-kernel";

// Use-cases
export type { FindCapableResourcesInput, FindCapableFilters } from "@kernel/resource-kernel";
export { FindCapableResourcesUseCase } from "@kernel/resource-kernel";
export type { ReserveCapacityInput, ReserveCapacityResult, ReserveCapacityOutcome } from "@kernel/resource-kernel";
export { ReserveCapacityUseCase } from "@kernel/resource-kernel";
export type { UpdateTwinInput, UpdateTwinResult } from "@kernel/resource-kernel";
export { UpdateTwinUseCase } from "@kernel/resource-kernel";

// Infrastructure
export {
  InMemoryResourceRegistry,
  InMemoryAvailabilityEngine,
  InMemoryCapacityTracker,
  InMemoryLocationResolver,
  InMemoryResourceCalendar,
  InMemorySkillRegistry,
  InMemoryTwinManager,
  InMemoryMaintenanceTracker,
  InMemoryQualityMetrics,
  createInMemoryResourceKernel,
} from "@kernel/resource-kernel";
export type { InMemoryResourceKernel } from "@kernel/resource-kernel";
