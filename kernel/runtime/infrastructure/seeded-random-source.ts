/**
 * @kernel/runtime/infrastructure/seeded-random-source — deterministic
 * implementation of `RandomSource` backed by `mulberry32`.
 *
 * A given `seed` produces an IDENTICAL sequence of values across runs and
 * across machines: `next()`, `int()`, `pick()`, `shuffle()`, and `uuid()`
 * all draw from the same mulberry32 stream. `Math.random()` is forbidden
 * here (and everywhere in the kernel); the only randomness primitive used is
 * `mulberry32` plus pure integer math (`Math.floor`, `Math.imul` — both
 * deterministic).
 *
 * `uuid()` returns a v4-shaped UUID (version nibble `4`, variant bits `10xx`)
 * whose 122 random bits are drawn from the stream — so the same seed yields
 * the same UUID sequence.
 */

import type { RandomSource } from "@kernel/shared-kernel";
import { mulberry32 } from "@kernel/shared-kernel";

export class SeededRandomSource implements RandomSource {
  private readonly next32: () => number;

  constructor(seed: number) {
    this.next32 = mulberry32(seed);
  }

  /** Float in [0, 1). */
  next(): number {
    return this.next32();
  }

  /** Integer in [inclusiveMin, exclusiveMax). */
  int(inclusiveMin: number, exclusiveMax: number): number {
    if (exclusiveMax <= inclusiveMin) {
      return inclusiveMin;
    }
    const span = exclusiveMax - inclusiveMin;
    return inclusiveMin + Math.floor(this.next32() * span);
  }

  /** Pick a deterministic element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("SeededRandomSource.pick: empty array");
    }
    return items[this.int(0, items.length)]!;
  }

  /** Shuffle a copy of the array deterministically (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i + 1);
      const tmp = out[i]!;
      out[i] = out[j]!;
      out[j] = tmp;
    }
    return out;
  }

  /**
   * A fresh UUID v4 string whose 122 random bits are drawn from the stream.
   * Deterministic for a given seed: the same `SeededRandomSource` instance
   * (or two instances with the same seed) produces the same UUID sequence.
   */
  uuid(): string {
    // 16 random bytes from the stream.
    const bytes: number[] = new Array<number>(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(this.next32() * 256);
    }
    // RFC 4122 v4: version nibble = 4 (byte 6 high nibble); variant = 10xx (byte 8 high bits).
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    const hex = bytes.map((b) => b.toString(16).padStart(2, "0"));
    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }
}
