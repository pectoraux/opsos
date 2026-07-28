/**
 * @kernel/conformance/application — application barrel.
 *
 * Use-cases that compose the ConformanceEngine into higher-level workflows.
 * The application layer depends ONLY on the domain layer (ports + types).
 */
export * from "./run-conformance";
export * from "./run-suite";
