import type { DatabaseSync } from "node:sqlite";
import type { RuntimeJsonValue } from "@solidloom/shared";
import { canonicalJson, runtimeChecksum } from "../events/integrity.js";
import { openRuntimePersistenceDatabase } from "../events/runtime-persistence-database.js";
import {
  RuntimeSnapshotCorruptionError,
  RuntimeSnapshotError,
  RuntimeSnapshotRevisionConflictError,
  RuntimeSnapshotStreamConflictError,
} from "./errors.js";
import {
  RUNTIME_SNAPSHOT_SCHEMA_VERSION,
  type RuntimeSnapshotCandidate,
  type RuntimeSnapshotEnvelope,
  type SaveRuntimeSnapshotInput,
} from "./types.js";

interface SnapshotRow {
  snapshot_id: string;
  run_id: string;
  schema_version: number;
  state_revision: number;
  stream_revision: number;
  event_sequence: number;
  captured_at: string;
  package_versions_json: string;
  state_json: string;
  checksum: string;
}

interface StreamRow {
  revision: number;
  last_sequence: number;
}

function assertSafeRevision(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RuntimeSnapshotError("invalid-snapshot", `${field} 必须是非负安全整数。`);
  }
}

function assertInput(input: SaveRuntimeSnapshotInput): void {
  if (!input.id.trim() || !input.runId.trim()) {
    throw new RuntimeSnapshotError("invalid-snapshot", "快照 ID 和运行 ID 不能为空。");
  }
  assertSafeRevision(input.stateRevision, "stateRevision");
  assertSafeRevision(input.streamRevision, "streamRevision");
  assertSafeRevision(input.eventSequence, "eventSequence");
  if (input.expectedLatestStateRevision !== null) {
    assertSafeRevision(input.expectedLatestStateRevision, "expectedLatestStateRevision");
  }
  if (Number.isNaN(Date.parse(input.capturedAt))) {
    throw new RuntimeSnapshotError("invalid-snapshot", "capturedAt 必须是有效时间。");
  }
  for (const [packageId, version] of Object.entries(input.packageVersions)) {
    if (!packageId.trim() || !version.trim()) {
      throw new RuntimeSnapshotError("invalid-snapshot", "领域包 ID 和数据版本不能为空。");
    }
  }
  canonicalJson(input.state);
  canonicalJson(input.packageVersions);
}

function snapshotCore<Value extends RuntimeJsonValue>(
  input: Omit<RuntimeSnapshotEnvelope<Value>, "checksum">,
) {
  return input;
}

