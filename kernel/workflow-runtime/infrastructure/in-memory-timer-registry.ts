/**
 * @kernel/workflow-runtime/infrastructure/in-memory-timer-registry — the
 * reference `TimerRegistry` implementation.
 *
 * Pure `Map<string, Timer>` keyed by `timer.id`. `getDue(now)` returns pending
 * timers with `firesAt <= now`, ordered by `firesAt` then `id` (stable).
 * `fire` and `cancel` produce new immutable `Timer` values and replace the
 * stored entry. No `Date.now()`, no `Math.random()`.
 */

import type { Timer, TimerRegistry } from "../domain";

export class InMemoryTimerRegistry implements TimerRegistry {
  private readonly timers = new Map<string, Timer>();

  schedule(timer: Timer): void {
    this.timers.set(timer.id, timer);
  }

  cancel(timerId: string): void {
    const t = this.timers.get(timerId);
    if (!t) return;
    if (t.status === "pending") {
      this.timers.set(timerId, { ...t, status: "cancelled" });
    }
  }

  getDue(now: number): readonly Timer[] {
    const due: Timer[] = [];
    for (const t of this.timers.values()) {
      if (t.status === "pending" && t.firesAt <= now) {
        due.push(t);
      }
    }
    due.sort((a, b) =>
      a.firesAt !== b.firesAt
        ? a.firesAt - b.firesAt
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0
    );
    return due;
  }

  fire(timerId: string, now: number): Timer | undefined {
    const t = this.timers.get(timerId);
    if (!t) return undefined;
    if (t.status !== "pending") return t;
    const fired: Timer = { ...t, status: "fired" };
    this.timers.set(timerId, fired);
    return fired;
  }

  get(timerId: string): Timer | undefined {
    return this.timers.get(timerId);
  }

  list(): readonly Timer[] {
    return Array.from(this.timers.values());
  }
}
