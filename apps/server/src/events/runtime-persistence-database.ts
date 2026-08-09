import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DEFAULT_RUNTIME_DATABASE_PATH = process.env.SOLIDLOOM_DATABASE_PATH
  ?? resolve(process.cwd(), "data/solidloom.db");

export function openRuntimePersistenceDatabase(
  databasePath = DEFAULT_RUNTIME_DATABASE_PATH,
): DatabaseSync {
  if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  if (databasePath !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
  ensureRuntimePersistenceSchema(database);
  return database;
}

export function ensureRuntimePersistenceSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS runtime_event_streams (
      run_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL CHECK (revision >= 0),
      last_sequence INTEGER NOT NULL CHECK (last_sequence >= 0),
      last_checksum TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runtime_events (
      run_id TEXT NOT NULL,
      sequence INTEGER NOT NULL CHECK (sequence >= 1),
      stream_revision INTEGER NOT NULL CHECK (stream_revision >= 1),
      schema_version INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      request_fingerprint TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      simulation_time_ms INTEGER NOT NULL CHECK (simulation_time_ms >= 0),
      recorded_at TEXT NOT NULL,
      domain_package_id TEXT,
      domain_package_data_version TEXT,
      previous_checksum TEXT,
      checksum TEXT NOT NULL,
      PRIMARY KEY (run_id, sequence),
      UNIQUE (run_id, event_id),
      UNIQUE (run_id, idempotency_key),
      FOREIGN KEY (run_id) REFERENCES runtime_event_streams(run_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS runtime_events_type_index
      ON runtime_events(run_id, event_type, sequence);

    CREATE TABLE IF NOT EXISTS runtime_snapshots (
      snapshot_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      state_revision INTEGER NOT NULL CHECK (state_revision >= 0),
      stream_revision INTEGER NOT NULL CHECK (stream_revision >= 0),
      event_sequence INTEGER NOT NULL CHECK (event_sequence >= 0),
      captured_at TEXT NOT NULL,
      package_versions_json TEXT NOT NULL,
      state_json TEXT NOT NULL,
      checksum TEXT NOT NULL,
      UNIQUE (run_id, state_revision)
    );

    CREATE INDEX IF NOT EXISTS runtime_snapshots_recovery_index
      ON runtime_snapshots(run_id, stream_revision DESC, captured_at DESC);
  `);
}
