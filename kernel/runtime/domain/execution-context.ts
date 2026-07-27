/**
 * @kernel/runtime/domain/execution-context — THE central type of the kernel.
 *
 * `ExecutionContext` is the immutable bundle carried through every deterministic
 * operation. It is the *only* sanctioned channel for time (`clock`), randomness
 * (`random`), observability, config, and identity (opaque `principalId` /
 * `tenantId`). Domain code MUST NOT reach outside this context for any of these.
 *
 * Identity fields (`principalId`, `tenantId`) are deliberately opaque branded
 * strings — the runtime module imports NOTHING from `@kernel/identity` or
 * `@kernel/organizations`. Higher layers attach meaning to these IDs; the
 * runtime merely carries them.
 *
 * `derive()` returns a NEW context (immutable) with the supplied overrides
 * applied; `clock` / `random` / `observability` / `config` are SHARED by
 * reference, never copied — they are singletons for the lifetime of an
 * execution.
 */

import type {
  RuntimeClock,
  RandomSource,
  PrincipalId,
  TenantId,
} from "@kernel/shared-kernel";
import type { ObservabilityBundle } from "@kernel/observability";
import type { ConfigRegistry } from "@kernel/config";

/**
 * The execution context. Pure data + a pure `derive` combinator. No methods
 * that perform I/O or mutate anything.
 */
export interface ExecutionContext {
  /** Sanctioned source of time. `Date.now()` is forbidden outside the runtime clock impl. */
  readonly clock: RuntimeClock;
  /** Sanctioned source of randomness. `Math.random()` is forbidden inside the core. */
  readonly random: RandomSource;
  /** Tracing, metrics, logging, audit, provenance. */
  readonly observability: ObservabilityBundle;
  /** Merged configuration view. */
  readonly config: ConfigRegistry;
  /** Opaque security principal — runtime MUST NOT import the identity module. */
  readonly principalId: PrincipalId | null;
  /** Opaque tenancy boundary — runtime MUST NOT import the organizations module. */
  readonly tenantId: TenantId | null;
  /** Correlation id threading this logical operation end-to-end. */
  readonly correlationId: string;
  /** Trace id for distributed tracing. */
  readonly traceId: string;
  /** Optional id of the event/command that caused this execution. */
  readonly causationId?: string;
  /** Free-form, immutable metadata bag. */
  readonly metadata: Readonly<Record<string, unknown>>;

  /**
   * Derive a child context with overridden fields (e.g. a new `causationId`
   * for a sub-operation). Pure: returns a NEW context; never mutates `this`.
   * The shared dependencies (`clock`, `random`, `observability`, `config`) are
   * passed by reference to the child.
   */
  derive(overrides?: Partial<ExecutionContextOverrides>): ExecutionContext;
}

/**
 * Fields that may be overridden via `derive()`. The shared dependencies are
 * intentionally absent — they cannot be swapped out on a derived context.
 */
export type ExecutionContextOverrides = {
  readonly principalId?: PrincipalId | null;
  readonly tenantId?: TenantId | null;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly causationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};
