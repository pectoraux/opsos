/**
 * @kernel/coordination/infrastructure — barrel.
 *
 * The infrastructure layer of the Coordination Kernel. Concrete in-memory
 * implementations of every engine port. Pure data structures; no `Date.now()`,
 * no `Math.random()`. Suitable for tests, deterministic replay, and as
 * reference implementations for protocol authors.
 *
 * Public surface:
 *   - InMemoryMatchingEngine
 *   - InMemoryNegotiationEngine
 *   - InMemoryReservationEngine
 *   - InMemoryCommitmentEngine
 *   - InMemoryAssignmentEngine
 *   - InMemoryQueueEngine
 *   - InMemoryTransferEngine
 *   - InMemoryEscalationEngine
 *   - InMemoryCoordinationEngines (bundle interface)
 *   - createInMemoryCoordinationEngines() (bundle helper)
 */

import { InMemoryMatchingEngine } from "./in-memory-matching-engine";
import { InMemoryNegotiationEngine } from "./in-memory-negotiation-engine";
import { InMemoryReservationEngine } from "./in-memory-reservation-engine";
import { InMemoryCommitmentEngine } from "./in-memory-commitment-engine";
import { InMemoryAssignmentEngine } from "./in-memory-assignment-engine";
import { InMemoryQueueEngine } from "./in-memory-queue-engine";
import { InMemoryTransferEngine } from "./in-memory-transfer-engine";
import { InMemoryEscalationEngine } from "./in-memory-escalation-engine";

export {
  InMemoryMatchingEngine,
  InMemoryNegotiationEngine,
  InMemoryReservationEngine,
  InMemoryCommitmentEngine,
  InMemoryAssignmentEngine,
  InMemoryQueueEngine,
  InMemoryTransferEngine,
  InMemoryEscalationEngine,
};

/**
 * A convenience bundle of every in-memory engine. Construct one per
 * coordination session and pass the engines individually (or as a bundle) to
 * use-cases like `CoordinateWorkUseCase`.
 */
export interface InMemoryCoordinationEngines {
  readonly matching: InMemoryMatchingEngine;
  readonly negotiation: InMemoryNegotiationEngine;
  readonly reservation: InMemoryReservationEngine;
  readonly commitment: InMemoryCommitmentEngine;
  readonly assignment: InMemoryAssignmentEngine;
  readonly queue: InMemoryQueueEngine;
  readonly transfer: InMemoryTransferEngine;
  readonly escalation: InMemoryEscalationEngine;
}

/**
 * Construct a fresh bundle of in-memory engines. Each engine has its own
 * per-instance counter, so ids minted within a session are unique.
 */
export function createInMemoryCoordinationEngines(): InMemoryCoordinationEngines {
  return {
    matching: new InMemoryMatchingEngine(),
    negotiation: new InMemoryNegotiationEngine(),
    reservation: new InMemoryReservationEngine(),
    commitment: new InMemoryCommitmentEngine(),
    assignment: new InMemoryAssignmentEngine(),
    queue: new InMemoryQueueEngine(),
    transfer: new InMemoryTransferEngine(),
    escalation: new InMemoryEscalationEngine(),
  };
}
