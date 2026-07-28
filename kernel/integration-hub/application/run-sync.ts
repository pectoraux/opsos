/**
 * @kernel/integration-hub/application/run-sync — use-case: run a single sync
 * job (import / export / bidirectional) between OpsOS and an external system.
 *
 * Pipeline:
 *   1. Resolve the sync job by id (must be `active`).
 *   2. Resolve the connector (must be `active`).
 *   3. Resolve the capability (must belong to the connector).
 *   4. Check the rate limiter — abort with a rate-limit error if denied.
 *   5. Delegate the actual data movement to the `SyncExecutor` port (the
 *      adapter seam — the kernel never touches real external systems).
 *   6. Stamp the scheduler with the outcome via `markSynced(jobId, result,
 *      now)` and return the result + updated job.
 *
 * Determinism: every timestamp flows from `input.now`; the latency is
 * computed as `end - now` from caller-supplied time, not `Date.now()`.
 */

import {
  NotFoundError,
  IllegalStateError,
  LimitExceededError,
  type Result,
  ok,
  err,
} from "@kernel/shared-kernel";

import type {
  Connector,
  ConnectorRegistry,
  IntegrationCapability,
  IntegrationCapabilityRegistry,
  RateLimiter,
  SyncJob,
  SyncResult,
  SyncScheduler,
} from "../domain";

/**
 * The executor seam — implemented by adapters in production. Pure function
 * of (connector, capability, job, now); returns a `SyncResult` with the
 * records processed and the success / failed status.
 */
export interface SyncExecutor {
  execute(
    connector: Connector,
    capability: IntegrationCapability,
    job: SyncJob,
    now: number
  ): SyncResult;
}

/** Input to `RunSync`. */
export interface RunSyncInput {
  readonly jobId: string;
  readonly now: number;
}

/** Result of `RunSync`. */
export interface RunSyncResult {
  readonly job: SyncJob;
  readonly result: SyncResult;
}

/** The use-case port. */
export interface RunSync {
  execute(input: RunSyncInput): Result<RunSyncResult>;
}

/** Dependencies injected into the default implementation. */
export interface RunSyncDeps {
  readonly scheduler: SyncScheduler;
  readonly connectors: ConnectorRegistry;
  readonly capabilities: IntegrationCapabilityRegistry;
  readonly rateLimiter: RateLimiter;
  readonly executor: SyncExecutor;
}

/** Default implementation. */
export class RunSyncUseCase implements RunSync {
  constructor(private readonly deps: RunSyncDeps) {}

  execute(input: RunSyncInput): Result<RunSyncResult> {
    const job = this.deps.scheduler.get(input.jobId);
    if (!job) {
      return err(new NotFoundError("SyncJob", input.jobId));
    }
    if (job.status !== "active") {
      return err(
        new IllegalStateError(
          `SyncJob '${job.id}' is ${job.status} (must be active)`
        )
      );
    }

    const connector = this.deps.connectors.get(job.connectorId);
    if (!connector) {
      return err(new NotFoundError("Connector", job.connectorId));
    }
    if (connector.status !== "active") {
      return err(
        new IllegalStateError(
          `Connector '${connector.id}' is ${connector.status} (must be active)`
        )
      );
    }

    const capability = this.deps.capabilities.get(job.capabilityId);
    if (!capability) {
      return err(new NotFoundError("IntegrationCapability", job.capabilityId));
    }
    if (capability.connectorId !== connector.id) {
      return err(
        new IllegalStateError(
          `Capability '${capability.id}' does not belong to connector '${connector.id}'`
        )
      );
    }

    // Rate-limit check.
    const rl = this.deps.rateLimiter.check(connector.id);
    if (!rl.allowed) {
      return err(
        new LimitExceededError(
          `Rate limit for connector '${connector.id}' exceeded; resets at ${rl.resetAt}`
        )
      );
    }

    // Execute the sync.
    const result = this.deps.executor.execute(connector, capability, job, input.now);

    // Consume capacity.
    this.deps.rateLimiter.record(connector.id, input.now);

    // Stamp the scheduler.
    const updated = this.deps.scheduler.markSynced(job.id, result, input.now);
    if (!updated) {
      // Job vanished between get and markSynced — treat as a not-found.
      return err(new NotFoundError("SyncJob", job.id));
    }

    return ok({ job: updated, result });
  }
}
