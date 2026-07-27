/**
 * @kernel/application-runtime/lifecycle/lifecycle-state — application lifecycle
 * states + legal transitions.
 *
 *   Draft → Installed → Configured → Active ⇄ Suspended → Archived → Removed
 *
 * The kernel owns lifecycle management. Applications cannot change their own
 * lifecycle — they request transitions through the ApplicationLifecycleManager.
 */

export type ApplicationLifecycleState =
  | "draft"
  | "installed"
  | "configured"
  | "active"
  | "suspended"
  | "archived"
  | "removed";

export interface ApplicationLifecycleEvent {
  readonly applicationId: string;
  readonly from: ApplicationLifecycleState;
  readonly to: ApplicationLifecycleState;
  readonly at: number;
  readonly reason?: string;
}

const LEGAL: Readonly<Record<ApplicationLifecycleState, readonly ApplicationLifecycleState[]>> = {
  draft: ["installed", "removed"],
  installed: ["configured", "archived", "removed"],
  configured: ["active", "archived", "removed"],
  active: ["suspended", "archived", "removed"],
  suspended: ["active", "archived", "removed"],
  archived: ["removed"],
  removed: [],
};

export function canTransition(
  from: ApplicationLifecycleState,
  to: ApplicationLifecycleState
): boolean {
  return LEGAL[from]?.includes(to) ?? false;
}

/** True if the application is "live" — routable + serving requests. */
export function isLive(state: ApplicationLifecycleState): boolean {
  return state === "active";
}
