/**
 * @kernel/application-runtime/interfaces — public surface.
 *
 * The Application Runtime: turns a protocol into installed, branded, tenant-aware
 * applications. One protocol may power thousands of applications. Applications
 * never duplicate protocol logic — they describe user experience.
 *
 * Everything outside the kernel depends on `@kernel/api/v1` (which re-exports
 * this module's public surface).
 */
export * from "../applications";
export * from "../lifecycle";
export * from "../installer";
export * from "../branding";
export * from "../routing";
export * from "../configuration";
export * from "../features";
export * from "../navigation";
export * from "../tenants";
export * from "../ui";
export * from "../domains";
export * from "../authentication";
export * from "../localization";
export * from "../storage";
export * from "../versioning";
export * from "../sdk";
export { eksCleanDemoApplication } from "../demo/eks-clean-demo-application";
