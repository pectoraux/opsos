/**
 * @kernel/shared-kernel — public surface.
 *
 * The bedrock of OpsOS. Every other kernel module depends on this and nothing
 * else at the lowest layer. Contains:
 *   - branded identifiers
 *   - Result<T,E> / Option<T>
 *   - kernel error hierarchy
 *   - versioning & temporal value objects
 *   - shared value objects (Priority, Quantity, Constraint, PredicateSpec, …)
 *   - RuntimeClock & RandomSource PORTS (abstract interfaces)
 *   - the 16 canonical operational primitives
 *
 * No use-cases, no adapters, no I/O — this is the pure, portable core.
 */
export * from "../domain";
