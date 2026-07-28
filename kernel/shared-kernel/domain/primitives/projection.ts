/**
 * @kernel/shared-kernel/domain/primitives/projection — the canonical Projection.
 *
 * Realised by `@kernel/projections` as `ProjectionDefinition<TState>` plus a
 * `ProjectionEngine`. Projections are PURE functions of events:
 * `(event, state) → state`. Read models are never mutated by query code.
 */

import type { ProjectionId } from "../identifiers";
import type {
  TransformSpec,
  UnknownState,
} from "../value-objects";

export interface Projection {
  readonly id: ProjectionId;
  readonly name: string;
  readonly sourceEventTypes: readonly string[];
  readonly initialState: UnknownState;
  readonly transform: TransformSpec;
  readonly targetSchema: { readonly ref: string; readonly version: number };
}
