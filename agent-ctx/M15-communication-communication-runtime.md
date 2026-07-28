# Work Record — M15-communication

**Task ID:** M15-communication
**Agent:** communication-runtime
**Scope:** Build the Communication Runtime (Channel, Message, Notification, Template, Recipient, Suppression, EventStream + in-memory implementations) under `kernel/communication/`.

## Prior context read
- `worklog.md` (M1–M14, FROZEN) — confirmed layering/determinism conventions and the conformance/governance-module patterns as the closest structural analogues.
- `kernel/shared-kernel/interfaces/index.ts` + `domain/index.ts` — Result, KernelError, branded IDs, value objects (`UnknownRecord` / `UnknownPayload`), `RuntimeClock` / `RandomSource` ports, `hashSeed` (xfnv1a) / `mulberry32`, `FixedClock`, canonical primitives.
- `kernel/shared-kernel/domain/versioning.ts` — `Version`, `ClockTime`, `LogicalTick`.
- `kernel/shared-kernel/domain/result.ts` + `errors.ts` — `Result<T,E>`, `ok`/`err`/`isOk`/`isErr`/`mapResult`/`flatMapResult`, kernel error hierarchy.
- `kernel/conformance/` (M11 module) — the closest structural analogue for in-memory engine + `createXEngine()` factory pattern + `interfaces/` public-surface barrel.
- `kernel/governance/` (M13 module) — confirmed the `createXFramework()` factory + `Result<T, string>` use-case convention.
- tsconfig — confirmed `@kernel/*` path alias resolves `@kernel/communication` → `./kernel/communication/*`. Baseline `bunx tsc --noEmit` exit 0.

## Decisions (key)
- Communication module depends ONLY on `@kernel/shared-kernel` (for `UnknownRecord` / `UnknownPayload` value-object types + `hashSeed` + `Result`). NO imports from any other kernel module — per the spec's IMPORT CONVENTION.
- `Recipient` interface is `{ id, name, channels }` — a structural superset of the EXACT CONTRACT's minimal `{ id, name }` form, so it satisfies both the EXACT CONTRACT (structurally) AND the directory spec's "id, name, channels" description. `Message.to[]` carries the full recipient record; the dispatch loop reads `channels` when resolving per-channel delivery addresses.
- `TemplateRegistry.render()` returns `RenderOutcome { ok, rendered?, error? }` rather than `RenderedTemplate | undefined` so missing-required-variable errors surface as DATA, not exceptions. This is a deliberate departure from the spec's docstring shorthand `render(...) → { subject?, body }`; the engine relies on the discriminated form to populate `NotificationResult.errors` without try/catch.
- `NotificationEngine.send()` dispatches to ALL listed channels in parallel (in notification.channels order — callers control order). It does NOT do sequential fallback. Sequential escalation (email → SMS if undelivered in 5 min) is a HIGHER-level use-case built on multiple Notifications + the scheduler. Documented as ADR communication-0001 in `domain/notification.ts`.
- Disabled/error channels produce an `error` entry, NOT a `suppressedChannels` entry. Suppression is recipient-driven (opt-out / bounce / complaint / manual); channel status is operator-driven. Conflating them would muddy the audit trail.
- Bounce → auto-suppression: when a DeliveryResult has `status: "bounced"`, the engine calls `SuppressionChecker.suppress(recipientId, channelKind, "bounce", now)` and publishes a `bounce-detected` event. Subsequent sends to that (recipient, channelKind) pair are suppressed.
- `send()` auto-removes the notification from the scheduled set if present (it has been dispatched; it should no longer appear in `listScheduled()`). `cancel()` removes from scheduled without dispatching.
- `listScheduled()` returns entries sorted by (scheduledFor ASC, id ASC) for deterministic ordering when timestamps collide.
- In-memory dispatch is optimistic by default (status `sent`). Channel config may request simulated failure/bounce via `simulateFailure: true` / `simulateBounce: true` — a test affordance that makes the engine testable without mocking providers.
- Deterministic id minting via `hashSeed` (xfnv1a) from `@kernel/shared-kernel`:
  - messageId = `msg-${hashSeed(`msg|${notifId}|${channelId}|${now}|${idx}`)}`
  - providerRef = `prv-${hashSeed(messageId)}`
  - eventId = `evt-${hashSeed(`evt|${kind}|${now}|${counter}`)}` with a per-engine monotonic counter for uniqueness within a single dispatch
