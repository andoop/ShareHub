import { EventEmitter } from "node:events";
import type { MailboxMessage, RuntimeBroadcast } from "./types.js";

const MAX_HISTORY = 2000;

/**
 * In-process event hub.
 *
 * Two channels are exposed:
 * - The legacy mailbox channel (`publish` / `onMessage` / `list`) used by the
 *   worker/MCP plumbing and the legacy `/events` stream.
 * - The structured broadcast channel (`broadcast` / `onBroadcast`) used by the
 *   mobile `/stream` endpoint, carrying typed `session` and `message` envelopes.
 */
export class RuntimeEvents {
  private readonly emitter = new EventEmitter();
  private readonly history: MailboxMessage[] = [];

  constructor() {
    // Many SSE clients may subscribe at once; lift the default listener cap.
    this.emitter.setMaxListeners(0);
  }

  async publish(message: MailboxMessage): Promise<void> {
    this.history.push(message);
    if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY);
    this.emitter.emit("message", message);
  }

  list(feature?: string): MailboxMessage[] {
    return feature ? this.history.filter((message) => message.feature === feature) : [...this.history];
  }

  onMessage(listener: (message: MailboxMessage) => void): () => void {
    this.emitter.on("message", listener);
    return () => this.emitter.off("message", listener);
  }

  broadcast(envelope: RuntimeBroadcast): void {
    this.emitter.emit("broadcast", envelope);
  }

  onBroadcast(listener: (envelope: RuntimeBroadcast) => void): () => void {
    this.emitter.on("broadcast", listener);
    return () => this.emitter.off("broadcast", listener);
  }
}
