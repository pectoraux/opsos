/**
 * @kernel/api/v1 — THE frozen public API of the OpsOS kernel (ADR-0009).
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  EVERYTHING OUTSIDE THE KERNEL DEPENDS ONLY ON `@kernel/api/v1`.        │
 * │  Protocols, applications, the admin console, tests — all of them import │
 * │  from here. No code outside the kernel may import from `@kernel/<module>`│
 * │  internal paths.                                                        │
 * │                                                                         │
 * │  This file is FROZEN. Breaking changes require a new version (v2).      │
 * │  Additive changes (new optional fields, new exported types) are         │
 * │  permitted within v1.                                                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * The v1 surface is grouped by concern. Each sub-module re-exports ONLY the
 * stable contracts (types, ports, pure functions, and the sanctioned in-memory
 * adapters used for self-test). Internal implementation classes that are not
 * part of the contract are excluded.
 */

// Foundation
export * from "./shared-kernel";
export * from "./events";
export * from "./observability";
export * from "./config";

// Engine
export * from "./runtime";

// Context
export * from "./identity";
export * from "./organizations";

// Read side & governance
export * from "./projections";
export * from "./policy";

// Temporal foundation
export * from "./scheduling";

// Work creation (compiler) + protocol host (extension)
export * from "./compiler";
export * from "./extensions";
