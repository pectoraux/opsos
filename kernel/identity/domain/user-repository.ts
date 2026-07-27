/**
 * @kernel/identity/domain/user-repository — the UserRepository port.
 *
 * Extends the generic `EventSourcedRepository<UserState, UserEventPayload>`
 * with a `findById` convenience that returns `null` when the user does not
 * exist (rather than an empty aggregate).
 *
 * Concrete adapters live in `infrastructure/`. The port is the only surface
 * the application layer depends on (dependency inversion).
 */

import type { UserId } from "@kernel/shared-kernel";
import type {
  EventSourcedRepository,
  EventSourcedAggregate,
} from "@kernel/events";
import type { UserState } from "./user";
import type { UserEventPayload } from "./identity-events";

/**
 * Repository for User aggregates. Adds `findById` (returns null when the user
 * has no events) on top of the generic `EventSourcedRepository` contract.
 */
export interface UserRepository
  extends EventSourcedRepository<UserState, UserEventPayload> {
  /**
   * Load a user by id, returning `null` if the stream is empty (the user does
   * not exist). Distinguishes "not found" from "exists but unmodified" — the
   * base `load` returns an empty aggregate in both cases.
   */
  findById(
    id: UserId
  ): Promise<EventSourcedAggregate<UserState, UserEventPayload> | null>;
}
