/**
 * @kernel/runtime/application — barrel.
 *
 * Use-cases and builders that depend on the domain ports. No I/O adapters
 * here (those live in `infrastructure/`).
 */

export * from "./execution-context-builder";
export * from "./execute-graph";
