import {
  ResourceConservationViolationError,
  ResourceInsufficientBalanceError,
  ResourceLedgerIdempotencyConflictError,
  type ResourceLedgerBatchRequest,
  type RuntimeResourceAccount,
  type RuntimeResourceTypeDefinition,
  type SemanticActionDefinition,
} from "@solidloom/shared";
import { SemanticActionRuntime } from "../apps/server/src/actions/semantic-action-runtime.js";
import {
  ResourceLedger,
  ResourceLedgerEffectAdapter,
} from "../apps/server/src/resources/index.js";
import { describe, expect, it } from "vitest";

const recordedAt = "2026-08-10T08:00:00.000Z";

function resourceType(
  id: string,
  overrides: Partial<RuntimeResourceTypeDefinition> = {},
): RuntimeResourceTypeDefinition {
  return {
    kind: "resource",
    id,
    domainPackageId: "sample-package",
    displayName: id,
    description: "用于验证通用资源账本。",
    revision: 1,
    status: "available",
    unit: "unit",
    precision: 0,
    divisible: false,
    allowNegative: false,
    conservation: "closed",
    holderEntityTypeIds: [],
    ...overrides,
  };
}

function account(
  id: string,
  resourceTypeId: string,
  balance: number,
  reserved = 0,
): RuntimeResourceAccount {
  return {
    id,
    resourceTypeId,
    holderEntityId: null,
    scope: { kind: "run", runId: "run-resources" },
    balance,
    reserved,
    revision: 0,
    updatedAt: recordedAt,
  };
}

function batch(
  id: string,
  operations: ResourceLedgerBatchRequest["operations"],
  overrides: Partial<ResourceLedgerBatchRequest> = {},
): ResourceLedgerBatchRequest {
  return {
    batchId: id,
    runId: "run-resources",
    idempotencyKey: `key-${id}`,
    expectedRevision: 0,
    sourceActionId: `action-${id}`,
    recordedAt,
    operations,
    ...overrides,
  };
}

function actionDefinition(): SemanticActionDefinition {
  return {
    id: "sample.buy",
    domainPackageId: "sample-package",
    displayName: "购买物品",
    description: "提交一次资源消费。",
    revision: 1,
    status: "available",
    parametersSchema: { type: "object" },
    subject: { required: false, entityTypeIds: [] },
    target: { required: false, scopeKinds: [], entityTypeIds: [] },
    preconditions: [],
    requiredCapabilities: [],
    channels: [],
    durationMs: 0,
    timeoutMs: null,
    commitPoint: { mode: "on-start" },
    commitEffectId: "sample.consume-credit",
    cancellation: { beforeCommit: "allow", afterCommit: { mode: "reject" } },
  };
}

