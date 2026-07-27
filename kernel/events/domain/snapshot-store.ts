/**
 * @kernel/events/domain/snapshot-store — the SnapshotStore port.
 *
 * An OPTIMISATION only. Snapshots are never the source of truth: aggregate
 * state is always reconstructable by replaying events from `version + 1`.
 */

import type { AggregateId } from "@kernel/shared-kernel";
import type { Version } from "@kernel/shared-kernel";

export interface Snapshot<TState = unknown> {
  readonly aggregateId: AggregateId | string;
  readonly aggregateType: string;
  readonly version: Version;
  readonly state: TState;
  readonly takenAt: number;
}

export interface SnapshotStore {
  load<TState = unknown>(
    aggregateId: AggregateId | string
  ): Promise<Snapshot<TState> | null>;
  save<TState = unknown>(snapshot: Snapshot<TState>): Promise<void>;
}
