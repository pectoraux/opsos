/**
 * @kernel/organizations/domain/membership-repository — the port.
 *
 * Extends the generic `EventSourcedRepository<MembershipState,
 * MembershipEventPayload>` with three convenience lookups:
 *   - `findById(id)` — load by the composite `${organizationId}:${userId}` id.
 *   - `findByOrgAndUser(orgId, userId)` — lookup by (org, user) pair.
 *   - `listByOrganization(orgId)` — enumerate all memberships in an org
 *     (active, invited, and removed).
 *
 * Concrete adapters live in `infrastructure/`.
 */

import type { OrganizationId, UserId } from "@kernel/shared-kernel";
import type {
  EventSourcedRepository,
  EventSourcedAggregate,
} from "@kernel/events";
import type { MembershipState } from "./membership";
import type { MembershipEventPayload } from "./membership-events";

/**
 * Repository for Membership aggregates. Adds composite-id lookup, (org, user)
 * pair lookup, and per-org enumeration on top of the generic
 * `EventSourcedRepository` contract.
 */
export interface MembershipRepository
  extends EventSourcedRepository<MembershipState, MembershipEventPayload> {
  /**
   * Load a membership by composite id (`${organizationId}:${userId}`),
   * returning `null` if the stream is empty.
   */
  findById(
    id: string
  ): Promise<EventSourcedAggregate<MembershipState, MembershipEventPayload> | null>;

  /**
   * Load a membership by (org, user) pair, returning `null` if no such
   * membership exists.
   */
  findByOrgAndUser(
    organizationId: OrganizationId,
    userId: UserId
  ): Promise<EventSourcedAggregate<MembershipState, MembershipEventPayload> | null>;

  /**
   * Enumerate all memberships in an org (active, invited, and removed — caller
   * filters by status if needed). Order is unspecified.
   */
  listByOrganization(
    organizationId: OrganizationId
  ): Promise<readonly EventSourcedAggregate<MembershipState, MembershipEventPayload>[]>;
}
