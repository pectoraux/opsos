/**
 * @kernel/communication/application/schedule-notification — the use-case that
 * schedules a notification for future delivery.
 *
 * Thin orchestration: validates the notification + sendAt, delegates to
 * `engine.schedule()`, returns the scheduled Notification.
 *
 * Validation:
 *   - notification.recipientId non-empty.
 *   - notification.channels non-empty.
 *   - sendAt strictly greater than the supplied `now` (scheduling in the past
 *     is rejected — the caller should use `sendNotification` instead).
 *
 * Returns `{ ok: true, notification }` on success or
 * `{ ok: false, error }` on validation failure. Failures are values (the
 * use-case does not throw — per shared-kernel convention).
 */
import type { Notification, NotificationEngine } from "../domain";
import type { Result } from "@kernel/shared-kernel";

// ── Input ───────────────────────────────────────────────────────────────────

export interface ScheduleNotificationInput {
  readonly notification: Notification;
  /** Epoch-millis. MUST be > `now`. */
  readonly sendAt: number;
  /** Epoch-millis of "now". The use-case compares `sendAt` against this. */
  readonly now: number;
}

export interface ScheduleNotificationDeps {
  readonly engine: NotificationEngine;
}

export type ScheduleNotificationOutcome = Result<Notification, string>;

// ── Use-case ────────────────────────────────────────────────────────────────

export class ScheduleNotification {
  constructor(private readonly deps: ScheduleNotificationDeps) {}

  execute(input: ScheduleNotificationInput): ScheduleNotificationOutcome {
    const { notification, sendAt, now } = input;

    if (!notification.recipientId) {
      return { ok: false, error: "notification.recipientId must be non-empty" };
    }
    if (notification.channels.length === 0) {
      return { ok: false, error: "notification.channels must be non-empty" };
    }
    if (!notification.body && !notification.templateRef) {
      return { ok: false, error: "notification.body must be non-empty (or templateRef must be set)" };
    }
    if (!(sendAt > now)) {
      return {
        ok: false,
        error: `sendAt (${sendAt}) must be strictly greater than now (${now})`,
      };
    }

    const scheduled = this.deps.engine.schedule(notification, sendAt);
    return { ok: true, value: scheduled };
  }
}

/**
 * Functional form.
 */
export function scheduleNotification(
  deps: ScheduleNotificationDeps,
  input: ScheduleNotificationInput
): ScheduleNotificationOutcome {
  return new ScheduleNotification(deps).execute(input);
}
