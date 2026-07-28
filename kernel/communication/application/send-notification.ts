/**
 * @kernel/communication/application/send-notification — the use-case that sends
 * a notification through the NotificationEngine.
 *
 * Thin orchestration: validates the notification, delegates to the engine, and
 * returns the NotificationResult. Provided as a callable use-case so
 * application code can compose communication into higher-level workflows
 * (escalation chains, scheduled digests, etc.).
 *
 * The use-case does NOT inject time — that flows through `engine.send(n, now)`.
 * The caller supplies `now` explicitly (deterministic core: no Date.now()).
 *
 * Validation:
 *   - notification.recipientId non-empty.
 *   - notification.channels non-empty.
 *   - notification.body non-empty (unless templateRef is set).
 *
 * Returns the NotificationResult on success. On validation failure, returns a
 * NotificationResult with `dispatched: false` and an explanatory `errors`
 * entry (the use-case does not throw — failures are values, per shared-kernel
 * convention).
 */
import type {
  Notification,
  NotificationEngine,
  NotificationResult,
} from "../domain";

// ── Input ───────────────────────────────────────────────────────────────────

export interface SendNotificationInput {
  readonly notification: Notification;
  readonly now: number;
}

export interface SendNotificationDeps {
  readonly engine: NotificationEngine;
}

// ── Use-case ────────────────────────────────────────────────────────────────

export class SendNotification {
  constructor(private readonly deps: SendNotificationDeps) {}

  execute(input: SendNotificationInput): NotificationResult {
    const { notification, now } = input;
    const errors: string[] = [];

    if (!notification.recipientId) {
      errors.push("notification.recipientId must be non-empty");
    }
    if (notification.channels.length === 0) {
      errors.push("notification.channels must be non-empty");
    }
    if (!notification.body && !notification.templateRef) {
      errors.push("notification.body must be non-empty (or templateRef must be set)");
    }

    if (errors.length > 0) {
      return {
        notificationId: notification.id,
        dispatched: false,
        deliveryResults: [],
        suppressedChannels: [],
        errors,
      };
    }

    return this.deps.engine.send(notification, now);
  }
}

/**
 * Functional form. Convenience for callers who already have an engine and want
 * to skip the class ceremony.
 */
export function sendNotification(
  deps: SendNotificationDeps,
  input: SendNotificationInput
): NotificationResult {
  return new SendNotification(deps).execute(input);
}
