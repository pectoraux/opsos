/**
 * @kernel/communication/domain — domain barrel.
 *
 * Re-exports every domain type so a single
 * `import { Channel, Notification, NotificationEngine, ... } from "@kernel/communication/domain"`
 * resolves the full domain surface.
 *
 * Layering: this module depends ONLY on `@kernel/shared-kernel` (for the
 * `UnknownRecord` / `UnknownPayload` value-object types). No imports from any
 * other kernel module.
 */
export * from "./channel";
export * from "./recipient";
export * from "./message";
export * from "./delivery-result";
export * from "./notification";
export * from "./communication-event";
export * from "./template";
export * from "./suppression";
