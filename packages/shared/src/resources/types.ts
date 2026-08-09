import type {
  RuntimeResourceAccount,
  RuntimeResourceTypeDefinition,
} from "../runtime/domain.js";

export const RESOURCE_LEDGER_SCHEMA_VERSION = 1 as const;
export const RESOURCE_RESERVATION_STATUSES = ["active", "committed", "released"] as const;

export type ResourceReservationStatus = (typeof RESOURCE_RESERVATION_STATUSES)[number];

interface ResourceOperationBase {
  readonly operationId: string;
}

export interface ResourceReserveOperation extends ResourceOperationBase {
  readonly kind: "reserve";
  readonly reservationId: string;
  readonly accountId: string;
  readonly amount: number;
}

export interface ResourceCommitOperation extends ResourceOperationBase {
  readonly kind: "commit";
  readonly reservationId: string;
  readonly destinationAccountId?: string;
}

export interface ResourceReleaseOperation extends ResourceOperationBase {
  readonly kind: "release";
  readonly reservationId: string;
}

export interface ResourceTransferOperation extends ResourceOperationBase {
  readonly kind: "transfer";
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly amount: number;
}

export interface ResourceProduceOperation extends ResourceOperationBase {
  readonly kind: "produce";
  readonly accountId: string;
  readonly amount: number;
}

export interface ResourceConsumeOperation extends ResourceOperationBase {
  readonly kind: "consume";
  readonly accountId: string;
  readonly amount: number;
}

export interface ResourceAdjustOperation extends ResourceOperationBase {
  readonly kind: "adjust";
  readonly accountId: string;
  readonly delta: number;
  readonly reason: string;
}

export type ResourceLedgerOperation = (
  | ResourceReserveOperation
  | ResourceCommitOperation
  | ResourceReleaseOperation
  | ResourceTransferOperation
  | ResourceProduceOperation
  | ResourceConsumeOperation
  | ResourceAdjustOperation
);

export interface ResourceLedgerBatchRequest {
  readonly batchId: string;
  readonly runId: string;
  readonly idempotencyKey: string;
  readonly expectedRevision: number;
  readonly sourceActionId?: string;
  readonly sourceWorkflowId?: string;
  readonly recordedAt: string;
  readonly operations: readonly ResourceLedgerOperation[];
}

export interface ResourceReservation {
  readonly id: string;
  readonly accountId: string;
  readonly resourceTypeId: string;
  readonly amount: number;
  readonly status: ResourceReservationStatus;
  readonly createdByBatchId: string;
  readonly finalizedByBatchId: string | null;
  readonly destinationAccountId: string | null;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResourceAccountChange {
  readonly accountId: string;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly reservedBefore: number;
  readonly reservedAfter: number;
  readonly revisionBefore: number;
  readonly revisionAfter: number;
}

export interface ResourceLedgerEntry {
  readonly id: string;
  readonly sequence: number;
  readonly batchId: string;
  readonly operationId: string;
  readonly operationKind: ResourceLedgerOperation["kind"];
  readonly resourceTypeId: string;
  readonly amount: number;
  readonly sourceActionId: string | null;
  readonly sourceWorkflowId: string | null;
  readonly reservationId: string | null;
  readonly accountChanges: readonly ResourceAccountChange[];
  readonly recordedAt: string;
}

export interface ResourceLedgerIdempotencyRecord {
  readonly key: string;
  readonly batchId: string;
  readonly requestFingerprint: string;
  readonly ledgerRevision: number;
  readonly entryIds: readonly string[];
}

export interface ResourceLedgerState {
  readonly schemaVersion: typeof RESOURCE_LEDGER_SCHEMA_VERSION;
  readonly runId: string;
  readonly revision: number;
  readonly nextEntrySequence: number;
  readonly resourceTypes: readonly RuntimeResourceTypeDefinition[];
  readonly accounts: readonly RuntimeResourceAccount[];
  readonly reservations: readonly ResourceReservation[];
  readonly entries: readonly ResourceLedgerEntry[];
  readonly idempotencyRecords: readonly ResourceLedgerIdempotencyRecord[];
}

export interface ResourceLedgerBatchResult {
  readonly state: ResourceLedgerState;
  readonly entries: readonly ResourceLedgerEntry[];
  readonly replayed: boolean;
}
