/**
 * @kernel/protocol-sdk/lifecycle/lifecycle-manager — owns protocol lifecycle.
 *
 * The LifecycleManager is the ONLY component that transitions a protocol's
 * state. It coordinates with the ProtocolRegistry (to add/remove
 * registrations) and records an auditable event log.
 *
 * Per the spec: "The kernel owns lifecycle management. Protocols cannot
 * change their own lifecycle."
 */

import type { ProtocolManifest } from "../manifest/protocol-manifest";
import { KERNEL_VERSION } from "../manifest/protocol-manifest";
import {
  canTransition,
  isLive,
  type ProtocolLifecycleState,
  type LifecycleEvent,
} from "./lifecycle-state";
import { validateProtocolManifest } from "../manifest/manifest-validation";
import { resolveDependencyOrder, nodeOf } from "../validation/dependency-resolver";
import { hasErrors } from "../validation/diagnostic";
import type { SdkDiagnostic } from "../validation/diagnostic";

/** A tracked protocol + its current lifecycle state. */
export interface TrackedProtocol {
  readonly manifest: ProtocolManifest;
  readonly state: ProtocolLifecycleState;
  readonly installedAt?: number;
  readonly lastTransitionAt: number;
}

export interface LifecycleTransitionResult {
  readonly ok: boolean;
  readonly protocolId: string;
  readonly from: ProtocolLifecycleState;
  readonly to: ProtocolLifecycleState;
  readonly diagnostics: readonly SdkDiagnostic[];
  readonly reason?: string;
}

/** Port: the lifecycle manager. */
export interface ProtocolLifecycleManager {
  discover(manifest: ProtocolManifest): LifecycleTransitionResult;
  validate(protocolId: string): LifecycleTransitionResult;
  install(protocolId: string): LifecycleTransitionResult;
  enable(protocolId: string): LifecycleTransitionResult;
  disable(protocolId: string): LifecycleTransitionResult;
  upgrade(protocolId: string, newManifest: ProtocolManifest): LifecycleTransitionResult;
  uninstall(protocolId: string): LifecycleTransitionResult;
  getState(protocolId: string): ProtocolLifecycleState | undefined;
  getProtocol(protocolId: string): TrackedProtocol | undefined;
  list(): readonly TrackedProtocol[];
  events(): readonly LifecycleEvent[];
}
