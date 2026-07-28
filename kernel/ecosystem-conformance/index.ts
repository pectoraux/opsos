/**
 * @kernel/ecosystem-conformance — root entry.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ADR-0024: Ecosystem packages must pass conformance before installation.│
 * │  If a package fails, it is REJECTED. No ecosystem bypasses the platform.│
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export * from "./interfaces";
