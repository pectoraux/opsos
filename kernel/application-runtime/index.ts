/**
 * @kernel/application-runtime — root entry. Re-exports the public interfaces barrel.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ADR-0013: Applications are installed instances of protocols.           │
 * │  One protocol → many branded applications. No duplicated logic.         │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export * from "./interfaces";
