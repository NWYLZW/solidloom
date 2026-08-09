import type { DatabaseSync } from "node:sqlite";
import {
  RuntimeEventCorruptionError,
  RuntimeEventCursorError,
  RuntimeEventIdempotencyConflictError,
  RuntimeEventRevisionConflictError,
  RuntimeEventStoreError,
} from "./errors.js";
import { decodeRuntimeEventCursor, encodeRuntimeEventCursor } from "./event-cursor.js";
import { canonicalJson, runtimeChecksum } from "./integrity.js";
import { openRuntimePersistenceDatabase } from "./runtime-persistence-database.js";
import {
  RUNTIME_EVENT_SCHEMA_VERSION,
  type AppendRuntimeEventInput,
  type AppendRuntimeEventResult,
  type RuntimeEventEnvelope,
  type RuntimeEventPage,
  type RuntimeEventStreamPosition,
} from "./types.js";

interface EventRow {
  run_id: string;
  sequence: number;
  stream_revision: number;
  schema_version: number;
  event_id: string;
  idempotency_key: string;
  request_fingerprint: string;
  event_type: string;
  payload_json: string;
  simulation_time_ms: number;
  recorded_at: string;
  domain_package_id: string | null;
  domain_package_data_version: string | null;
  previous_checksum: string | null;
  checksum: string;
}

interface StreamRow {
  run_id: string;
  revision: number;
  last_sequence: number;
  last_checksum: string | null;
}

const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9-]*)+$/;

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new RuntimeEventStoreError("invalid-event", `${field} 不能为空。`);
}

function assertInput(input: AppendRuntimeEventInput): void {
  assertNonEmpty(input.id, "事件 ID");
  assertNonEmpty(input.idempotencyKey, "幂等键");
  assertNonEmpty(input.runId, "运行 ID");
  if (!EVENT_TYPE_PATTERN.test(input.type)) {
    throw new RuntimeEventStoreError("invalid-event", "事件类型必须是带命名空间的 ID。");
  }
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new RuntimeEventStoreError("invalid-event", "expectedRevision 必须是非负安全整数。");
  }
  if (!Number.isSafeInteger(input.simulationTimeMs) || input.simulationTimeMs < 0) {
    throw new RuntimeEventStoreError("invalid-event", "simulationTimeMs 必须是非负安全整数。");
  }
  if (Number.isNaN(Date.parse(input.recordedAt))) {
    throw new RuntimeEventStoreError("invalid-event", "recordedAt 必须是有效时间。");
  }
  if (input.domainPackage) {
    assertNonEmpty(input.domainPackage.id, "领域包 ID");
    assertNonEmpty(input.domainPackage.dataVersion, "领域包数据版本");
  }
  canonicalJson(input.payload);
}

function eventCore(event: Omit<RuntimeEventEnvelope, "checksum">) {
  return event;
}

function toEvent(row: EventRow): RuntimeEventEnvelope {
  return Object.freeze({
    schemaVersion: row.schema_version as typeof RUNTIME_EVENT_SCHEMA_VERSION,
    id: row.event_id,
    idempotencyKey: row.idempotency_key,
    runId: row.run_id,
    sequence: row.sequence,
    streamRevision: row.stream_revision,
    type: row.event_type,
    payload: Object.freeze(JSON.parse(row.payload_json)),
    simulationTimeMs: row.simulation_time_ms,
    recordedAt: row.recorded_at,
    domainPackage: row.domain_package_id && row.domain_package_data_version
      ? Object.freeze({ id: row.domain_package_id, dataVersion: row.domain_package_data_version })
      : null,
    previousChecksum: row.previous_checksum,
    checksum: row.checksum,
  });
}

function eventChecksum(event: RuntimeEventEnvelope): string {
  const { checksum: _checksum, ...core } = event;
  return runtimeChecksum(eventCore(core));
}

function fingerprint(input: AppendRuntimeEventInput): string {
  return runtimeChecksum({
    runId: input.runId,
    type: input.type,
    payload: input.payload,
    simulationTimeMs: input.simulationTimeMs,
    domainPackage: input.domainPackage ?? null,
  });
}

export class RuntimeEventStore {
  readonly #database: DatabaseSync;

  constructor(databasePath?: string) {
    this.#database = openRuntimePersistenceDatabase(databasePath);
  }

  close(): void {
    this.#database.close();
  }

