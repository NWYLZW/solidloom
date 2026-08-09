import type { RuntimeJsonValue } from "@solidloom/shared";
import type { RuntimeDomainPackageVersions } from "../migrations/types.js";

export const RUNTIME_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface RuntimeSnapshotEnvelope<Value extends RuntimeJsonValue = RuntimeJsonValue> {
  readonly schemaVersion: typeof RUNTIME_SNAPSHOT_SCHEMA_VERSION;
  readonly id: string;
  readonly runId: string;
  readonly stateRevision: number;
  readonly streamRevision: number;
  readonly eventSequence: number;
  readonly capturedAt: string;
  readonly packageVersions: RuntimeDomainPackageVersions;
  readonly state: Value;
  readonly checksum: string;
}

export interface SaveRuntimeSnapshotInput<Value extends RuntimeJsonValue = RuntimeJsonValue> {
  readonly id: string;
  readonly runId: string;
  readonly stateRevision: number;
  readonly streamRevision: number;
  readonly eventSequence: number;
  readonly capturedAt: string;
  readonly packageVersions: RuntimeDomainPackageVersions;
  readonly state: Value;
  readonly expectedLatestStateRevision: number | null;
}

export interface RuntimeSnapshotCandidate<Value extends RuntimeJsonValue = RuntimeJsonValue> {
  readonly id: string;
  readonly stateRevision: number;
  readonly streamRevision: number;
  readonly eventSequence: number;
  readonly capturedAt: string;
  readonly snapshot: RuntimeSnapshotEnvelope<Value> | null;
  readonly error: Error | null;
}

export interface RuntimeRecoveryWarning {
  readonly code: "snapshot-corrupted" | "snapshot-ahead-of-event-stream";
  readonly message: string;
  readonly snapshotId: string;
}

export interface RuntimeRecoveryResult<Value extends RuntimeJsonValue = RuntimeJsonValue> {
  readonly state: Value;
  readonly packageVersions: RuntimeDomainPackageVersions;
  readonly streamRevision: number;
  readonly lastEventSequence: number;
  readonly sourceSnapshotId: string | null;
  readonly replayedEventCount: number;
  readonly nextEventCursor: string;
  readonly warnings: readonly RuntimeRecoveryWarning[];
}

export interface RuntimeSnapshotCapture<Value extends RuntimeJsonValue = RuntimeJsonValue> {
  readonly id: string;
  readonly stateRevision: number;
  readonly capturedAt: string;
  readonly packageVersions: RuntimeDomainPackageVersions;
  readonly state: Value;
}
