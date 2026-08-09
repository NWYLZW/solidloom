import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DomainPackageManifest, RuntimeJsonObject } from "@solidloom/shared";
import {
  RuntimeEventCorruptionError,
  RuntimeEventIdempotencyConflictError,
  RuntimeEventRevisionConflictError,
  RuntimeEventStore,
} from "../apps/server/src/events/index.js";
import {
  RuntimeArchiveMigrator,
  RuntimeMigrationHandlerMissingError,
  RuntimeMigrationRegistry,
} from "../apps/server/src/migrations/index.js";
import {
  RuntimeRecoveryService,
  RuntimeSnapshotCoordinator,
  RuntimeSnapshotRevisionConflictError,
  RuntimeSnapshotStore,
} from "../apps/server/src/snapshots/index.js";
import { afterEach, describe, expect, it } from "vitest";

type CounterState = { readonly value: number };

const temporaryDirectories: string[] = [];

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "solidloom-runtime-recovery-"));
  temporaryDirectories.push(directory);
  return join(directory, "runtime.db");
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

function appendDelta(
  store: RuntimeEventStore,
  runId: string,
  id: string,
  expectedRevision: number,
  delta: number,
  domainPackage?: { readonly id: string; readonly dataVersion: string },
) {
  return store.append({
    id,
    idempotencyKey: `idempotency-${id}`,
    runId,
    expectedRevision,
    type: "sample.counter-changed",
    payload: { delta },
    simulationTimeMs: expectedRevision * 100,
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, expectedRevision)).toISOString(),
    ...(domainPackage ? { domainPackage } : {}),
  });
}

function counterReducer(state: CounterState, event: { readonly payload: RuntimeJsonObject }): CounterState {
  const delta = event.payload.delta;
  if (typeof delta !== "number") throw new TypeError("delta 必须是数字");
  return { value: state.value + delta };
}

function manifest(
  dataVersion = "2.0.0",
  migrationStatus: "available" | "planned" = "available",
): DomainPackageManifest {
  return {
    schemaVersion: 1,
    id: "sample",
    namespace: "sample",
    displayName: "恢复测试领域包",
    description: "用于验证本地存档迁移。",
    version: "1.0.0",
    dataVersion,
    status: "available",
    platformVersion: "^0.1.0",
    dependencies: [],
    extends: [],
    definitions: {
      entityTypes: [],
      componentTypes: [],
      relationTypes: [],
      resourceTypes: [],
      metricTypes: [],
      actionTypes: [],
      processTypes: [],
      ruleSets: [],
      viewDefinitions: [],
    },
    migrations: dataVersion === "1.0.0" ? [] : [{
      id: "sample.migration-v1-v2",
      from: "1.0.0",
      to: "2.0.0",
      entry: "./migrations/v1-v2.js",
      status: migrationStatus,
    }],
  };
}

describe("runtime event store", () => {
  it("orders events, enforces optimistic revisions and supports idempotent cursor reads", () => {
    const path = databasePath();
    const store = new RuntimeEventStore(path);
    const first = appendDelta(store, "run-events", "event-1", 0, 1);
    const second = appendDelta(store, "run-events", "event-2", 1, 2);
    const third = appendDelta(store, "run-events", "event-3", 2, 3);
    expect([first.event.sequence, second.event.sequence, third.event.sequence]).toEqual([1, 2, 3]);
    expect(store.verifyIntegrity("run-events")).toMatchObject({ revision: 3, lastSequence: 3 });

    const replay = appendDelta(store, "run-events", "event-1", 0, 1);
    expect(replay).toMatchObject({ replayed: true, event: { sequence: 1 } });
    expect(store.position("run-events").revision).toBe(3);
    expect(() => store.append({
      ...first.event,
      expectedRevision: 3,
      payload: { delta: 99 },
    })).toThrow(RuntimeEventIdempotencyConflictError);
    expect(() => appendDelta(store, "run-events", "event-stale", 1, 4))
      .toThrow(RuntimeEventRevisionConflictError);

    const firstPage = store.readPage("run-events", { limit: 2 });
    expect(firstPage.items.map(({ id }) => id)).toEqual(["event-1", "event-2"]);
    expect(firstPage.nextCursor).not.toBeNull();
    const secondPage = store.readPage("run-events", { cursor: firstPage.nextCursor, limit: 2 });
    expect(secondPage.items.map(({ id }) => id)).toEqual(["event-3"]);
    expect(secondPage.nextCursor).toBeNull();
    store.close();
  });

  it("fails closed when the append-only event chain is corrupted", () => {
    const path = databasePath();
    const store = new RuntimeEventStore(path);
    appendDelta(store, "run-corrupt-event", "event-1", 0, 1);
    store.close();
    const database = new DatabaseSync(path);
    database.prepare("UPDATE runtime_events SET payload_json = ? WHERE run_id = ? AND sequence = 1")
      .run('{"delta":100}', "run-corrupt-event");
    database.close();

    const reopened = new RuntimeEventStore(path);
    expect(() => reopened.verifyIntegrity("run-corrupt-event")).toThrow(RuntimeEventCorruptionError);
    reopened.close();
  });
});

