/**
 * @kernel/identity/domain/principal — the runtime security identity.
 *
 * A `Principal` is the answer to "who is the actor?" — nothing more. It is the
 * value carried (opaquely, as `principalId`) by `ExecutionContext` and resolved
 * by the `IdentityProvider` / `Authenticator` ports.
 *
 * Identity holds `OrganizationId` and `TenantId` only as OPAQUE branded
 * strings. It does NOT import the organizations module — those IDs acquire
 * meaning only at higher layers. This is the canonical bounded-context seam
 * between identity and organizations.
 *
 * Pure data, no behaviour, no I/O.
 */

import type {
  PrincipalId,
  UserId,
  OrganizationId,
  TenantId,
} from "@kernel/shared-kernel";

/** The two classes of actor the kernel distinguishes. */
export type PrincipalType = "user" | "service";

/** Lifecycle of a principal (governs whether auth attempts succeed). */
export type PrincipalStatus = "active" | "suspended" | "disabled";

/**
 * The runtime security identity. Immutable. Resolved from a credential or a
 * token by an `IdentityProvider` / `Authenticator` and then threaded through
 * the execution context as `principalId`.
 */
export interface Principal {
  /** Stable, unique identifier of the principal (NOT the user). */
  readonly id: PrincipalId;
  /** Whether this principal represents a human user or a service account. */
  readonly type: PrincipalType;
  /** When `type === "user"`, the backing `UserId` (opaque to runtime). */
  readonly userId?: UserId;
  /**
   * Opaque organisation reference. Identity MUST NOT import the organisations
   * module — it merely carries the branded id so higher layers can scope.
   */
  readonly organizationId?: OrganizationId;
  /** Opaque tenancy boundary — the data-isolation unit. */
  readonly tenantId?: TenantId;
  /** Authorisation scopes granted to this principal (e.g. "identity:read"). */
  readonly scopes: readonly string[];
  /** Lifecycle status. Authentication rejects non-`active` principals. */
  readonly status: PrincipalStatus;
}
