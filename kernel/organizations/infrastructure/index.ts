/**
 * @kernel/organizations/infrastructure — barrel.
 *
 * Reference in-memory adapters for the organizations bounded context. Suitable
 * for kernel self-test, the read-only inspector, and tests. NOT for production
 * persistence — real adapters (persisted EventStore, unique-slug index,
 * per-org membership index) are installed later.
 *
 * The in-memory adapters are part of the public surface (consistent with how
 * `@kernel/events` exposes `InMemoryEventStore` and `@kernel/identity` exposes
 * `InMemoryUserRepository`).
 */
export {
  InMemoryOrganizationRepository,
  type InMemoryOrganizationRepositoryDeps,
} from "./in-memory-organization-repository";
export {
  InMemoryMembershipRepository,
  type InMemoryMembershipRepositoryDeps,
} from "./in-memory-membership-repository";