describe("runtime snapshots and recovery", () => {
  it("restores from SQLite and produces the same state as complete event replay", () => {
    const path = databasePath();
    let events = new RuntimeEventStore(path);
    let snapshots = new RuntimeSnapshotStore(path);
    appendDelta(events, "run-replay", "event-1", 0, 1);
    appendDelta(events, "run-replay", "event-2", 1, 2);
    snapshots.save<CounterState>({
      id: "snapshot-1",
      runId: "run-replay",
      stateRevision: 2,
      streamRevision: 2,
      eventSequence: 2,
      capturedAt: "2026-01-01T00:00:02.000Z",
      packageVersions: {},
      state: { value: 3 },
      expectedLatestStateRevision: null,
    });
    appendDelta(events, "run-replay", "event-3", 2, 3);
    events.close();
    snapshots.close();

    events = new RuntimeEventStore(path);
    snapshots = new RuntimeSnapshotStore(path);
    const recovery = new RuntimeRecoveryService<CounterState>({
      eventStore: events,
      snapshotStore: snapshots,
      migrator: new RuntimeArchiveMigrator(),
      manifests: [],
      initialState: { value: 0 },
      reducer: counterReducer,
    }).recover("run-replay");
    const replayedFromStart = events.readAfter("run-replay", 0)
      .reduce(counterReducer, { value: 0 });
    expect(recovery).toMatchObject({
      state: { value: 6 },
      sourceSnapshotId: "snapshot-1",
      replayedEventCount: 1,
      lastEventSequence: 3,
      streamRevision: 3,
    });
    expect(recovery.state).toEqual(replayedFromStart);
    events.close();
    snapshots.close();
  });

  it("rejects stale snapshot writers and only captures at the configured event interval", () => {
    const path = databasePath();
    const events = new RuntimeEventStore(path);
    const snapshots = new RuntimeSnapshotStore(path);
    appendDelta(events, "run-snapshot-revision", "event-1", 0, 1);
    snapshots.save<CounterState>({
      id: "snapshot-first",
      runId: "run-snapshot-revision",
      stateRevision: 1,
      streamRevision: 1,
      eventSequence: 1,
      capturedAt: "2026-01-01T00:00:01.000Z",
      packageVersions: {},
      state: { value: 1 },
      expectedLatestStateRevision: null,
    });
    expect(() => snapshots.save<CounterState>({
      id: "snapshot-stale",
      runId: "run-snapshot-revision",
      stateRevision: 2,
      streamRevision: 1,
      eventSequence: 1,
      capturedAt: "2026-01-01T00:00:02.000Z",
      packageVersions: {},
      state: { value: 1 },
      expectedLatestStateRevision: null,
    })).toThrow(RuntimeSnapshotRevisionConflictError);

    const coordinator = new RuntimeSnapshotCoordinator<CounterState>(events, snapshots, { eventInterval: 2 });
    expect(coordinator.captureIfDue("run-snapshot-revision", () => ({
      id: "not-due",
      stateRevision: 2,
      capturedAt: "2026-01-01T00:00:02.000Z",
      packageVersions: {},
      state: { value: 1 },
    }))).toBeNull();
    appendDelta(events, "run-snapshot-revision", "event-2", 1, 2);
    appendDelta(events, "run-snapshot-revision", "event-3", 2, 3);
    expect(coordinator.captureIfDue("run-snapshot-revision", () => ({
      id: "snapshot-due",
      stateRevision: 3,
      capturedAt: "2026-01-01T00:00:03.000Z",
      packageVersions: {},
      state: { value: 6 },
    }))).toMatchObject({ id: "snapshot-due", eventSequence: 3 });
    events.close();
    snapshots.close();
  });

  it("falls back from a corrupted latest snapshot without hiding event corruption", () => {
    const path = databasePath();
    const events = new RuntimeEventStore(path);
    const snapshots = new RuntimeSnapshotStore(path);
    appendDelta(events, "run-snapshot-fallback", "event-1", 0, 1);
    snapshots.save<CounterState>({
      id: "snapshot-valid",
      runId: "run-snapshot-fallback",
      stateRevision: 1,
      streamRevision: 1,
      eventSequence: 1,
      capturedAt: "2026-01-01T00:00:01.000Z",
      packageVersions: {},
      state: { value: 1 },
      expectedLatestStateRevision: null,
    });
    appendDelta(events, "run-snapshot-fallback", "event-2", 1, 2);
    snapshots.save<CounterState>({
      id: "snapshot-corrupt",
      runId: "run-snapshot-fallback",
      stateRevision: 2,
      streamRevision: 2,
      eventSequence: 2,
      capturedAt: "2026-01-01T00:00:02.000Z",
      packageVersions: {},
      state: { value: 3 },
      expectedLatestStateRevision: 1,
    });
    appendDelta(events, "run-snapshot-fallback", "event-3", 2, 3);
    const database = new DatabaseSync(path);
    database.prepare("UPDATE runtime_snapshots SET state_json = ? WHERE snapshot_id = ?")
      .run('{"value":300}', "snapshot-corrupt");
    database.close();

    const recovery = new RuntimeRecoveryService<CounterState>({
      eventStore: events,
      snapshotStore: snapshots,
      migrator: new RuntimeArchiveMigrator(),
      manifests: [],
      initialState: { value: 0 },
      reducer: counterReducer,
    }).recover("run-snapshot-fallback");
    expect(recovery).toMatchObject({
      state: { value: 6 },
      sourceSnapshotId: "snapshot-valid",
      replayedEventCount: 2,
      warnings: [{ code: "snapshot-corrupted", snapshotId: "snapshot-corrupt" }],
    });
    events.close();
    snapshots.close();
  });
});

