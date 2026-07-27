/**
 * @kernel/control-plane/domain/control-plane-service — the port.
 *
 * The ControlPlaneService produces a `PlatformSnapshot` from the live kernel
 * registries + lifecycle managers. It is READ-ONLY: it queries state, never
 * mutates it. Mutating operations (install/upgrade/disable/rollback) go
 * through the lifecycle managers directly.
 */

import type { PlatformSnapshot } from "./platform-snapshot";

export interface ControlPlaneService {
  /** Produce a full platform snapshot (read-only). */
  snapshot(): Promise<PlatformSnapshot>;
}
