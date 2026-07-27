/**
 * @kernel/protocol-sdk/lifecycle — protocol lifecycle states + transitions.
 *
 * The kernel owns lifecycle management. Protocols cannot change their own
 * lifecycle — they request transitions through the LifecycleManager, which
 * enforces the legal state machine.
 *
 *   Discovered → Validated → Installed → Enabled ⇄ Disabled → Uninstalled
 *                                       ↘ Upgraded ↗
 *
 * All transitions are auditable. The lifecycle state is the source of truth
 * for whether a protocol's registrations are LIVE in the kernel registries.
 */

export type ProtocolLifecycleState =
  | "discovered"
  | "validated"
  | "installed"
  | "enabled"
  | "disabled"
  | "upgraded"
  | "uninstalled";

/** A lifecycle event record (immutable). */
export interface LifecycleEvent {
  readonly protocolId: string;
  readonly from: ProtocolLifecycleState;
  readonly to: ProtocolLifecycleState;
  readonly at: number;
  readonly reason?: string;
}

/** Legal transitions. Anything not listed is rejected. */
const LEGAL: Readonly<Record<ProtocolLifecycleState, readonly ProtocolLifecycleState[]>> = {
  discovered: ["validated", "uninstalled"],
  validated: ["installed", "uninstalled"],
  installed: ["enabled", "disabled", "uninstalled"],
  enabled: ["disabled", "upgraded", "uninstalled"],
  disabled: ["enabled", "upgraded", "uninstalled"],
  upgraded: ["enabled", "disabled", "uninstalled"],
  uninstalled: [],
};

export function canTransition(
  from: ProtocolLifecycleState,
  to: ProtocolLifecycleState
): boolean {
  return LEGAL[from]?.includes(to) ?? false;
}

/** True if the state is "live" — registrations are active in the kernel. */
export function isLive(state: ProtocolLifecycleState): boolean {
  return state === "enabled" || state === "disabled" || state === "upgraded";
}
