/**
 * @kernel/protocol-sdk — root entry. Re-exports the public interfaces barrel.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ADR-0012: Protocols describe work; they never execute it.              │
 * │  The compiler compiles; the runtime executes; protocols describe.       │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export * from "./interfaces";
