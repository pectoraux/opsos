/**
 * @kernel/compiler — root entry. Re-exports the public interfaces barrel.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ADR-0011: The compiler creates work; the runtime executes work.        │
 * │  Intent → compile() → ExecutionGraph → execute() → Execution.           │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export * from "./interfaces";
