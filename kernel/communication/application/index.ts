/**
 * @kernel/communication/application — application barrel.
 *
 * Use-cases that compose the domain ports into higher-level workflows. The
 * application layer depends ONLY on the domain layer (ports + types) and on
 * `@kernel/shared-kernel` for the `Result` type.
 */
export * from "./send-notification";
export * from "./schedule-notification";
export * from "./register-template";