- The in-memory event stream's ONLY try/catch wraps subscriber fan-out so a misbehaving subscriber cannot break the dispatch loop. No other exceptions are thrown or caught anywhere in the module (failures are values).
- Suppression expiry is lazy: `isSuppressed(recipientId, channelKind, now)` returns false if `now >= expiresAt`, but the entry is NOT auto-deleted (audit trail preserved).
- Template rendering grammar: `{{name}}` substitution, whitespace-tolerant (`{{ name }}` === `{{name}}`), unknown vars → empty string, required-missing → render error. Escaped braces NOT supported (intentionally minimal grammar).
- `createCommunicationRuntime()` factory returns a `CommunicationRuntime` bundle `{ channels, recipients, templates, suppressions, events, engine }`, all fresh in-memory implementations wired together. Optional `eventStreamCapacity` knob (default 1024).

## Files created (20 total) under /home/z/my-project/kernel/communication/
- domain/ (9): channel.ts, recipient.ts, message.ts, delivery-result.ts, notification.ts, communication-event.ts, template.ts, suppression.ts, index.ts
- application/ (4): send-notification.ts, schedule-notification.ts, register-template.ts, index.ts
- infrastructure/ (7): in-memory-channel-registry.ts, in-memory-recipient-registry.ts, in-memory-template-registry.ts, in-memory-suppression-checker.ts, in-memory-event-stream.ts, in-memory-notification-engine.ts, index.ts
- interfaces/index.ts
- index.ts (root)

## Public surface from `@kernel/communication`
- Domain types: ChannelKind, ChannelStatus, ChannelConfig, Channel, ChannelRegistry (PORT); RecipientChannel, Recipient, RecipientRegistry (PORT); MessageStatus, MessagePriority, Message; DeliveryStatus, DeliveryResult; NotificationKind, NotificationStatus, Notification, NotificationResult, NotificationEngine (PORT); CommunicationEventKind, CommunicationEvent, CommunicationEventHandler, CommunicationEventStream (PORT); TemplateVariable, MessageTemplate, RenderedTemplate, RenderOutcome, TemplateRegistry (PORT); SuppressionReason, SuppressionEntry, SuppressionList, SuppressionChecker (PORT).
- Application: SendNotification (+SendNotificationInput/Deps +SendNotification class +sendNotification fn), ScheduleNotification (+ScheduleNotificationInput/Deps/Outcome +ScheduleNotification class +scheduleNotification fn), RegisterTemplate (+RegisterTemplateInput/Deps/Outcome +RegisterTemplate class +registerTemplate fn).
- Infrastructure: InMemoryChannelRegistry, InMemoryRecipientRegistry, InMemoryTemplateRegistry, InMemorySuppressionChecker, InMemoryEventStream (+InMemoryEventStreamOptions +size()), InMemoryNotificationEngine (+InMemoryNotificationEngineOptions), createCommunicationRuntime (+CreateCommunicationRuntimeOptions +CommunicationRuntime bundle).

## Verification
- `bunx tsc --noEmit 2>&1 | grep communication` → empty.
- `bunx tsc --noEmit 2>&1 | grep -v "skills/" | head` → empty. Full tsc exit 0.
- `rg "Date\.now\(\)|Math\.random\(\)" kernel/communication/` → only JSDoc/comment text (no code uses them).
- All 20 files start with a JSDoc comment.
- All imports are either `from "@kernel/shared-kernel"` or relative (`../`, `./`). No imports from other kernel modules.
- Inline sanity run (one-off `bun -e`, no file written): registered email channel + recipient + welcome template; sent a transactional notification → dispatched=true, status=sent, messageId=msg-403b47fe, providerRef=prv-4d0af474, events [message-queued, message-sent, notification-dispatched]. Ran the SAME notification through a FRESH runtime instance → byte-identical messageId + providerRef (determinism confirmed). Suppressed recipient+email → dispatched=false, channel in suppressedChannels. Scheduled → status=pending, scheduledFor set, listScheduled()=1, cancel()=true, listScheduled()=0. Bounce sim → status=bounced, auto-suppression triggered (isSuppressed true afterwards). Missing required template var → graceful error "template render failed: missing required template variables: name". Unknown recipient/channel and unverified recipient channel → graceful errors, no throws.
