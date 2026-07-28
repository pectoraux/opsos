/**
 * @kernel/identity/domain/role — Role & Permission value objects.
 *
 * Pure, generic, industry-agnostic authorisation primitives. `Permission`
 * uses glob-style `resourcePattern` (e.g. `"resource:*"`) and a generic
 * `action` string ("read" | "write" | "execute" | …) — there is NO concept of
 * cleaning, delivery, healthcare, etc. here. Concrete resources and actions
 * are installed later as protocols.
 *
 * `Role` bundles a set of `PermissionId`s at a defined `scope` and `priority`
 * (higher priority wins on conflict; deny wins over allow at equal priority).
 */

import type { RoleId, PermissionId } from "@kernel/shared-kernel";

/** Whether a permission grants or forbids the action. */
export type PermissionEffect = "allow" | "deny";

/**
 * A single authorisation permission. Pure data — evaluation lives in the
 * `@kernel/policy` module.
 */
export interface Permission {
  readonly id: PermissionId;
  /** Generic action verb, e.g. "read" | "write" | "execute" | "delete". */
  readonly action: string;
  /** Glob-style resource matcher, e.g. "resource:*" or "resource:123". */
  readonly resourcePattern: string;
  /** Allow or deny. Deny wins ties (least-privilege default). */
  readonly effect: PermissionEffect;
}

/** Where a role applies — global, organisation-scoped, or tenant-scoped. */
export type RoleScope = "global" | "organization" | "tenant";

/**
 * A named bundle of permissions with a priority and a scope. Roles are
 * attached to a `User` (via `RoleAssigned` events) and resolved into a
 * `Principal.scopes` set at authentication time.
 */
export interface Role {
  readonly id: RoleId;
  /** Human-readable role name, e.g. "admin", "operator", "viewer". */
  readonly name: string;
  /** Granularity at which the role is granted. */
  readonly scope: RoleScope;
  /** Permissions composing the role (looked up by id in the policy engine). */
  readonly permissionIds: readonly PermissionId[];
  /**
   * Higher priority overrides lower on conflict. At equal priority, `deny`
   * beats `allow`. Stable, deterministic ordering rule.
   */
  readonly priority: number;
}