describe("resource ledger", () => {
  it("reserves, commits and releases quantities with traceable entries", () => {
    const credits = resourceType("sample.credit", { precision: 2, divisible: true, unit: "credit" });
    const ledger = new ResourceLedger({
      runId: "run-resources",
      resourceTypes: [credits],
      accounts: [account("wallet", credits.id, 20), account("merchant", credits.id, 5)],
    });

    const reserved = ledger.execute(batch("reserve", [{
      kind: "reserve",
      operationId: "reserve-payment",
      reservationId: "payment-1",
      accountId: "wallet",
      amount: 6.25,
    }]));
    expect(reserved.state.accounts.find(({ id }) => id === "wallet")).toMatchObject({ balance: 20, reserved: 6.25 });
    expect(reserved.state.reservations[0]).toMatchObject({ status: "active", amount: 6.25 });

    const committed = ledger.execute(batch("commit", [{
      kind: "commit",
      operationId: "commit-payment",
      reservationId: "payment-1",
      destinationAccountId: "merchant",
    }], {
      expectedRevision: ledger.state.revision,
      sourceActionId: "action-buy",
      sourceWorkflowId: "workflow-checkout",
    }));
    expect(committed.state.accounts.map(({ id, balance, reserved }) => ({ id, balance, reserved }))).toEqual([
      { id: "wallet", balance: 13.75, reserved: 0 },
      { id: "merchant", balance: 11.25, reserved: 0 },
    ]);
    expect(committed.state.reservations[0]).toMatchObject({
      status: "committed",
      destinationAccountId: "merchant",
    });
    expect(committed.entries[0]).toMatchObject({
      sourceActionId: "action-buy",
      sourceWorkflowId: "workflow-checkout",
      reservationId: "payment-1",
    });

    ledger.execute(batch("reserve-release", [{
      kind: "reserve",
      operationId: "reserve-refund",
      reservationId: "payment-2",
      accountId: "wallet",
      amount: 2.5,
    }], { expectedRevision: ledger.state.revision }));
    ledger.execute(batch("release", [{
      kind: "release",
      operationId: "release-refund",
      reservationId: "payment-2",
    }], { expectedRevision: ledger.state.revision }));
    expect(ledger.state.accounts.find(({ id }) => id === "wallet")?.reserved).toBe(0);
    expect(ledger.state.reservations.find(({ id }) => id === "payment-2")?.status).toBe("released");
  });

  it("does not leave a half-entry when any operation in an atomic batch fails", () => {
    const stock = resourceType("sample.stock");
    const ledger = new ResourceLedger({
      runId: "run-resources",
      resourceTypes: [stock],
      accounts: [account("source", stock.id, 10), account("destination", stock.id, 0)],
    });
    const stateBefore = ledger.state;

    expect(() => ledger.execute(batch("atomic-failure", [
      {
        kind: "transfer",
        operationId: "valid-transfer",
        sourceAccountId: "source",
        destinationAccountId: "destination",
        amount: 4,
      },
      {
        kind: "transfer",
        operationId: "insufficient-transfer",
        sourceAccountId: "source",
        destinationAccountId: "destination",
        amount: 20,
      },
    ]))).toThrow(ResourceInsufficientBalanceError);

    expect(ledger.state).toBe(stateBefore);
    expect(ledger.state.accounts.map(({ balance }) => balance)).toEqual([10, 0]);
    expect(ledger.state.entries).toEqual([]);
    expect(ledger.state.revision).toBe(0);
  });

  it("replays an idempotent batch without duplicate debit or credit", () => {
    const stock = resourceType("sample.stock");
    const ledger = new ResourceLedger({
      runId: "run-resources",
      resourceTypes: [stock],
      accounts: [account("source", stock.id, 10), account("destination", stock.id, 0)],
    });
    const request = batch("transfer", [{
      kind: "transfer",
      operationId: "move-stock",
      sourceAccountId: "source",
      destinationAccountId: "destination",
      amount: 3,
    }]);
    const first = ledger.execute(request);
    const replay = ledger.execute(request);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.entries.map(({ id }) => id)).toEqual(first.entries.map(({ id }) => id));
    expect(ledger.state.accounts.map(({ balance }) => balance)).toEqual([7, 3]);
    expect(ledger.state.entries).toHaveLength(1);
    expect(ledger.state.revision).toBe(1);

    expect(() => ledger.execute({
      ...request,
      expectedRevision: ledger.state.revision,
      operations: [{ ...request.operations[0]!, amount: 4 }],
    })).toThrow(ResourceLedgerIdempotencyConflictError);
  });

  it("enforces conservation while allowing explicit production, consumption and adjustment", () => {
    const closed = resourceType("sample.closed");
    const consumable = resourceType("sample.consumable", {
      precision: 1,
      divisible: true,
      conservation: "none",
    });
    const ledger = new ResourceLedger({
      runId: "run-resources",
      resourceTypes: [closed, consumable],
      accounts: [account("closed-account", closed.id, 2), account("consumable-account", consumable.id, 5)],
    });

    expect(() => ledger.execute(batch("closed-production", [{
      kind: "produce",
      operationId: "mint",
      accountId: "closed-account",
      amount: 1,
    }]))).toThrow(ResourceConservationViolationError);
    expect(ledger.state.revision).toBe(0);

    ledger.execute(batch("open-effects", [
      { kind: "produce", operationId: "produce", accountId: "consumable-account", amount: 2.5 },
      { kind: "consume", operationId: "consume", accountId: "consumable-account", amount: 1.2 },
      { kind: "adjust", operationId: "adjust", accountId: "consumable-account", delta: -0.3, reason: "盘点修正" },
    ]));
    expect(ledger.state.accounts.find(({ id }) => id === "consumable-account")?.balance).toBe(6);
    expect(ledger.state.entries.map(({ amount }) => amount)).toEqual([2.5, 1.2, -0.3]);
  });

  it("bridges a semantic action effect to one idempotent ledger batch", () => {
    const consumable = resourceType("sample.credit", { conservation: "none" });
    const ledger = new ResourceLedger({
      runId: "run-resources",
      resourceTypes: [consumable],
      accounts: [account("wallet", consumable.id, 5)],
    });
    const definition = actionDefinition();
    const adapter = new ResourceLedgerEffectAdapter(ledger, {
      resolve: () => ({
        operations: [{
          kind: "consume",
          operationId: "consume-credit",
          accountId: "wallet",
          amount: 1,
        }],
      }),
    });
    const runtime = new SemanticActionRuntime({
      runId: "run-resources",
      definitions: [definition],
      effectAdapter: adapter,
    });
    const submitted = runtime.submit({
      actionId: "buy-1",
      runId: "run-resources",
      definitionId: definition.id,
      subject: null,
      target: null,
      parameters: {},
      idempotencyKey: "buy-1",
      expectedRevision: 0,
      proposedAtSimulationTimeMs: 0,
    });

    expect(submitted.action.status).toBe("completed");
    expect(ledger.state.accounts[0]?.balance).toBe(4);
    expect(submitted.events.find(({ type }) => type === "resources.batch-committed")).toMatchObject({
      kind: "domain",
      payload: { ledgerRevision: 1, replayed: false },
    });

    const replay = adapter.commit({
      effectId: definition.commitEffectId!,
      action: submitted.action,
      definition,
      state: runtime.state,
    });
    expect(replay.events[0]?.payload).toMatchObject({ ledgerRevision: 1, replayed: true });
    expect(ledger.state.accounts[0]?.balance).toBe(4);
    expect(ledger.state.entries).toHaveLength(1);
  });
});
