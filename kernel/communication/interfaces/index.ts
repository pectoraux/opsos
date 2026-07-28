/**
 * @kernel/communication — public surface.
 *
 * The OpsOS Communication Runtime.
 *
 * Owns: notifications, email, SMS, push, WhatsApp, voice, internal events,
 * webhooks, and external integrations. Protocols publish events; the platform
 * decides how they are delivered.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Domain types:   Channel, ChannelKind, ChannelStatus, ChannelConfig,
 *                      ChannelRegistry (PORT);
 *                      Recipient, RecipientChannel, RecipientRegistry (PORT);
 *                      Message, MessageStatus, MessagePriority;
 *                      DeliveryResult, DeliveryStatus;
 *                      Notification, NotificationKind, NotificationStatus,
 *                      NotificationResult, NotificationEngine (PORT);
 *                      CommunicationEvent, CommunicationEventKind,
 *                      CommunicationEventHandler,
 *                      CommunicationEventStream (PORT);
 *                      MessageTemplate, TemplateVariable, RenderedTemplate,
 *                      RenderOutcome, TemplateRegistry (PORT);
 *                      SuppressionEntry, SuppressionReason, SuppressionList,
 *                      SuppressionChecker (PORT).
 *   - Application:    SendNotification (+sendNotification fn),
 *                      ScheduleNotification (+scheduleNotification fn),
 *                      RegisterTemplate (+registerTemplate fn).
 *   - Infrastructure: InMemoryChannelRegistry, InMemoryRecipientRegistry,
 *                      InMemoryTemplateRegistry, InMemorySuppressionChecker,
 *                      InMemoryEventStream, InMemoryNotificationEngine,
 *                      createCommunicationRuntime() factory +
 *                      CommunicationRuntime bundle.
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere.
 *   - All time via the `now` argument (epoch-millis).
 *   - All ids via `hashSeed` (xfnv1a) from `@kernel/shared-kernel`.
 *   - The same Notification + now ALWAYS produces the same NotificationResult
 *     (byte-identical ids, delivery results, and event sequence).
 *   - The in-memory event stream's only try/catch wraps subscriber fan-out
 *     (so a misbehaving subscriber cannot break the dispatch loop); no other
 *     exceptions are thrown or caught.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
