/**
 * @kernel/integration-hub/application — barrel.
 *
 * The application layer of the Integration Hub. Use-cases that orchestrate
 * integration requests, webhook delivery, and periodic sync. Depends on
 * `domain/` and `@kernel/shared-kernel` only.
 *
 * Public surface:
 *   - ExecuteIntegration (+ ExecuteIntegrationUseCase, IntegrationDispatcher,
 *     ExecuteIntegrationInput, ExecuteIntegrationResult, ExecuteIntegrationDeps)
 *   - ProcessWebhook (+ ProcessWebhookUseCase, WebhookDeliverer,
 *     ProcessWebhookInput, ProcessWebhookResult, ProcessWebhookDeps)
 *   - RunSync (+ RunSyncUseCase, SyncExecutor, RunSyncInput, RunSyncResult,
 *     RunSyncDeps)
 */

export type {
  IntegrationDispatcher,
  ExecuteIntegrationInput,
  ExecuteIntegrationResult,
  ExecuteIntegration,
  ExecuteIntegrationDeps,
} from "./execute-integration";
export { ExecuteIntegrationUseCase } from "./execute-integration";

export type {
  WebhookDeliverer,
  ProcessWebhookInput,
  ProcessWebhookResult,
  ProcessWebhook,
  ProcessWebhookDeps,
} from "./process-webhook";
export { ProcessWebhookUseCase } from "./process-webhook";

export type {
  SyncExecutor,
  RunSyncInput,
  RunSyncResult,
  RunSync,
  RunSyncDeps,
} from "./run-sync";
export { RunSyncUseCase } from "./run-sync";
