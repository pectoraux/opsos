/**
 * @kernel/runtime/domain — barrel.
 *
 * The pure, dependency-light core of the runtime module: the execution
 * context, graph + topological order, operation port/registry, runtime state,
 * execution result, and the executor port. No I/O, no adapters.
 */

export * from "./execution-context";
export * from "./execution-graph";
export * from "./operation";
export * from "./runtime-state";
export * from "./execution-result";
export * from "./runtime-executor";
