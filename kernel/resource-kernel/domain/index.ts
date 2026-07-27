/**
 * @kernel/resource-kernel/domain — barrel.
 *
 * The domain layer of the Resource Kernel. Pure types + pure functions +
 * pure constants. Depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - ResourceRegistry PORT + FindCapableRequest / CapableResource + scoring
 *     constants
 *   - AvailabilityEngine PORT + state machine (LEGAL_AVAILABILITY_TRANSITIONS,
 *     canTransitionAvailability, ACCEPTING_STATES, BLOCKED_STATES, isBlocked)
 *   - CapacityTracker PORT + CapacityInfo / CapacityReservation /
 *     FutureCapacitySnapshot
 *   - LocationResolver PORT + TravelModel
 *   - ResourceCalendar PORT + computeCalendarId
 *   - SkillRegistry PORT (certifications + confidence)
 *   - TwinManager PORT + TwinState / TwinPrediction + computeTwinId
 *   - MaintenanceTracker PORT + MaintenanceScheduleInput +
 *     LEGAL_MAINTENANCE_TRANSITIONS + canTransitionMaintenance
 *   - QualityMetrics PORT + QualityOutcome + DEFAULT_QUALITY_WINDOW_SIZE +
 *     DEFAULT_QUALITY_SCORE
 */

// ── Availability engine ────────────────────────────────────────────────────
export type { AvailabilityEngine } from "./availability-engine";
export type { AvailabilityState } from "./availability-engine";
export {
  ACCEPTING_STATES,
  BLOCKED_STATES,
  LEGAL_AVAILABILITY_TRANSITIONS,
  canTransitionAvailability,
  isBlocked,
} from "./availability-engine";

// ── Capacity tracker ──────────────────────────────────────────────────────
export type {
  CapacityTracker,
  CapacityInfo,
  CapacityReservation,
  FutureCapacitySnapshot,
} from "./capacity-tracker";

// ── Location resolver ─────────────────────────────────────────────────────
export type { LocationResolver, TravelModel } from "./location-resolver";

// ── Resource calendar ─────────────────────────────────────────────────────
export type { ResourceCalendar } from "./resource-calendar";
export { computeCalendarId } from "./resource-calendar";

// ── Skill registry ────────────────────────────────────────────────────────
export type { SkillRegistry } from "./skill-registry";

// ── Twin manager ──────────────────────────────────────────────────────────
export type {
  TwinManager,
  TwinState,
  TwinPrediction,
} from "./twin-manager";
export { computeTwinId } from "./twin-manager";

// ── Maintenance tracker ───────────────────────────────────────────────────
export type {
  MaintenanceTracker,
  MaintenanceScheduleInput,
} from "./maintenance-tracker";
export {
  LEGAL_MAINTENANCE_TRANSITIONS,
  canTransitionMaintenance,
} from "./maintenance-tracker";

// ── Quality metrics ───────────────────────────────────────────────────────
export type {
  QualityMetrics,
  QualityOutcome,
} from "./quality-metrics";
export {
  DEFAULT_QUALITY_WINDOW_SIZE,
  DEFAULT_QUALITY_SCORE,
} from "./quality-metrics";

// ── Resource registry (the spine port) ────────────────────────────────────
export type {
  ResourceRegistry,
  FindCapableRequest,
  CapableResource,
} from "./resource-registry";
export {
  AVAILABLE_WEIGHT,
  CERTIFIED_WEIGHT,
  REMAINING_CAPACITY_WEIGHT,
  CONFIDENCE_WEIGHT,
} from "./resource-registry";
