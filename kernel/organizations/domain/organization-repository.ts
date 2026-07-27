/**
 * @kernel/organizations/domain/organization-repository — the port.
 *
 * Extends the generic `EventSourcedRepository<OrganizationState,
 * OrganizationEventPayload>` with two convenience lookups:
 *   - `findById(id)` — returns `null` when the org stream is empty (the org
 *     does not exist), distinguishing "not found" from "exists but unmodified".
 *   - `findBySlug(slug)` — lookup by unique slug.
 *
 * Concrete adapters live in `infrastructure/`. The application layer depends
 * only on this port (dependency inversion).
 */

import type { OrganizationId } from "@kernel/shared-kernel";
import type {
  EventSourcedRepository,
  EventSourcedAggregate,
} from "@kernel/events";
import type { OrganizationState } from "./organization";
import type { OrganizationEventPayload } from "./organization-events";

/**
 * Repository for Organization aggregates. Adds `findById` (returns null when
 * the org has no events) and `findBySlug` (lookup by unique slug) on top of
 * the generic `EventSourcedRepository` contract.
 */
export interface OrganizationRepository
  extends EventSourcedRepository<OrganizationState, OrganizationEventPayload> {
  /**
   * Load an org by id, returning `null` if the stream is empty (the org does
   * not exist).
   */
  findById(
    id: OrganizationId
  ): Promise<EventSourcedAggregate<OrganizationState, OrganizationEventPayload> | null>;

  /**
   * Load an org by slug, returning `null` if no org has the slug.
   */
  findBySlug(
    slug: string
  ): Promise<EventSourcedAggregate<OrganizationState, OrganizationEventPayload> | null>;
}
