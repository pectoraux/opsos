/**
 * @kernel/compiler/interfaces — public surface.
 *
 * The Intent → ExecutionGraph compiler framework (ADR-0011). The compiler is
 * the ONLY component that creates work; the runtime only executes it.
 */
export * from "../domain";
export * from "../stages";
export * from "../application";
export * from "../infrastructure";
