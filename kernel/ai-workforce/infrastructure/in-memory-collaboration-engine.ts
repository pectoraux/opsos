/**
 * @kernel/ai-workforce/infrastructure/in-memory-collaboration-engine — the
 * reference `CollaborationEngine` implementation.
 *
 * Holds handoffs in a `Map<string, AgentHandoff>` keyed by id, and messages
 * in an `AgentMessage[]` (insertion order). Mints deterministic ids from a
 * per-instance counter + the inputs.
 *
 * Semantics:
 *   - `initiateHandoff` — mint a handoff in the `initiated` state, store it,
 *     return it.
 *   - `acceptHandoff` — look up the handoff, transition `initiated → accepted`
 *     via `transitionHandoff` (throws `IllegalStateError` on illegal
 *     transition), update the stored copy, return it.
 *   - `sendMessage` — mint a message in the `sent` state, store it, return it.
 *   - `getConversation` — return all messages between `agentA` and `agentB`
 *     (either direction), in chronological order (timestamp ascending, then
 *     id ascending). Fresh array each call.
 *
 * Determinism: no `Date.now()` / `Math.random()`. All time via caller-supplied
 * `now`. Ids are deterministic per instance counter (`handoff-${counter}` and
 * `msg-${counter}`) so identical call sequences produce identical ids within
 * a session.
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (no durability, no delivery semantics — messages are
 * stored, not actually delivered to a transport).
 */
import { IllegalStateError } from "@kernel/shared-kernel";
import type {
  AgentHandoff,
  AgentMessage,
  AgentMessageKind,
  CollaborationEngine,
} from "../domain";
import { transitionHandoff } from "../domain";

/**
 * Reference in-memory `CollaborationEngine`. See file-level JSDoc.
 */
export class InMemoryCollaborationEngine implements CollaborationEngine {
  /** Handoffs keyed by id. */
  private readonly handoffs: Map<string, AgentHandoff> = new Map();
  /** All messages, in insertion order. */
  private readonly messages: AgentMessage[] = [];
  /** Per-instance counter for id minting. */
  private counter = 0;

  /** Mint a handoff in the `initiated` state. */
  initiateHandoff(
    fromAgentId: string,
    toAgentId: string,
    taskId: string,
    context: Readonly<Record<string, unknown>>,
    reason: string,
    now: number
  ): AgentHandoff {
    this.counter += 1;
    const id = `handoff-${this.counter}`;
    const handoff: AgentHandoff = {
      id,
      fromAgentId,
      toAgentId,
      taskId,
      context,
      reason,
      status: "initiated",
      timestamp: now,
    };
    this.handoffs.set(id, handoff);
    return handoff;
  }

  /**
   * Transition handoff `handoffId` from `initiated` to `accepted`. Returns
   * the updated handoff. Throws `IllegalStateError` if the handoff is not
   * found or is not in the `initiated` state.
   */
  acceptHandoff(handoffId: string, now: number): AgentHandoff {
    const current = this.handoffs.get(handoffId);
    if (current === undefined) {
      throw new IllegalStateError(
        `handoff '${handoffId}' not found`
      );
    }
    let next: AgentHandoff;
    try {
      next = transitionHandoff(current, "accepted", now);
    } catch (e) {
      if (e instanceof IllegalStateError) throw e;
      throw new IllegalStateError(
        `handoff '${handoffId}' failed to transition to 'accepted': ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
    this.handoffs.set(handoffId, next);
    return next;
  }

  /** Mint a message in the `sent` state. */
  sendMessage(
    fromAgentId: string,
    toAgentId: string,
    kind: AgentMessageKind,
    content: string,
    now: number
  ): AgentMessage {
    this.counter += 1;
    const id = `msg-${this.counter}`;
    const message: AgentMessage = {
      id,
      fromAgentId,
      toAgentId,
      kind,
      content,
      timestamp: now,
      status: "sent",
    };
    this.messages.push(message);
    return message;
  }

  /**
   * Return all messages between `agentA` and `agentB` (either direction), in
   * chronological order (timestamp ascending, then id ascending). Fresh array
   * each call.
   */
  getConversation(agentA: string, agentB: string): readonly AgentMessage[] {
    return this.messages
      .filter(
        (m) =>
          (m.fromAgentId === agentA && m.toAgentId === agentB) ||
          (m.fromAgentId === agentB && m.toAgentId === agentA)
      )
      .slice()
      .sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp;
        }
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
  }

  // ── Introspection helpers (NOT part of the CollaborationEngine port) ─────

  /** Get a handoff by id. For tests / diagnostics. */
  getHandoff(id: string): AgentHandoff | undefined {
    return this.handoffs.get(id);
  }

  /** All handoffs, in insertion order. For tests / diagnostics. */
  listHandoffs(): readonly AgentHandoff[] {
    return this.handoffs.size > 0 ? Array.from(this.handoffs.values()) : [];
  }

  /** All messages, in insertion order. For tests / diagnostics. */
  listMessages(): readonly AgentMessage[] {
    return this.messages.slice();
  }

  /** Remove all handoffs and messages. For tests / diagnostics. */
  clear(): void {
    this.handoffs.clear();
    this.messages.length = 0;
    this.counter = 0;
  }
}
