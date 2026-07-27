/**
 * @kernel/identity/application/command-context — local CommandContext.
 *
 * The minimal context every identity command handler needs: a clock, a seeded
 * random source, the acting principal/tenant (opaque, may be null for
 * unauthenticated bootstrap commands like `registerUser`), and a correlation
 * id for event metadata threading.
 *
 * Determinism rules:
 *   - `clock.now()` is the ONLY source of timestamps inside application/.
 *   - `random.uuid()` is the ONLY source of new ids.
 *   - `Date.now()` / `Math.random()` are FORBIDDEN here.
 *
 * The runtime module's `ExecutionContext` satisfies `CommandContext`
 * STRUCTURALLY — callers pass an `ExecutionContext` directly; no adapter is
 * needed. Identity deliberately does NOT import `@kernel/runtime` (the
 * dependency graph forbids it); structural compatibility is the seam.
 */

import type {
  RuntimeClock,
  RandomSource,
  PrincipalId,
  TenantId,
} from "@kernel/shared-kernel";

export interface CommandContext {
  /** Sanctioned source of time. `Date.now()` is forbidden in application/. */
  readonly clock: RuntimeClock;
  /** Sanctioned source of randomness. `Math.random()` is forbidden in application/. */
  readonly random: RandomSource;
  /** The actor invoking the command, or `null` for unauthenticated bootstrap. */
  readonly principalId: PrincipalId | null;
  /** The tenancy boundary, or `null` for cross-tenant bootstrap. */
  readonly tenantId: TenantId | null;
  /** Correlation id threaded into emitted event metadata. */
  readonly correlationId: string;
}
