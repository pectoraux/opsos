/**
 * @kernel/communication/infrastructure/in-memory-notification-engine — the
 * default in-memory `NotificationEngine` implementation.
 *
 * Orchestrates the full send pipeline:
 *
 *   1. Resolve the recipient via RecipientRegistry.
 *   2. For each channelId in notification.channels:
 *      a. Resolve the channel via ChannelRegistry.
 *      b. Skip if channel is not `active` (recorded as an error, NOT as a
 *         suppressed channel — suppression is recipient-driven, not
 *         channel-driven).
 *      c. Check suppression via SuppressionChecker.isSuppressed. If
 *         suppressed, add the channel id to suppressedChannels and skip.
 *      d. Find the recipient's RecipientChannel for the channel's kind. If
 *         missing or unverified, record an error and skip.
 *      e. Render the template (if notification.templateRef is set) via
 *         TemplateRegistry. Apply the rendered subject/body to the Message.
 *      f. Build the Message, publish `message-queued`.
 *      g. Dispatch (in-memory simulation): produce a DeliveryResult. The
 *         channel's config may request a simulated failure / bounce via
 *         `simulateFailure: true` or `simulateBounce: true` (test affordance).
 *      h. Publish `message-sent` / `message-failed`. If bounced, auto-suppress
 *         the recipient+channelKind and publish `bounce-detected`.
 *   3. Aggregate into NotificationResult. Publish `notification-dispatched`.
 *   4. If the notification was scheduled, remove it from the scheduled map.
 *
 * Determinism (CRITICAL):
 *   - NO `Date.now()` / `Math.random()` anywhere.
 *   - All time via the `now` argument.
 *   - Message ids, event ids, and provider refs are derived from `hashSeed`
 *     (xfnv1a) of deterministic inputs — the same notification + now always
 *     produces the same ids.
 *   - Channel iteration order is the order of `notification.channels` (NOT
 *     re-sorted) — callers control the dispatch order.
 *   - Event publishing uses an internal monotonic counter (per engine
 *     instance) to guarantee event id uniqueness within a single dispatch
 *     even when timestamps collide. The counter is deterministic given the
 *     same call sequence.
 *
 * The engine's scheduled-notifications store is a Map keyed by notification
 * id; `listScheduled()` returns entries in (scheduledFor ASC, id ASC) order.
 */
import { hashSeed } from "@kernel/shared-kernel";
import type {
  Channel,
  ChannelRegistry,
  CommunicationEvent,
  CommunicationEventKind,
  CommunicationEventStream,
  DeliveryResult,
  Message,
  Notification,
  NotificationEngine,
  NotificationResult,
  Recipient,
  RecipientRegistry,
  SuppressionChecker,
  TemplateRegistry,
} from "../domain";

// ── Engine options ──────────────────────────────────────────────────────────

export interface InMemoryNotificationEngineOptions {
  readonly channels: ChannelRegistry;
  readonly recipients: RecipientRegistry;
  readonly templates: TemplateRegistry;
  readonly suppressions: SuppressionChecker;
  readonly events: CommunicationEventStream;
}

// ── Engine ──────────────────────────────────────────────────────────────────

export class InMemoryNotificationEngine implements NotificationEngine {
  private readonly channels: ChannelRegistry;
  private readonly recipients: RecipientRegistry;
  private readonly templates: TemplateRegistry;
  private readonly suppressions: SuppressionChecker;
  private readonly events: CommunicationEventStream;
  private readonly scheduled = new Map<string, Notification>();
  private eventCounter = 0;

  constructor(opts: InMemoryNotificationEngineOptions) {
    this.channels = opts.channels;
    this.recipients = opts.recipients;
    this.templates = opts.templates;
    this.suppressions = opts.suppressions;
    this.events = opts.events;
  }

  // ── send() ───────────────────────────────────────────────────────────────

