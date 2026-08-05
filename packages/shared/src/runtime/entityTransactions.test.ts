import { describe, expect, it } from "vitest";
import {
  cancelEntityTransfer,
  commitEntityTransfer,
  createEntityRuntimeState,
  executeEntityTransfer,
  hasEntityAccess,
  issueTemporaryAccessGrant,
  prepareEntityTransfer,
  type EntityRuntimeState,
  type EntityTransferRequest,
} from "./entityTransactions.js";

function fixture(): EntityRuntimeState {
  return createEntityRuntimeState({
    revision: 7,
    entities: {
      agent: { id: "agent", label: "操作员", tags: ["actor"], ownerId: null, containerId: null, revision: 0 },
      machine: { id: "machine", label: "设备", tags: ["machine"], ownerId: "company", containerId: null, revision: 0 },
      snackA: { id: "snackA", label: "外部零食", tags: ["stock", "snack"], ownerId: "agent", containerId: "agent-storage", revision: 0 },
      snackB: { id: "snackB", label: "设备零食", tags: ["stock", "snack"], ownerId: "machine", containerId: "machine-stock", revision: 0 },
      drink: { id: "drink", label: "饮料", tags: ["stock", "drink"], ownerId: "agent", containerId: "agent-storage", revision: 0 },
      key: { id: "key", label: "维修钥匙", tags: ["credential"], ownerId: "agent", containerId: "agent-storage", revision: 0 },
    },
    containers: {
      "agent-storage": { id: "agent-storage", label: "外部储物区", ownerEntityId: "agent", capacity: 8, entityIds: ["snackA", "drink", "key"], revision: 0 },
      "machine-stock": { id: "machine-stock", label: "设备库存", ownerEntityId: "machine", capacity: 2, entityIds: ["snackB"], revision: 0 },
    },
    ports: {
      "stock-input": {
        id: "stock-input",
        label: "库存输入口",
        targetOwnerId: "machine",
        targetContainerId: "machine-stock",
        accepts: { all: ["stock"], any: ["snack"] },
        requirements: [{ capability: "inventory.manage", scopeEntityId: "machine" }],
      },
    },
    credentials: {
      key: {
        capabilities: ["inventory.manage"],
        scopeEntityIds: ["machine"],
        expiresAt: null,
        mode: "bearer",
      },
    },
  });
}

function depositRequest(state: EntityRuntimeState, actionId = "deposit-a"): EntityTransferRequest {
  return {
    actionId,
    actorId: "agent",
    expectedRevision: state.revision,
    now: 1_000,
    credentialEntityIds: ["key"],
    requirements: [],
    legs: [{
      entityId: "snackA",
      expectedOwnerId: "agent",
      expectedContainerId: "agent-storage",
      targetOwnerId: "machine",
      targetContainerId: "machine-stock",
      portId: "stock-input",
    }],
  };
}

describe("generic entity transactions", () => {
  it("transfers ownership and containment through a declared input port", () => {
    const state = fixture();
    const result = executeEntityTransfer(state, depositRequest(state));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.entities.snackA).toMatchObject({
      ownerId: "machine",
      containerId: "machine-stock",
      revision: 1,
    });
    expect(result.state.containers["agent-storage"]?.entityIds).toEqual(["drink", "key"]);
    expect(result.state.containers["machine-stock"]?.entityIds).toEqual(["snackB", "snackA"]);
    expect(state.entities.snackA?.ownerId).toBe("agent");
  });

  it("atomically exchanges entities even when the destination starts full", () => {
    const state = fixture();
    state.containers["machine-stock"]!.capacity = 1;
    const result = executeEntityTransfer(state, {
      ...depositRequest(state, "exchange-a-b"),
      legs: [
        depositRequest(state).legs[0]!,
        {
          entityId: "snackB",
          expectedOwnerId: "machine",
          expectedContainerId: "machine-stock",
          targetOwnerId: "agent",
          targetContainerId: "agent-storage",
          portId: null,
        },
      ],
      requirements: [{ capability: "inventory.manage", scopeEntityId: "machine" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.containers["machine-stock"]?.entityIds).toEqual(["snackA"]);
    expect(result.state.entities.snackB).toMatchObject({ ownerId: "agent", containerId: "agent-storage" });
  });

  it("rejects incompatible input and preserves every ownership relation", () => {
    const state = fixture();
    const result = executeEntityTransfer(state, {
      ...depositRequest(state),
      legs: [{ ...depositRequest(state).legs[0]!, entityId: "drink" }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("entity-rejected");
    expect(result.state).toEqual(state);
  });

  it("rejects a full target container without partially changing the source", () => {
    const state = fixture();
    state.containers["machine-stock"]!.capacity = 1;
    const result = executeEntityTransfer(state, depositRequest(state));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("container-capacity");
    expect(result.state.entities.snackA).toMatchObject({ ownerId: "agent", containerId: "agent-storage" });
    expect(result.state.containers["machine-stock"]?.entityIds).toEqual(["snackB"]);
  });

  it("transfers a credential entity with the same ownership primitive", () => {
    const state = fixture();
    const result = executeEntityTransfer(state, {
      actionId: "hand-over-key",
      actorId: "agent",
      expectedRevision: state.revision,
      now: 1_000,
      credentialEntityIds: [],
      requirements: [],
      legs: [{
        entityId: "key",
        expectedOwnerId: "agent",
        expectedContainerId: "agent-storage",
        targetOwnerId: "machine",
        targetContainerId: null,
        portId: null,
      }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.entities.key).toMatchObject({ ownerId: "machine", containerId: null });
    expect(result.state.credentials.key?.capabilities).toEqual(["inventory.manage"]);
  });

  it("requires a usable scoped credential or an unexpired temporary grant", () => {
    const state = fixture();
    const denied = executeEntityTransfer(state, {
      ...depositRequest(state),
      credentialEntityIds: [],
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.error.code).toBe("access-denied");

    const granted = issueTemporaryAccessGrant(state, {
      actionId: "hack-success",
      subjectId: "agent",
      issuedBy: "machine-security",
      capability: "inventory.manage",
      scopeEntityId: "machine",
      now: 1_000,
      durationMs: 500,
    });
    expect(hasEntityAccess(granted, "agent", {
      capability: "inventory.manage",
      scopeEntityId: "machine",
    }, [], 1_200)).toBe(true);
    expect(hasEntityAccess(granted, "agent", {
      capability: "inventory.manage",
      scopeEntityId: "machine",
    }, [], 1_501)).toBe(false);
  });

  it("rejects stale reservations and supports cancellation before commit", () => {
    const state = fixture();
    const prepared = prepareEntityTransfer(state, depositRequest(state));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const cancelled = commitEntityTransfer(state, cancelEntityTransfer(prepared.reservation));
    expect(cancelled.ok).toBe(false);
    if (cancelled.ok) return;
    expect(cancelled.error.code).toBe("reservation-cancelled");
    expect(cancelled.state).toEqual(state);

    const concurrentState = { ...state, revision: state.revision + 1 };
    const stale = commitEntityTransfer(concurrentState, prepared.reservation);
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe("revision-conflict");
  });

  it("makes a repeated committed action idempotent", () => {
    const state = fixture();
    const first = executeEntityTransfer(state, depositRequest(state));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const repeated = commitEntityTransfer(first.state, {
      ...depositRequest(state),
      status: "prepared",
    });
    expect(repeated.ok).toBe(true);
    if (!repeated.ok) return;
    expect(repeated.idempotent).toBe(true);
    expect(repeated.state.revision).toBe(first.state.revision);
  });
});