  position(runId: string): RuntimeEventStreamPosition {
    const row = this.#database.prepare(`
      SELECT run_id, revision, last_sequence, last_checksum
      FROM runtime_event_streams WHERE run_id = ?
    `).get(runId) as StreamRow | undefined;
    return row
      ? Object.freeze({
        runId: row.run_id,
        revision: row.revision,
        lastSequence: row.last_sequence,
        lastChecksum: row.last_checksum,
      })
      : Object.freeze({ runId, revision: 0, lastSequence: 0, lastChecksum: null });
  }

  append(input: AppendRuntimeEventInput): AppendRuntimeEventResult {
    assertInput(input);
    const requestFingerprint = fingerprint(input);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.#database.prepare(`
        SELECT * FROM runtime_events WHERE run_id = ? AND idempotency_key = ?
      `).get(input.runId, input.idempotencyKey) as EventRow | undefined;
      if (existing) {
        if (existing.request_fingerprint !== requestFingerprint) {
          throw new RuntimeEventIdempotencyConflictError(input.idempotencyKey);
        }
        const event = toEvent(existing);
        this.#assertEventIntegrity(event);
        this.#database.exec("COMMIT");
        return Object.freeze({ event, replayed: true });
      }

      const current = this.position(input.runId);
      if (current.revision !== input.expectedRevision) {
        throw new RuntimeEventRevisionConflictError(input.expectedRevision, current.revision);
      }
      const sequence = current.lastSequence + 1;
      const streamRevision = current.revision + 1;
      const eventWithoutChecksum: Omit<RuntimeEventEnvelope, "checksum"> = {
        schemaVersion: RUNTIME_EVENT_SCHEMA_VERSION,
        id: input.id,
        idempotencyKey: input.idempotencyKey,
        runId: input.runId,
        sequence,
        streamRevision,
        type: input.type,
        payload: input.payload,
        simulationTimeMs: input.simulationTimeMs,
        recordedAt: input.recordedAt,
        domainPackage: input.domainPackage ?? null,
        previousChecksum: current.lastChecksum,
      };
      const event: RuntimeEventEnvelope = Object.freeze({
        ...eventWithoutChecksum,
        checksum: runtimeChecksum(eventWithoutChecksum),
      });

      this.#database.prepare(`
        INSERT INTO runtime_event_streams (run_id, revision, last_sequence, last_checksum, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(run_id) DO UPDATE SET
          revision = excluded.revision,
          last_sequence = excluded.last_sequence,
          last_checksum = excluded.last_checksum,
          updated_at = excluded.updated_at
      `).run(input.runId, streamRevision, sequence, event.checksum, input.recordedAt);
      this.#database.prepare(`
        INSERT INTO runtime_events (
          run_id, sequence, stream_revision, schema_version, event_id, idempotency_key,
          request_fingerprint, event_type, payload_json, simulation_time_ms, recorded_at,
          domain_package_id, domain_package_data_version, previous_checksum, checksum
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        input.runId,
        sequence,
        streamRevision,
        RUNTIME_EVENT_SCHEMA_VERSION,
        input.id,
        input.idempotencyKey,
        requestFingerprint,
        input.type,
        canonicalJson(input.payload),
        input.simulationTimeMs,
        input.recordedAt,
        input.domainPackage?.id ?? null,
        input.domainPackage?.dataVersion ?? null,
        current.lastChecksum,
        event.checksum,
      );
      this.#database.exec("COMMIT");
      return Object.freeze({ event, replayed: false });
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  readPage(
    runId: string,
    options: { readonly cursor?: string | null; readonly limit?: number } = {},
  ): RuntimeEventPage {
    const limit = options.limit ?? 100;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new RuntimeEventCursorError("事件分页大小必须位于 1 到 500 之间。");
    }
    this.verifyIntegrity(runId);
    const afterSequence = options.cursor ? decodeRuntimeEventCursor(options.cursor, runId) : 0;
    const position = this.position(runId);
    if (afterSequence > position.lastSequence) {
      throw new RuntimeEventCursorError("事件游标已经超过当前事件流末尾。");
    }
    const rows = this.#database.prepare(`
      SELECT * FROM runtime_events
      WHERE run_id = ? AND sequence > ?
      ORDER BY sequence ASC
      LIMIT ?
    `).all(runId, afterSequence, limit + 1) as unknown as EventRow[];
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toEvent);
    const last = items.at(-1);
    return Object.freeze({
      items: Object.freeze(items),
      nextCursor: hasMore && last ? encodeRuntimeEventCursor(runId, last.sequence) : null,
      streamRevision: position.revision,
    });
  }

  readAfter(runId: string, sequence: number): readonly RuntimeEventEnvelope[] {
    if (!Number.isSafeInteger(sequence) || sequence < 0) {
      throw new RuntimeEventCursorError("事件序号必须是非负安全整数。");
    }
    this.verifyIntegrity(runId);
    const rows = this.#database.prepare(`
      SELECT * FROM runtime_events WHERE run_id = ? AND sequence > ? ORDER BY sequence ASC
    `).all(runId, sequence) as unknown as EventRow[];
    return Object.freeze(rows.map(toEvent));
  }

  verifyIntegrity(runId: string): RuntimeEventStreamPosition {
    const position = this.position(runId);
    const rows = this.#database.prepare(`
      SELECT * FROM runtime_events WHERE run_id = ? ORDER BY sequence ASC
    `).all(runId) as unknown as EventRow[];
    let previousChecksum: string | null = null;
    rows.forEach((row, index) => {
      const event = toEvent(row);
      const expectedSequence = index + 1;
      if (event.sequence !== expectedSequence || event.streamRevision !== expectedSequence) {
        throw new RuntimeEventCorruptionError(`运行 ${runId} 的事件序号在 ${expectedSequence} 处不连续。`);
      }
      if (event.previousChecksum !== previousChecksum) {
        throw new RuntimeEventCorruptionError(`运行 ${runId} 的事件 ${event.id} 完整性链已经断裂。`);
      }
      this.#assertEventIntegrity(event);
      previousChecksum = event.checksum;
    });
    if (position.lastSequence !== rows.length || position.revision !== rows.length
      || position.lastChecksum !== previousChecksum) {
      throw new RuntimeEventCorruptionError(`运行 ${runId} 的事件流头信息与事件记录不一致。`);
    }
    return position;
  }

  #assertEventIntegrity(event: RuntimeEventEnvelope): void {
    if (event.schemaVersion !== RUNTIME_EVENT_SCHEMA_VERSION || eventChecksum(event) !== event.checksum) {
      throw new RuntimeEventCorruptionError(`事件 ${event.id} 的内容校验失败。`);
    }
  }
}
