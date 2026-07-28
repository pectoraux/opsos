/**
 * @kernel/communication/infrastructure — infrastructure barrel.
 *
 * Re-exports the in-memory implementations of every domain PORT plus the
 * `createCommunicationRuntime()` factory. Callers who want a fully-wired
 * default runtime can use:
 *
 *   import { createCommunicationRuntime } from "@kernel/communication";
 *   const rt = createCommunicationRuntime();
 *   rt.channels.register({ id: "email-1", kind: "email", name: "Primary SMTP",
 *                           config: { from: "no-reply@example.com" },
 *                           status: "active" });
 *   const result = rt.engine.send(notification, Date.now());
 *
 * Callers who want to inject custom adapters (e.g. a real SMTP channel
 * adapter) can construct the parts directly:
 *
 *   import { InMemoryNotificationEngine } from "@kernel/communication";
 *   const engine = new InMemoryNotificationEngine({ channels, recipients,
 *                                                    templates, suppressions,
 *                                                    events });
 */
export * from "./in-memory-channel-registry";
export * from "./in-memory-recipient-registry";
export * from "./in-memory-template-registry";
export * from "./in-memory-suppression-checker";
export * from "./in-memory-event-stream";
export * from "./in-memory-notification-engine";

// ── createCommunicationRuntime() ────────────────────────────────────────────

import { InMemoryChannelRegistry } from "./in-memory-channel-registry";
import { InMemoryRecipientRegistry } from "./in-memory-recipient-registry";
import { InMemoryTemplateRegistry } from "./in-memory-template-registry";
import { InMemorySuppressionChecker } from "./in-memory-suppression-checker";
import { InMemoryEventStream } from "./in-memory-event-stream";
import { InMemoryNotificationEngine } from "./in-memory-notification-engine";

/**
 * The bundle of wired-up communication runtime components returned by
 * `createCommunicationRuntime()`.
 *
 * Each field is the in-memory implementation of the corresponding domain PORT.
 * Callers interact with the runtime primarily via `engine` (send/schedule/
 * cancel/listScheduled) and the registries (register channels, recipients,
 * templates). The event stream is exposed for subscribers (projections,
 * audit logs, integration webhooks).
 */
export interface CommunicationRuntime {
  readonly channels: InMemoryChannelRegistry;
  readonly recipients: InMemoryRecipientRegistry;
  readonly templates: InMemoryTemplateRegistry;
  readonly suppressions: InMemorySuppressionChecker;
  readonly events: InMemoryEventStream;
  readonly engine: InMemoryNotificationEngine;
}

export interface CreateCommunicationRuntimeOptions {
  /**
   * Maximum events retained by the in-memory event stream for `recent()`.
   * Default 1024.
   */
  readonly eventStreamCapacity?: number;
}

/**
 * Build a fully-wired default communication runtime. All components are fresh
 * in-memory implementations; nothing is shared across calls.
 *
 * Determinism: the runtime contains NO `Date.now()` / `Math.random()`. All
 * time flows through the `engine.send(notification, now)` argument. Two
 * runtimes constructed with the same options are interchangeable for
 * deterministic replay.
 */
export function createCommunicationRuntime(
  opts: CreateCommunicationRuntimeOptions = {}
): CommunicationRuntime {
  const channels = new InMemoryChannelRegistry();
  const recipients = new InMemoryRecipientRegistry();
  const templates = new InMemoryTemplateRegistry();
  const suppressions = new InMemorySuppressionChecker();
  const events = new InMemoryEventStream({
    capacity: opts.eventStreamCapacity ?? 1024,
  });
  const engine = new InMemoryNotificationEngine({
    channels,
    recipients,
    templates,
    suppressions,
    events,
  });
  return { channels, recipients, templates, suppressions, events, engine };
}
