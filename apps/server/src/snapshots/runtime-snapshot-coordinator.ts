import type { RuntimeJsonValue } from "@solidloom/shared";
import type { RuntimeEventStore } from "../events/runtime-event-store.js";
import type { RuntimeSnapshotStore } from "./runtime-snapshot-store.js";
import type { RuntimeSnapshotCapture, RuntimeSnapshotEnvelope } from "./types.js";

export interface RuntimeSnapshotCoordinatorOptions {
  readonly eventInterval?: number;
}

export class RuntimeSnapshotCoordinator<Value extends RuntimeJsonValue> {
  readonly #eventStore: RuntimeEventStore;
  readonly #snapshotStore: RuntimeSnapshotStore;
  readonly #eventInterval: number;

  constructor(
    eventStore: RuntimeEventStore,
    snapshotStore: RuntimeSnapshotStore,
    options: RuntimeSnapshotCoordinatorOptions = {},
  ) {
    const eventInterval = options.eventInterval ?? 100;
    if (!Number.isSafeInteger(eventInterval) || eventInterval < 1) {
      throw new TypeError("快照事件间隔必须是正安全整数。");
    }
    this.#eventStore = eventStore;
    this.#snapshotStore = snapshotStore;
    this.#eventInterval = eventInterval;
  }

  captureIfDue(
    runId: string,
    capture: () => RuntimeSnapshotCapture<Value>,
  ): RuntimeSnapshotEnvelope<Value> | null {
    const position = this.#eventStore.verifyIntegrity(runId);
    const latest = this.#snapshotStore.candidates<Value>(runId)
      .find((candidate) => candidate.snapshot !== null)?.snapshot ?? null;
    if (position.lastSequence - (latest?.eventSequence ?? 0) < this.#eventInterval) return null;
    const captured = capture();
    return this.#snapshotStore.save({
      ...captured,
      runId,
      streamRevision: position.revision,
      eventSequence: position.lastSequence,
      expectedLatestStateRevision: this.#snapshotStore.latestStateRevision(runId),
    });
  }
}