describe("runtime domain package migration", () => {
  it("migrates snapshot state and replayed event payloads before reducing", () => {
    const path = databasePath();
    const events = new RuntimeEventStore(path);
    const snapshots = new RuntimeSnapshotStore(path);
    snapshots.save<{ readonly legacyValue: number }>({
      id: "snapshot-legacy",
      runId: "run-migration",
      stateRevision: 1,
      streamRevision: 0,
      eventSequence: 0,
      capturedAt: "2026-01-01T00:00:00.000Z",
      packageVersions: { sample: "1.0.0" },
      state: { legacyValue: 4 },
      expectedLatestStateRevision: null,
    });
    appendDelta(events, "run-migration", "event-legacy", 0, 5, {
      id: "sample",
      dataVersion: "1.0.0",
    });
    const declaration = manifest().migrations[0]!;
    const registry = new RuntimeMigrationRegistry().register({
      packageId: "sample",
      declaration,
      handler: (value, context) => {
        if (context.subject === "snapshot") {
          const source = value as { readonly legacyValue: number };
          return { value: source.legacyValue };
        }
        const source = value as { readonly delta: number };
        return { delta: source.delta * 2 };
      },
    });
    const recovery = new RuntimeRecoveryService<CounterState>({
      eventStore: events,
      snapshotStore: snapshots,
      migrator: new RuntimeArchiveMigrator(registry),
      manifests: [manifest()],
      initialState: { value: 0 },
      reducer: counterReducer,
    }).recover("run-migration");
    expect(recovery).toMatchObject({
      state: { value: 14 },
      packageVersions: { sample: "2.0.0" },
      sourceSnapshotId: "snapshot-legacy",
      replayedEventCount: 1,
    });
    events.close();
    snapshots.close();
  });

  it("refuses silent upgrades when a migration declaration or handler is unavailable", () => {
    const current = manifest();
    expect(() => new RuntimeArchiveMigrator().migrateArchive(
      "run-missing-handler",
      { value: { legacyValue: 1 }, packageVersions: { sample: "1.0.0" } },
      [current],
    )).toThrow(RuntimeMigrationHandlerMissingError);
    expect(() => new RuntimeArchiveMigrator().migrateArchive(
      "run-planned-migration",
      { value: { legacyValue: 1 }, packageVersions: { sample: "1.0.0" } },
      [manifest("2.0.0", "planned")],
    )).toThrowError(expect.objectContaining({ code: "migration-not-ready" }));
  });
});
