export type ResourceLedgerErrorCode = (
  | "invalid-request"
  | "revision-conflict"
  | "idempotency-conflict"
  | "account-not-found"
  | "resource-type-not-found"
  | "resource-type-mismatch"
  | "insufficient-balance"
  | "reservation-not-found"
  | "reservation-conflict"
  | "reservation-finalized"
  | "conservation-violation"
);

export class ResourceLedgerError extends Error {
  constructor(
    readonly code: ResourceLedgerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ResourceLedgerError";
  }
}

export class InvalidResourceLedgerRequestError extends ResourceLedgerError {
  constructor(message: string) {
    super("invalid-request", message);
    this.name = "InvalidResourceLedgerRequestError";
  }
}

export class ResourceLedgerRevisionConflictError extends ResourceLedgerError {
  constructor(
    readonly expectedRevision: number,
    readonly currentRevision: number,
  ) {
    super("revision-conflict", `Expected resource ledger revision ${expectedRevision}, current revision is ${currentRevision}.`);
    this.name = "ResourceLedgerRevisionConflictError";
  }
}

export class ResourceLedgerIdempotencyConflictError extends ResourceLedgerError {
  constructor(readonly idempotencyKey: string) {
    super("idempotency-conflict", `Idempotency key ${idempotencyKey} was already used by another resource batch.`);
    this.name = "ResourceLedgerIdempotencyConflictError";
  }
}

export class ResourceAccountNotFoundError extends ResourceLedgerError {
  constructor(readonly accountId: string) {
    super("account-not-found", `Resource account ${accountId} was not found.`);
    this.name = "ResourceAccountNotFoundError";
  }
}

export class ResourceTypeNotFoundError extends ResourceLedgerError {
  constructor(readonly resourceTypeId: string) {
    super("resource-type-not-found", `Resource type ${resourceTypeId} was not found.`);
    this.name = "ResourceTypeNotFoundError";
  }
}

export class ResourceTypeMismatchError extends ResourceLedgerError {
  constructor(readonly sourceAccountId: string, readonly destinationAccountId: string) {
    super("resource-type-mismatch", `Resource accounts ${sourceAccountId} and ${destinationAccountId} use different resource types.`);
    this.name = "ResourceTypeMismatchError";
  }
}

export class ResourceInsufficientBalanceError extends ResourceLedgerError {
  constructor(
    readonly accountId: string,
    readonly requested: number,
    readonly available: number,
  ) {
    super("insufficient-balance", `Resource account ${accountId} has ${available} available, ${requested} is required.`);
    this.name = "ResourceInsufficientBalanceError";
  }
}

export class ResourceReservationNotFoundError extends ResourceLedgerError {
  constructor(readonly reservationId: string) {
    super("reservation-not-found", `Resource reservation ${reservationId} was not found.`);
    this.name = "ResourceReservationNotFoundError";
  }
}

export class ResourceReservationConflictError extends ResourceLedgerError {
  constructor(readonly reservationId: string) {
    super("reservation-conflict", `Resource reservation ${reservationId} already exists.`);
    this.name = "ResourceReservationConflictError";
  }
}

export class ResourceReservationFinalizedError extends ResourceLedgerError {
  constructor(readonly reservationId: string, readonly status: string) {
    super("reservation-finalized", `Resource reservation ${reservationId} is already ${status}.`);
    this.name = "ResourceReservationFinalizedError";
  }
}

export class ResourceConservationViolationError extends ResourceLedgerError {
  constructor(readonly resourceTypeId: string, readonly delta: number) {
    super("conservation-violation", `Closed resource ${resourceTypeId} cannot change total quantity by ${delta}.`);
    this.name = "ResourceConservationViolationError";
  }
}
