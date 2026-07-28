/**
 * @kernel/api/v1 — CONTROL-PLANE public surface (FROZEN).
 *
 * The Platform Control Plane: read-only admin surface for managing OpsOS
 * itself (ADR-0014). Platform administrators only.
 */

export type {
  PlatformSnapshot,
  PlatformHealth,
  HealthStatus,
  ProtocolSummary,
  ApplicationSummaryCP,
  OrganizationSummary,
  CapabilityView,
  IntentTypeView,
  WorkflowView,
  PolicyView,
  CompilerExtensionView,
  ObservabilityView,
  SimulationResult,
  SimulationStep,
} from "@kernel/control-plane";
export type { ControlPlaneService } from "@kernel/control-plane";
export { DefaultControlPlaneService } from "@kernel/control-plane";
export type { ControlPlaneDeps } from "@kernel/control-plane";
