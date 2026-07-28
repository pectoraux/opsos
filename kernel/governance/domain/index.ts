/**
 * @kernel/governance/domain — barrel. Re-exports every domain type and port.
 *
 * The domain layer depends ONLY on `@kernel/shared-kernel` (and on itself).
 * No application, infrastructure, or I/O concerns leak in here.
 */
export * from "./feature-lifecycle";
export * from "./version-artifact";
export * from "./certification";
export * from "./compatibility";
export * from "./migration";
export * from "./governance-policy";
export * from "./evolution-history";
export * from "./governance-registry";
