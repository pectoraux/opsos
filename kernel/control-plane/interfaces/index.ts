/**
 * @kernel/control-plane/interfaces — public surface.
 *
 * The Platform Control Plane: the administrative interface for managing OpsOS
 * itself. Read-only by default; platform-admin only. Applications continue
 * hiding OpsOS completely.
 */
export * from "../domain";
export * from "../application";
