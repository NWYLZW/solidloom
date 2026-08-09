import {
  InvalidResourceLedgerRequestError,
  RESOURCE_LEDGER_SCHEMA_VERSION,
  ResourceAccountNotFoundError,
  ResourceConservationViolationError,
  ResourceInsufficientBalanceError,
  ResourceLedgerIdempotencyConflictError,
  ResourceLedgerRevisionConflictError,
  ResourceReservationConflictError,
  ResourceReservationFinalizedError,
  ResourceReservationNotFoundError,
  ResourceTypeMismatchError,
  ResourceTypeNotFoundError,
  fingerprintResourceLedgerBatch,
  resourceAmountToUnits,
  resourceUnitsToAmount,
  type ResourceAccountChange,
  type ResourceLedgerBatchRequest,
  type ResourceLedgerBatchResult,
  type ResourceLedgerEntry,
  type ResourceLedgerIdempotencyRecord,
  type ResourceLedgerOperation,
  type ResourceLedgerState,
  type ResourceReservation,
  type RuntimeResourceAccount,
  type RuntimeResourceTypeDefinition,
} from "@solidloom/shared";

interface MutableAccount {
  value: RuntimeResourceAccount;
  readonly definition: RuntimeResourceTypeDefinition;
  balanceUnits: number;
  reservedUnits: number;
}

interface AccountBefore {
  readonly balanceUnits: number;
  readonly reservedUnits: number;
  readonly revision: number;
}

type NewLedgerInput = {
  readonly runId: string;
  readonly resourceTypes: readonly RuntimeResourceTypeDefinition[];
  readonly accounts: readonly RuntimeResourceAccount[];
};

type RestoredLedgerInput = { readonly state: ResourceLedgerState };

function assertNonEmpty(value: string | undefined, name: string): asserts value is string {
  if (!value?.trim()) throw new InvalidResourceLedgerRequestError(`${name} must not be empty.`);
}

function assertTimestamp(value: string) {
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new InvalidResourceLedgerRequestError("recordedAt must be an ISO-compatible timestamp.");
  }
}

function freezeAccount(account: RuntimeResourceAccount): RuntimeResourceAccount {
  return Object.freeze({ ...account, scope: Object.freeze({ ...account.scope }) });
}

function freezeReservation(reservation: ResourceReservation): ResourceReservation {
  return Object.freeze({ ...reservation });
}

function freezeEntry(entry: ResourceLedgerEntry): ResourceLedgerEntry {
  return Object.freeze({
    ...entry,
    accountChanges: Object.freeze(entry.accountChanges.map((change) => Object.freeze({ ...change }))),
  });
}

function freezeIdempotencyRecord(record: ResourceLedgerIdempotencyRecord): ResourceLedgerIdempotencyRecord {
  return Object.freeze({ ...record, entryIds: Object.freeze([...record.entryIds]) });
}

function freezeResourceType(definition: RuntimeResourceTypeDefinition): RuntimeResourceTypeDefinition {
  return Object.freeze({ ...definition, holderEntityTypeIds: Object.freeze([...definition.holderEntityTypeIds]) });
}

function freezeState(state: ResourceLedgerState): ResourceLedgerState {
  return Object.freeze({
    ...state,
    resourceTypes: Object.freeze(state.resourceTypes.map(freezeResourceType)),
    accounts: Object.freeze(state.accounts.map(freezeAccount)),
    reservations: Object.freeze(state.reservations.map(freezeReservation)),
    entries: Object.freeze(state.entries.map(freezeEntry)),
    idempotencyRecords: Object.freeze(state.idempotencyRecords.map(freezeIdempotencyRecord)),
  });
}