  send(notification: Notification, now: number): NotificationResult {
    // A send() implicitly removes the notification from the scheduled set if
    // present — it has now been dispatched, so it should not appear in
    // listScheduled() anymore.
    this.scheduled.delete(notification.id);

    const deliveryResults: DeliveryResult[] = [];
    const suppressedChannels: string[] = [];
    const errors: string[] = [];

    // 1. Resolve recipient.
    const recipient = this.recipients.get(notification.recipientId);
    if (recipient === undefined) {
      errors.push(`recipient '${notification.recipientId}' not found`);
      this.publishDispatched(notification.id, now, deliveryResults, suppressedChannels, errors);
      return {
        notificationId: notification.id,
        dispatched: false,
        deliveryResults,
        suppressedChannels,
        errors,
      };
    }

    // 2. Render template (if any) ONCE — the same rendered subject/body is
    //    applied to every per-channel Message.
    let renderedSubject: string | undefined = notification.subject;
    let renderedBody: string | undefined = notification.body;
    if (notification.templateRef !== undefined) {
      const outcome = this.templates.render(
        notification.templateRef,
        notification.variables ?? {}
      );
      if (!outcome.ok) {
        errors.push(`template render failed: ${outcome.error}`);
        this.publishDispatched(notification.id, now, deliveryResults, suppressedChannels, errors);
        return {
          notificationId: notification.id,
          dispatched: false,
          deliveryResults,
          suppressedChannels,
          errors,
        };
      }
      renderedSubject = outcome.rendered!.subject ?? notification.subject;
      renderedBody = outcome.rendered!.body;
    }

    // 3. Iterate channels in the notification's declared order (deterministic).
    let channelIndex = 0;
    for (const channelId of notification.channels) {
      const channel = this.channels.get(channelId);
      if (channel === undefined) {
        errors.push(`channel '${channelId}' not found`);
        continue;
      }
      if (channel.status !== "active") {
        errors.push(
          `channel '${channelId}' is ${channel.status} (not active)`
        );
        continue;
      }

      // Suppression check (recipient-driven).
      if (this.suppressions.isSuppressed(recipient.id, channel.kind, now)) {
        suppressedChannels.push(channelId);
        continue;
      }

      // Resolve the recipient's address for this channel kind.
      const recipientChannel = recipient.channels.find((c) => c.kind === channel.kind);
      if (recipientChannel === undefined) {
        errors.push(
          `recipient '${recipient.id}' has no '${channel.kind}' channel address`
        );
        continue;
      }
      if (!recipientChannel.verified) {
        errors.push(
          `recipient '${recipient.id}' '${channel.kind}' channel address not verified`
        );
        continue;
      }

      // 4. Build + queue the Message.
      const messageId = this.messageId(notification.id, channelId, now, channelIndex);
      const message: Message = {
        id: messageId,
        channelId,
        to: [recipient],
        from: this.channelSender(channel),
        subject: renderedSubject,
        body: renderedBody ?? "",
        templateRef: notification.templateRef,
        variables: notification.variables,
        priority: notification.priority,
        status: "queued",
        createdAt: now,
        metadata: {
          notificationId: notification.id,
          recipientAddress: recipientChannel.address,
          ...(notification.metadata ?? {}),
        },
      };
      this.publishEvent("message-queued", now, {
        messageId,
        channelId,
        notificationId: notification.id,
        recipientId: recipient.id,
        channelKind: channel.kind,
      });

      // 5. Dispatch (in-memory simulation).
      const result = this.dispatch(message, channel, now);
      deliveryResults.push(result);

      if (result.status === "bounced") {
        // Auto-suppress on bounce.
        this.suppressions.suppress(
          recipient.id,
          channel.kind,
          "bounce",
          now
        );
        this.publishEvent("bounce-detected", now, {
          messageId,
          channelId,
          notificationId: notification.id,
          recipientId: recipient.id,
          channelKind: channel.kind,
          error: result.error,
        });
      } else if (result.status === "failed") {
        this.publishEvent("message-failed", now, {
          messageId,
          channelId,
          notificationId: notification.id,
          recipientId: recipient.id,
          channelKind: channel.kind,
          error: result.error,
        });
      } else {
        // sent or delivered
        this.publishEvent("message-sent", now, {
          messageId,
          channelId,
          notificationId: notification.id,
          recipientId: recipient.id,
          channelKind: channel.kind,
          providerRef: result.providerRef,
        });
      }

      channelIndex++;
    }

    // 6. Aggregate.
    const dispatched = deliveryResults.some(
      (r) => r.status === "sent" || r.status === "delivered"
    );

    this.publishDispatched(
      notification.id,
      now,
      deliveryResults,
      suppressedChannels,
      errors
    );

    return {
      notificationId: notification.id,
      dispatched,
      deliveryResults,
      suppressedChannels,
      errors,
    };
  }

  // ── schedule() / cancel() / listScheduled() ──────────────────────────────