function toSnapshot<Value extends RuntimeJsonValue>(row: SnapshotRow): RuntimeSnapshotEnvelope<Value> {
  let state: Value;
  let packageVersions: Record<string, string>;
  try {
    state = JSON.parse(row.state_json) as Value;
    packageVersions = JSON.parse(row.package_versions_json) as Record<string, string>;
  } catch (error) {
    throw new RuntimeSnapshotCorruptionError(
      `快照 ${row.snapshot_id} 的 JSON 无法读取：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const core: Omit<RuntimeSnapshotEnvelope<Value>, "checksum"> = {
    schemaVersion: row.schema_version as typeof RUNTIME_SNAPSHOT_SCHEMA_VERSION,
    id: row.snapshot_id,
    runId: row.run_id,
    stateRevision: row.state_revision,
    streamRevision: row.stream_revision,
    eventSequence: row.event_sequence,
    capturedAt: row.captured_at,
    packageVersions: Object.freeze(packageVersions),
    state,
  };
  if (core.schemaVersion !== RUNTIME_SNAPSHOT_SCHEMA_VERSION
    || runtimeChecksum(snapshotCore(core)) !== row.checksum) {
    throw new RuntimeSnapshotCorruptionError(`快照 ${row.snapshot_id} 的内容校验失败。`);
  }
  return Object.freeze({ ...core, checksum: row.checksum });
}

export class RuntimeSnapshotStore {
  readonly #database: DatabaseSync;

  constructor(databasePath?: string) {
    this.#database = openRuntimePersistenceDatabase(databasePath);
  }

  close(): void {
    this.#database.close();
  }

  latestStateRevision(runId: string): number | null {
    const row = this.#database.prepare(`
      SELECT state_revision FROM runtime_snapshots
      WHERE run_id = ? ORDER BY state_revision DESC LIMIT 1
    `).get(runId) as { state_revision: number } | undefined;
    return row?.state_revision ?? null;
  }

  save<Value extends RuntimeJsonValue>(
    input: SaveRuntimeSnapshotInput<Value>,
  ): RuntimeSnapshotEnvelope<Value> {
    assertInput(input);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const latestRevision = this.latestStateRevision(input.runId);
      if (latestRevision !== input.expectedLatestStateRevision) {
        throw new RuntimeSnapshotRevisionConflictError(
          input.expectedLatestStateRevision,
          latestRevision,
        );
      }
      if (latestRevision !== null && input.stateRevision <= latestRevision) {
        throw new RuntimeSnapshotRevisionConflictError(latestRevision + 1, input.stateRevision);
      }
      const stream = this.#database.prepare(`
        SELECT revision, last_sequence FROM runtime_event_streams WHERE run_id = ?
      `).get(input.runId) as StreamRow | undefined;
      const currentStreamRevision = stream?.revision ?? 0;
      const currentEventSequence = stream?.last_sequence ?? 0;
      if (input.streamRevision !== currentStreamRevision
        || input.eventSequence !== currentEventSequence) {
        throw new RuntimeSnapshotStreamConflictError(
          `快照基于事件流 ${input.streamRevision}/${input.eventSequence}，当前事件流为 ${currentStreamRevision}/${currentEventSequence}。`,
        );
      }
      const core: Omit<RuntimeSnapshotEnvelope<Value>, "checksum"> = {
        schemaVersion: RUNTIME_SNAPSHOT_SCHEMA_VERSION,
        id: input.id,
        runId: input.runId,
        stateRevision: input.stateRevision,
        streamRevision: input.streamRevision,
        eventSequence: input.eventSequence,
        capturedAt: input.capturedAt,
        packageVersions: Object.freeze({ ...input.packageVersions }),
        state: input.state,
      };
      const snapshot: RuntimeSnapshotEnvelope<Value> = Object.freeze({
        ...core,
        checksum: runtimeChecksum(snapshotCore(core)),
      });
      this.#database.prepare(`
        INSERT INTO runtime_snapshots (
          snapshot_id, run_id, schema_version, state_revision, stream_revision,
          event_sequence, captured_at, package_versions_json, state_json, checksum
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        snapshot.id,
        snapshot.runId,
        snapshot.schemaVersion,
        snapshot.stateRevision,
        snapshot.streamRevision,
        snapshot.eventSequence,
        snapshot.capturedAt,
        canonicalJson(snapshot.packageVersions),
        canonicalJson(snapshot.state),
        snapshot.checksum,
      );
      this.#database.exec("COMMIT");
      return snapshot;
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  candidates<Value extends RuntimeJsonValue>(runId: string): readonly RuntimeSnapshotCandidate<Value>[] {
    const rows = this.#database.prepare(`
      SELECT * FROM runtime_snapshots WHERE run_id = ?
      ORDER BY state_revision DESC, captured_at DESC
    `).all(runId) as unknown as SnapshotRow[];
    return Object.freeze(rows.map((row) => {
      try {
        return Object.freeze({
          id: row.snapshot_id,
          stateRevision: row.state_revision,
          streamRevision: row.stream_revision,
          eventSequence: row.event_sequence,
          capturedAt: row.captured_at,
          snapshot: toSnapshot<Value>(row),
          error: null,
        });
      } catch (error) {
        return Object.freeze({
          id: row.snapshot_id,
          stateRevision: row.state_revision,
          streamRevision: row.stream_revision,
          eventSequence: row.event_sequence,
          capturedAt: row.captured_at,
          snapshot: null,
          error: error instanceof Error ? error : new RuntimeSnapshotCorruptionError(String(error)),
        });
      }
    }));
  }
}
