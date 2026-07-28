/**
 * @kernel/coordination — public surface.
 *
 * The Coordination Kernel — the universal coordination engine that sits
 * between planning (compiler) and execution (runtime). It coordinates WHO
 * will perform work; it never performs work itself. Marketplace is ONE
 * strategy on top, not the kernel itself.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Lifecycle:          ExchangeState, LEGAL_TRANSITIONS, canTransition, …
 *   - Events:             CoordinationEvent union + per-kind payload types
 *   - Optimization:       OptimizationEvaluator, OptimizationRegistry, …
 *   - Engines (ports):    MatchingEngine, NegotiationEngine, ReservationEngine,
 *                          CommitmentEngine, AssignmentEngine, QueueEngine,
 *                          TransferEngine, EscalationEngine
 *   - Protocol extensions:the 8 ports protocols register
 *   - Application:        CoordinateWork use-case + CoordinateWorkUseCase class
 *   - Infrastructure:     In-memory implementations of every engine +
 *                          createInMemoryCoordinationEngines() bundle helper
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument.
 *   - All randomness flows through the seeded `RandomSource` (from
 *     `@kernel/shared-kernel`), injected via `QueueEngineContext.random` for
 *     the `weighted` queue discipline.
 *   - Matching ties broken by `resourceId` lexicographic order.
 *   - Every engine method is a pure function of its inputs.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