function validateResourceTypes(resourceTypes: readonly RuntimeResourceTypeDefinition[]) {
  const ids = new Set<string>();
  resourceTypes.forEach((definition) => {
    assertNonEmpty(definition.id, "resourceType.id");
    if (ids.has(definition.id)) throw new InvalidResourceLedgerRequestError(`Duplicate resource type ${definition.id}.`);
    ids.add(definition.id);
    if (!Number.isSafeInteger(definition.precision) || definition.precision < 0 || definition.precision > 12) {
      throw new InvalidResourceLedgerRequestError(`Resource type ${definition.id} has invalid precision.`);
    }
    if (!definition.divisible && definition.precision !== 0) {
      throw new InvalidResourceLedgerRequestError(`Indivisible resource type ${definition.id} must use zero precision.`);
    }
  });
}

function mutableAccounts(
  resourceTypes: ReadonlyMap<string, RuntimeResourceTypeDefinition>,
  accounts: readonly RuntimeResourceAccount[],
): Map<string, MutableAccount> {
  const result = new Map<string, MutableAccount>();
  accounts.forEach((account) => {
    assertNonEmpty(account.id, "account.id");
    if (result.has(account.id)) throw new InvalidResourceLedgerRequestError(`Duplicate resource account ${account.id}.`);
    const definition = resourceTypes.get(account.resourceTypeId);
    if (!definition) throw new ResourceTypeNotFoundError(account.resourceTypeId);
    const balanceUnits = resourceAmountToUnits(account.balance, definition.precision, `account ${account.id} balance`);
    const reservedUnits = resourceAmountToUnits(account.reserved, definition.precision, `account ${account.id} reserved`);
    if (reservedUnits < 0) throw new InvalidResourceLedgerRequestError(`Resource account ${account.id} has negative reserved quantity.`);
    if (!definition.allowNegative && (balanceUnits < 0 || reservedUnits > balanceUnits)) {
      throw new InvalidResourceLedgerRequestError(`Resource account ${account.id} has an invalid balance or reservation.`);
    }
    if (!Number.isSafeInteger(account.revision) || account.revision < 0) {
      throw new InvalidResourceLedgerRequestError(`Resource account ${account.id} has invalid revision.`);
    }
    result.set(account.id, {
      value: freezeAccount(account),
      definition,
      balanceUnits,
      reservedUnits,
    });
  });
  return result;
}

function positiveUnits(amount: number, definition: RuntimeResourceTypeDefinition, name: string): number {
  const units = resourceAmountToUnits(amount, definition.precision, name);
  if (units <= 0) throw new InvalidResourceLedgerRequestError(`${name} must be greater than zero.`);
  return units;
}

function safeAdd(left: number, right: number, name: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new InvalidResourceLedgerRequestError(`${name} exceeds the safe quantity range.`);
  return result;
}

export class ResourceLedger {
  #state: ResourceLedgerState;