  schedule(notification: Notification, sendAt: number): Notification {
    const scheduled: Notification = {
      ...notification,
      scheduledFor: sendAt,
      sentAt: undefined,
      status: "pending",
    };
    this.scheduled.set(scheduled.id, scheduled);
    return scheduled;
  }

  cancel(notificationId: string): boolean {
    return this.scheduled.delete(notificationId);
  }

  listScheduled(): readonly Notification[] {
    const entries = Array.from(this.scheduled.values());
    entries.sort((a, b) => {
      const aAt = a.scheduledFor ?? 0;
      const bAt = b.scheduledFor ?? 0;
      if (aAt !== bAt) return aAt - bAt;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return entries;
  }

  // ── internal: dispatch (in-memory simulation) ────────────────────────────

  /**
   * Simulate provider dispatch. Honours two channel config flags for testing:
   *   - `simulateFailure: true`  → status `failed`.
   *   - `simulateBounce:  true`  → status `bounced` (and auto-suppression).
   * Default behaviour: status `sent` (the in-memory engine is optimistic).
   */
  private dispatch(
    message: Message,
    channel: Channel,
    now: number
  ): DeliveryResult {
    const providerRef = this.providerRef(message.id);

    if (channel.config["simulateFailure"] === true) {
      return {
        messageId: message.id,
        channelId: channel.id,
        status: "failed",
        error: `simulated failure on channel '${channel.id}'`,
      };
    }
    if (channel.config["simulateBounce"] === true) {
      return {
        messageId: message.id,
        channelId: channel.id,
        status: "bounced",
        providerRef,
        error: `simulated bounce on channel '${channel.id}'`,
      };
    }

    return {
      messageId: message.id,
      channelId: channel.id,
      status: "sent",
      providerRef,
    };
  }

  // ── internal: deterministic id minting ───────────────────────────────────

  private messageId(
    notificationId: string,
    channelId: string,
    now: number,
    channelIndex: number
  ): string {
    const h = hashSeed(
      `msg|${notificationId}|${channelId}|${now}|${channelIndex}`
    ).toString(16);
    return `msg-${h.padStart(8, "0")}`;
  }

  private providerRef(messageId: string): string {
    const h = hashSeed(`prv|${messageId}`).toString(16);
    return `prv-${h.padStart(8, "0")}`;
  }

  private eventId(kind: CommunicationEventKind, now: number): string {
    this.eventCounter++;
    const h = hashSeed(`evt|${kind}|${now}|${this.eventCounter}`).toString(16);
    return `evt-${h.padStart(8, "0")}`;
  }

  // ── internal: event publishing ───────────────────────────────────────────

  private publishEvent(
    kind: CommunicationEventKind,
    now: number,
    payload: Record<string, unknown>
  ): void {
    const event: CommunicationEvent = {
      id: this.eventId(kind, now),
      kind,
      payload,
      timestamp: now,
    };
    this.events.publish(event);
  }

  private publishDispatched(
    notificationId: string,
    now: number,
    deliveryResults: readonly DeliveryResult[],
    suppressedChannels: readonly string[],
    errors: readonly string[]
  ): void {
    this.publishEvent("notification-dispatched", now, {
      notificationId,
      deliveryCount: deliveryResults.length,
      suppressedCount: suppressedChannels.length,
      errorCount: errors.length,
      deliveredCount: deliveryResults.filter(
        (r) => r.status === "delivered" || r.status === "sent"
      ).length,
      failedCount: deliveryResults.filter(
        (r) => r.status === "failed" || r.status === "bounced"
      ).length,
    });
  }

  // ── internal: resolve the sender address from the channel config ──────────

  private channelSender(channel: Channel): string {
    const cfg = channel.config;
    const from =
      cfg["from"] ??
      cfg["sender"] ??
      cfg["fromNumber"] ??
      cfg["topic"] ??
      cfg["url"] ??
      `no-reply@${channel.id}`;
    return typeof from === "string" ? from : String(from);
  }
}

// Re-export the domain types so callers importing the engine have them.
export type {
  Channel,
  ChannelRegistry,
  CommunicationEvent,
  CommunicationEventStream,
  DeliveryResult,
  Message,
  Notification,
  NotificationEngine,
  NotificationResult,
  Recipient,
  RecipientRegistry,
  SuppressionChecker,
  TemplateRegistry,
};
