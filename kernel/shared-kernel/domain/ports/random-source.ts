/**
 * @kernel/shared-kernel — RandomSource port.
 *
 * THE source of randomness inside the deterministic core. `Math.random()` is
 * forbidden in `domain/` and `application/`; every random value flows through
 * the seeded `RandomSource` instance carried by `ExecutionContext`.
 *
 * A given seed MUST produce an identical sequence — this is what makes kernel
 * execution replayable and simulations reproducible.
 */

export interface RandomSource {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [inclusiveMin, exclusiveMax). */
  int(inclusiveMin: number, exclusiveMax: number): number;
  /** Pick a deterministic element from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Shuffle a copy of the array deterministically (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** A fresh UUID v4 string derived from the stream (deterministic for a seed). */
  uuid(): string;
}

/**
 * mulberry32 — a tiny, fast, deterministic PRNG. Not cryptographically secure,
 * which is exactly right for a deterministic kernel (security-grade randomness
 * belongs in infrastructure adapters, not the deterministic core).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a 32-bit seed (xfnv1a). */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}