  constructor(input: NewLedgerInput | RestoredLedgerInput) {
    if ("state" in input) {
      if (input.state.schemaVersion !== RESOURCE_LEDGER_SCHEMA_VERSION) {
        throw new InvalidResourceLedgerRequestError("Unsupported resource ledger schema version.");
      }
      this.#state = freezeState(input.state);
    } else {
      assertNonEmpty(input.runId, "runId");
      this.#state = freezeState({
        schemaVersion: RESOURCE_LEDGER_SCHEMA_VERSION,
        runId: input.runId,
        revision: 0,
        nextEntrySequence: 1,
        resourceTypes: input.resourceTypes,
        accounts: input.accounts,
        reservations: [],
        entries: [],
        idempotencyRecords: [],
      });
    }
    this.#validateState();
  }

  get state(): ResourceLedgerState {
    return this.#state;
  }

  execute(request: ResourceLedgerBatchRequest): ResourceLedgerBatchResult {
    this.#validateRequest(request);
    const fingerprint = fingerprintResourceLedgerBatch(request);
    const existing = this.#state.idempotencyRecords.find(({ key }) => key === request.idempotencyKey);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw new ResourceLedgerIdempotencyConflictError(request.idempotencyKey);
      }
      const entryIds = new Set(existing.entryIds);
      return Object.freeze({
        state: this.#state,
        entries: Object.freeze(this.#state.entries.filter(({ id }) => entryIds.has(id))),
        replayed: true,
      });
    }
    if (this.#state.revision !== request.expectedRevision) {
      throw new ResourceLedgerRevisionConflictError(request.expectedRevision, this.#state.revision);
    }
    if (this.#state.entries.some(({ batchId }) => batchId === request.batchId)
      || this.#state.idempotencyRecords.some(({ batchId }) => batchId === request.batchId)) {
      throw new InvalidResourceLedgerRequestError(`Resource batch ID ${request.batchId} already exists.`);
    }

    const definitions = new Map(this.#state.resourceTypes.map((definition) => [definition.id, definition]));
    const accounts = mutableAccounts(definitions, this.#state.accounts);
    const reservations = new Map(this.#state.reservations.map((reservation) => [reservation.id, { ...reservation }]));
    const entries: ResourceLedgerEntry[] = [];
    const conservationDeltas = new Map<string, number>();
    let nextSequence = this.#state.nextEntrySequence;

    request.operations.forEach((operation) => {
      const applied = this.#applyOperation(operation, request, accounts, reservations);
      const currentDelta = conservationDeltas.get(applied.resourceTypeId) ?? 0;
      conservationDeltas.set(applied.resourceTypeId, safeAdd(currentDelta, applied.conservationDeltaUnits, "conservation delta"));
      entries.push(freezeEntry({
        id: `${request.batchId}:entry:${nextSequence}`,
        sequence: nextSequence,
        batchId: request.batchId,
        operationId: operation.operationId,
        operationKind: operation.kind,
        resourceTypeId: applied.resourceTypeId,
        amount: resourceUnitsToAmount(applied.entryAmountUnits, applied.definition.precision),
        sourceActionId: request.sourceActionId ?? null,
        sourceWorkflowId: request.sourceWorkflowId ?? null,
        reservationId: applied.reservationId,
        accountChanges: applied.accountChanges,
        recordedAt: request.recordedAt,
      }));
      nextSequence += 1;
    });

    conservationDeltas.forEach((delta, resourceTypeId) => {
      const definition = definitions.get(resourceTypeId)!;
      if (definition.conservation === "closed" && delta !== 0) {
        throw new ResourceConservationViolationError(
          resourceTypeId,
          resourceUnitsToAmount(delta, definition.precision),
        );
      }
    });

    const revision = this.#state.revision + 1;
    const idempotencyRecord = freezeIdempotencyRecord({
      key: request.idempotencyKey,
      batchId: request.batchId,
      requestFingerprint: fingerprint,
      ledgerRevision: revision,
      entryIds: entries.map(({ id }) => id),
    });
    this.#state = freezeState({
      ...this.#state,
      revision,
      nextEntrySequence: nextSequence,
      accounts: [...accounts.values()].map(({ value }) => value),
      reservations: [...reservations.values()],
      entries: [...this.#state.entries, ...entries],
      idempotencyRecords: [...this.#state.idempotencyRecords, idempotencyRecord],
    });
    return Object.freeze({ state: this.#state, entries: Object.freeze(entries), replayed: false });
  }

  #validateState() {
    assertNonEmpty(this.#state.runId, "state.runId");
    if (!Number.isSafeInteger(this.#state.revision) || this.#state.revision < 0) {
      throw new InvalidResourceLedgerRequestError("Resource ledger revision must be a non-negative safe integer.");
    }
    if (!Number.isSafeInteger(this.#state.nextEntrySequence) || this.#state.nextEntrySequence < 1) {
      throw new InvalidResourceLedgerRequestError("Resource ledger next entry sequence must be a positive safe integer.");
    }
    validateResourceTypes(this.#state.resourceTypes);
    const definitions = new Map(this.#state.resourceTypes.map((definition) => [definition.id, definition]));
    const accounts = mutableAccounts(definitions, this.#state.accounts);
    const reservationIds = new Set<string>();
    const activeReservationUnits = new Map<string, number>();
    this.#state.reservations.forEach((reservation) => {
      if (reservationIds.has(reservation.id)) throw new InvalidResourceLedgerRequestError(`Duplicate reservation ${reservation.id}.`);
      reservationIds.add(reservation.id);
      const account = accounts.get(reservation.accountId);
      if (!account) throw new ResourceAccountNotFoundError(reservation.accountId);
      if (account.definition.id !== reservation.resourceTypeId) {
        throw new InvalidResourceLedgerRequestError(`Reservation ${reservation.id} uses the wrong resource type.`);
      }
      const amountUnits = positiveUnits(
        reservation.amount,
        account.definition,
        `reservation ${reservation.id} amount`,
      );
      if (reservation.status === "active") {
        activeReservationUnits.set(
          reservation.accountId,
          safeAdd(activeReservationUnits.get(reservation.accountId) ?? 0, amountUnits, "active reservation total"),
        );
        if (reservation.finalizedByBatchId !== null || reservation.destinationAccountId !== null) {
          throw new InvalidResourceLedgerRequestError(`Active reservation ${reservation.id} cannot be finalized.`);
        }
      } else if (!reservation.finalizedByBatchId) {
        throw new InvalidResourceLedgerRequestError(`Finalized reservation ${reservation.id} must reference its batch.`);
      }
    });
    accounts.forEach((account, accountId) => {
      if ((activeReservationUnits.get(accountId) ?? 0) !== account.reservedUnits) {
        throw new InvalidResourceLedgerRequestError(`Resource account ${accountId} reserved quantity does not match active reservations.`);
      }
    });
    const entryIds = new Set<string>();
    const entrySequences = new Set<number>();
    this.#state.entries.forEach((entry) => {
      if (entryIds.has(entry.id)) throw new InvalidResourceLedgerRequestError(`Duplicate ledger entry ${entry.id}.`);
      if (!Number.isSafeInteger(entry.sequence) || entry.sequence < 1 || entrySequences.has(entry.sequence)) {
        throw new InvalidResourceLedgerRequestError(`Invalid ledger entry sequence ${entry.sequence}.`);
      }
      entryIds.add(entry.id);
      entrySequences.add(entry.sequence);
    });
    const idempotencyKeys = new Set<string>();
    this.#state.idempotencyRecords.forEach((record) => {
      if (idempotencyKeys.has(record.key)) throw new InvalidResourceLedgerRequestError(`Duplicate idempotency key ${record.key}.`);
      idempotencyKeys.add(record.key);
      record.entryIds.forEach((entryId) => {
        if (!entryIds.has(entryId)) throw new InvalidResourceLedgerRequestError(`Idempotency record references missing entry ${entryId}.`);
      });
    });
  }

  #validateRequest(request: ResourceLedgerBatchRequest) {
    assertNonEmpty(request.batchId, "batchId");
    assertNonEmpty(request.runId, "runId");
    assertNonEmpty(request.idempotencyKey, "idempotencyKey");
    if (request.runId !== this.#state.runId) throw new InvalidResourceLedgerRequestError("Resource batch belongs to another run.");
    if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
      throw new InvalidResourceLedgerRequestError("expectedRevision must be a non-negative safe integer.");
    }
    if (!request.sourceActionId?.trim() && !request.sourceWorkflowId?.trim()) {
      throw new InvalidResourceLedgerRequestError("A resource batch must reference a source action or workflow.");
    }
    assertTimestamp(request.recordedAt);
    if (request.operations.length === 0) throw new InvalidResourceLedgerRequestError("Resource batch must contain operations.");
    const operationIds = new Set<string>();
    request.operations.forEach((operation) => {
      assertNonEmpty(operation.operationId, "operationId");
      if (operationIds.has(operation.operationId)) {
        throw new InvalidResourceLedgerRequestError(`Duplicate resource operation ${operation.operationId}.`);
      }
      operationIds.add(operation.operationId);
    });
  }

  #applyOperation(
    operation: ResourceLedgerOperation,
    request: ResourceLedgerBatchRequest,
    accounts: Map<string, MutableAccount>,
    reservations: Map<string, ResourceReservation>,
  ): {
    readonly resourceTypeId: string;
    readonly definition: RuntimeResourceTypeDefinition;
    readonly entryAmountUnits: number;
    readonly conservationDeltaUnits: number;
    readonly reservationId: string | null;
    readonly accountChanges: readonly ResourceAccountChange[];
  } {
    const requireAccount = (accountId: string) => {
      const account = accounts.get(accountId);
      if (!account) throw new ResourceAccountNotFoundError(accountId);
      if (account.definition.status !== "available") {
        throw new InvalidResourceLedgerRequestError(`Resource type ${account.definition.id} is not available.`);
      }
      return account;
    };
    const before = new Map<string, AccountBefore>();
    const capture = (account: MutableAccount) => {
      if (!before.has(account.value.id)) {
        before.set(account.value.id, {
          balanceUnits: account.balanceUnits,
          reservedUnits: account.reservedUnits,
          revision: account.value.revision,
        });
      }
    };
    const debitAvailable = (account: MutableAccount, units: number) => {
      const available = account.balanceUnits - account.reservedUnits;
      if (!account.definition.allowNegative && available < units) {
        throw new ResourceInsufficientBalanceError(
          account.value.id,
          resourceUnitsToAmount(units, account.definition.precision),
          resourceUnitsToAmount(available, account.definition.precision),
        );
      }
      account.balanceUnits = safeAdd(account.balanceUnits, -units, `account ${account.value.id} balance`);
    };
    let definition: RuntimeResourceTypeDefinition;
    let resourceTypeId: string;
    let entryAmountUnits: number;
    let conservationDeltaUnits = 0;
    let reservationId: string | null = null;

    if (operation.kind === "reserve") {
      const account = requireAccount(operation.accountId);
      if (reservations.has(operation.reservationId)) throw new ResourceReservationConflictError(operation.reservationId);
      const units = positiveUnits(operation.amount, account.definition, "reservation amount");
      const available = account.balanceUnits - account.reservedUnits;
      if (!account.definition.allowNegative && available < units) {
        throw new ResourceInsufficientBalanceError(operation.accountId, operation.amount, resourceUnitsToAmount(available, account.definition.precision));
      }
      capture(account);
      account.reservedUnits = safeAdd(account.reservedUnits, units, `account ${operation.accountId} reserved`);
      reservations.set(operation.reservationId, freezeReservation({
        id: operation.reservationId,
        accountId: operation.accountId,
        resourceTypeId: account.definition.id,
        amount: resourceUnitsToAmount(units, account.definition.precision),
        status: "active",
        createdByBatchId: request.batchId,
        finalizedByBatchId: null,
        destinationAccountId: null,
        revision: 0,
        createdAt: request.recordedAt,
        updatedAt: request.recordedAt,
      }));
      definition = account.definition;
      resourceTypeId = definition.id;
      entryAmountUnits = units;
      reservationId = operation.reservationId;
    } else if (operation.kind === "commit" || operation.kind === "release") {
      const reservation = reservations.get(operation.reservationId);
      if (!reservation) throw new ResourceReservationNotFoundError(operation.reservationId);
      if (reservation.status !== "active") throw new ResourceReservationFinalizedError(reservation.id, reservation.status);
      const account = requireAccount(reservation.accountId);
      const units = positiveUnits(reservation.amount, account.definition, "reservation amount");
      capture(account);
      account.reservedUnits = safeAdd(account.reservedUnits, -units, `account ${account.value.id} reserved`);
      let destinationAccountId: string | null = null;
      if (operation.kind === "commit") {
        account.balanceUnits = safeAdd(account.balanceUnits, -units, `account ${account.value.id} balance`);
        if (operation.destinationAccountId) {
          const destination = requireAccount(operation.destinationAccountId);
          if (destination.definition.id !== account.definition.id) {
            throw new ResourceTypeMismatchError(account.value.id, destination.value.id);
          }
          if (destination.value.id === account.value.id) {
            throw new InvalidResourceLedgerRequestError("Reservation destination must differ from its source account.");
          }
          capture(destination);
          destination.balanceUnits = safeAdd(destination.balanceUnits, units, `account ${destination.value.id} balance`);
          destinationAccountId = destination.value.id;
        } else {
          conservationDeltaUnits = -units;
        }
      }
      reservations.set(reservation.id, freezeReservation({
        ...reservation,
        status: operation.kind === "commit" ? "committed" : "released",
        finalizedByBatchId: request.batchId,
        destinationAccountId,
        revision: reservation.revision + 1,
        updatedAt: request.recordedAt,
      }));
      definition = account.definition;
      resourceTypeId = definition.id;
      entryAmountUnits = units;
      reservationId = reservation.id;
    } else if (operation.kind === "transfer") {
      const source = requireAccount(operation.sourceAccountId);
      const destination = requireAccount(operation.destinationAccountId);
      if (source.definition.id !== destination.definition.id) {
        throw new ResourceTypeMismatchError(source.value.id, destination.value.id);
      }
      if (source.value.id === destination.value.id) {
        throw new InvalidResourceLedgerRequestError("Transfer accounts must differ.");
      }
      const units = positiveUnits(operation.amount, source.definition, "transfer amount");
      capture(source);
      capture(destination);
      debitAvailable(source, units);
      destination.balanceUnits = safeAdd(destination.balanceUnits, units, `account ${destination.value.id} balance`);
      definition = source.definition;
      resourceTypeId = definition.id;
      entryAmountUnits = units;
    } else {
      const account = requireAccount(operation.accountId);
      capture(account);
      definition = account.definition;
      resourceTypeId = definition.id;
      if (operation.kind === "produce") {
        const units = positiveUnits(operation.amount, definition, "production amount");
        account.balanceUnits = safeAdd(account.balanceUnits, units, `account ${account.value.id} balance`);
        entryAmountUnits = units;
        conservationDeltaUnits = units;
      } else if (operation.kind === "consume") {
        const units = positiveUnits(operation.amount, definition, "consumption amount");
        debitAvailable(account, units);
        entryAmountUnits = units;
        conservationDeltaUnits = -units;
      } else {
        if (!operation.reason.trim()) throw new InvalidResourceLedgerRequestError("Adjustment reason must not be empty.");
        const units = resourceAmountToUnits(operation.delta, definition.precision, "adjustment delta");
        if (units === 0) throw new InvalidResourceLedgerRequestError("Adjustment delta must not be zero.");
        if (units < 0) debitAvailable(account, -units);
        else account.balanceUnits = safeAdd(account.balanceUnits, units, `account ${account.value.id} balance`);
        entryAmountUnits = units;
        conservationDeltaUnits = units;
      }
    }

    const changes = [...before.entries()].map(([accountId, previous]) => {
      const account = accounts.get(accountId)!;
      const changed = previous.balanceUnits !== account.balanceUnits || previous.reservedUnits !== account.reservedUnits;
      if (!changed) throw new InvalidResourceLedgerRequestError(`Resource operation ${operation.operationId} produced no account change.`);
      account.value = freezeAccount({
        ...account.value,
        balance: resourceUnitsToAmount(account.balanceUnits, account.definition.precision),
        reserved: resourceUnitsToAmount(account.reservedUnits, account.definition.precision),
        revision: previous.revision + 1,
        updatedAt: request.recordedAt,
      });
      return Object.freeze({
        accountId,
        balanceBefore: resourceUnitsToAmount(previous.balanceUnits, account.definition.precision),
        balanceAfter: account.value.balance,
        reservedBefore: resourceUnitsToAmount(previous.reservedUnits, account.definition.precision),
        reservedAfter: account.value.reserved,
        revisionBefore: previous.revision,
        revisionAfter: account.value.revision,
      });
    });
    return {
      resourceTypeId,
      definition,
      entryAmountUnits,
      conservationDeltaUnits,
      reservationId,
      accountChanges: Object.freeze(changes),
    };
  }
}
