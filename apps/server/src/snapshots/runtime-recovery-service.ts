import type {
  DomainPackageManifest,
  RuntimeJsonObject,
  RuntimeJsonValue,
} from "@solidloom/shared";
import { encodeRuntimeEventCursor } from "../events/event-cursor.js";
import { cloneRuntimeJson } from "../events/integrity.js";
import type { RuntimeEventEnvelope } from "../events/types.js";
import type { RuntimeEventStore } from "../events/runtime-event-store.js";
import type { RuntimeArchiveMigrator } from "../migrations/runtime-archive-migrator.js";
import type { RuntimeDomainPackageVersions } from "../migrations/types.js";
import { RuntimeRecoveryError } from "./errors.js";
import type { RuntimeSnapshotStore } from "./runtime-snapshot-store.js";
import type { RuntimeRecoveryResult, RuntimeRecoveryWarning } from "./types.js";

export type RuntimeEventReducer<Value extends RuntimeJsonValue> = (
  state: Value,
  event: RuntimeEventEnvelope,
) => Value;

export interface RuntimeRecoveryServiceOptions<Value extends RuntimeJsonValue> {
  readonly eventStore: RuntimeEventStore;
  readonly snapshotStore: RuntimeSnapshotStore;
  readonly migrator: RuntimeArchiveMigrator;
  readonly manifests: readonly DomainPackageManifest[];
  readonly initialState: Value;
  readonly reducer: RuntimeEventReducer<Value>;
}

export class RuntimeRecoveryService<Value extends RuntimeJsonValue> {
  readonly #eventStore: RuntimeEventStore;
  readonly #snapshotStore: RuntimeSnapshotStore;
  readonly #migrator: RuntimeArchiveMigrator;
  readonly #manifests: readonly DomainPackageManifest[];
  readonly #initialState: Value;
  readonly #reducer: RuntimeEventReducer<Value>;

  constructor(options: RuntimeRecoveryServiceOptions<Value>) {
    this.#eventStore = options.eventStore;
    this.#snapshotStore = options.snapshotStore;
    this.#migrator = options.migrator;
    this.#manifests = options.manifests;
    this.#initialState = cloneRuntimeJson(options.initialState);
    this.#reducer = options.reducer;
  }

  recover(runId: string): RuntimeRecoveryResult<Value> {
    const position = this.#eventStore.verifyIntegrity(runId);
    const warnings: RuntimeRecoveryWarning[] = [];
    let state = cloneRuntimeJson(this.#initialState);
    let packageVersions: RuntimeDomainPackageVersions = Object.freeze(Object.fromEntries(
      this.#manifests.map((manifest) => [manifest.id, manifest.dataVersion]),
    ));
    let eventSequence = 0;
    let sourceSnapshotId: string | null = null;

    for (const candidate of this.#snapshotStore.candidates<Value>(runId)) {
      if (!candidate.snapshot) {
        warnings.push(Object.freeze({
          code: "snapshot-corrupted",
          message: candidate.error?.message ?? `快照 ${candidate.id} 无法读取。`,
          snapshotId: candidate.id,
        }));
        continue;
      }
      if (candidate.snapshot.streamRevision > position.revision
        || candidate.snapshot.eventSequence > position.lastSequence) {
        warnings.push(Object.freeze({
          code: "snapshot-ahead-of-event-stream",
          message: `快照 ${candidate.id} 超过当前事件流末尾，已回退到更早快照。`,
          snapshotId: candidate.id,
        }));
        continue;
      }
      const migrated = this.#migrator.migrateArchive(
        runId,
        { value: candidate.snapshot.state, packageVersions: candidate.snapshot.packageVersions },
        this.#manifests,
      );
      state = migrated.value;
      packageVersions = migrated.packageVersions;
      eventSequence = candidate.snapshot.eventSequence;
      sourceSnapshotId = candidate.id;
      break;
    }

    const events = this.#eventStore.readAfter(runId, eventSequence);
    for (const event of events) {
      const payload = this.#migrator.migrateEventPayload(event, this.#manifests);
      const migratedEvent: RuntimeEventEnvelope = Object.freeze({
        ...event,
        payload: payload as RuntimeJsonObject,
      });
      try {
        state = cloneRuntimeJson(this.#reducer(cloneRuntimeJson(state), migratedEvent));
      } catch (error) {
        throw new RuntimeRecoveryError(
          `回放事件 ${event.id} 失败，运行实例 ${runId} 未恢复。`,
          error,
        );
      }
    }
    return Object.freeze({
      state,
      packageVersions,
      streamRevision: position.revision,
      lastEventSequence: position.lastSequence,
      sourceSnapshotId,
      replayedEventCount: events.length,
      nextEventCursor: encodeRuntimeEventCursor(runId, position.lastSequence),
      warnings: Object.freeze(warnings),
    });
  }
}
