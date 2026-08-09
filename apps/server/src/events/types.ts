import type { RuntimeJsonObject } from "@solidloom/shared";

export const RUNTIME_EVENT_SCHEMA_VERSION = 1 as const;

export interface RuntimeEventDomainPackageReference {
  readonly id: string;
  readonly dataVersion: string;
}

export interface RuntimeEventEnvelope {
  readonly schemaVersion: typeof RUNTIME_EVENT_SCHEMA_VERSION;
  readonly id: string;
  readonly idempotencyKey: string;
  readonly runId: string;
  readonly sequence: number;
  readonly streamRevision: number;
  readonly type: string;
  readonly payload: RuntimeJsonObject;
  readonly simulationTimeMs: number;
  readonly recordedAt: string;
  readonly domainPackage: RuntimeEventDomainPackageReference | null;
  readonly previousChecksum: string | null;
  readonly checksum: string;
}

export interface AppendRuntimeEventInput {
  readonly id: string;
  readonly idempotencyKey: string;
  readonly runId: string;
  readonly expectedRevision: number;
  readonly type: string;
  readonly payload: RuntimeJsonObject;
  readonly simulationTimeMs: number;
  readonly recordedAt: string;
  readonly domainPackage?: RuntimeEventDomainPackageReference | null;
}

export interface AppendRuntimeEventResult {
  readonly event: RuntimeEventEnvelope;
  readonly replayed: boolean;
}

export interface RuntimeEventStreamPosition {
  readonly runId: string;
  readonly revision: number;
  readonly lastSequence: number;
  readonly lastChecksum: string | null;
}

export interface RuntimeEventPage {
  readonly items: readonly RuntimeEventEnvelope[];
  readonly nextCursor: string | null;
  readonly streamRevision: number;
}
