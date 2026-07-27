/**
 * @kernel/shared-kernel/domain/primitives/twin — the Twin canonical primitive.
 *
 * A `Twin` is a digital twin: a MODELED representation of a real-world resource
 * (or system of resources) that the compiler and runtime reason against. Twins
 * carry the assumed/estimated state used for planning, simulation, and
 * what-if analysis. They are NOT the resource itself; they are the kernel's
 * best model of it.
 *
 * Twins are central to the simulation primitive: a `Simulation` runs an
 * `ExecutionPlan` against an assumed `Twin` state to project outcomes before
 * committing to execution. `fidelity` expresses how trustworthy the model is,
 * so decisions can be gated on twin freshness.
 *
 * Domain-independent. No industry-specific fields.
 */

import type {
  TwinId,
  ResourceId,
} from "../identifiers";
import type { UnknownState, Assumption } from "../value-objects";

export interface Twin {
  readonly id: TwinId;
  /** The resource this twin models, if any (a free-floating twin has none). */
  readonly resourceId?: ResourceId;
  /** The resource type this twin models, if any. */
  readonly resourceType?: string;
  /** The model type (e.g. "capacity", "location", "wear") — protocol vocabulary. */
  readonly modelType: string;
  /** The modeled state (generic key/value; protocol-defined shape). */
  readonly state: UnknownState;
  /** Epoch-millis from the RuntimeClock when the twin was last updated. */
  readonly updatedAt: number;
  /** Caller-supplied fidelity in [0, 1] — how accurate the twin is believed to be. */
  readonly fidelity: number;
  readonly assumptions: readonly Assumption[];
  /** Optional expiry; after this epoch-ms the twin SHOULD be considered stale. */
  readonly validUntil?: number;
}
