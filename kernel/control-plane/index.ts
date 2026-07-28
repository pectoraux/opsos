/**
 * @kernel/control-plane — root entry.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ADR-0014: The Control Plane is a read-only admin surface.              │
 * │  Platform administrators only. Mutating actions require confirmation.   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export * from "./interfaces";
