import { describe, expect, it } from "vitest";
import {
  attemptSnackCabinetHack,
  createSnackCabinetOperationsState,
  depositSnackCabinetEntity,
  exchangeSnackCabinetEntities,
  hasSnackCabinetManagementAccess,
  snackCabinetOperationIds,
  withdrawSnackCabinetEntity,
} from "./operations.js";

const keyProof = [snackCabinetOperationIds.maintenanceKey];

describe("snack cabinet entity operations", () => {
  it("deposits an externally owned entity when the actor presents the maintenance key", () => {
    const state = createSnackCabinetOperationsState();
    const result = depositSnackCabinetEntity(state, {
      actionId: "deposit-seaweed",
      entityId: "external-seaweed",
      credentialEntityIds: keyProof,
      now: 1_000,
    });

    expect(result.transaction.ok).toBe(true);
    expect(result.state.world.entities["external-seaweed"]).toMatchObject({
      ownerId: snackCabinetOperationIds.machine,
      containerId: snackCabinetOperationIds.machineContainer,
    });
  });

  it("rejects inventory management without a key or temporary access grant", () => {
    const state = createSnackCabinetOperationsState();
    const result = withdrawSnackCabinetEntity(state, {
      actionId: "steal-oat",
      entityId: "machine-oat",
      now: 1_000,
    });

    expect(result.transaction.ok).toBe(false);
    if (result.transaction.ok) return;
    expect(result.transaction.error.code).toBe("access-denied");
    expect(result.state).toBe(state);
  });

  it("exchanges external and machine entities as one ownership transaction", () => {
    const state = createSnackCabinetOperationsState({ machineCapacity: 3 });
    const result = exchangeSnackCabinetEntities(state, {
      actionId: "exchange-coffee-oat",
      externalEntityId: "external-coffee",
      machineEntityId: "machine-oat",
      credentialEntityIds: keyProof,
      now: 1_000,
    });

    expect(result.transaction.ok).toBe(true);
    expect(result.state.world.entities["external-coffee"]?.ownerId).toBe(snackCabinetOperationIds.machine);
    expect(result.state.world.entities["machine-oat"]?.ownerId).toBe(snackCabinetOperationIds.actor);
    expect(result.state.world.containers[snackCabinetOperationIds.machineContainer]?.entityIds).toEqual([
      "machine-nuts",
      "machine-water",
      "external-coffee",
    ]);
  });

  it("issues expiring management access after a successful hack", () => {
    const state = createSnackCabinetOperationsState();
    const hacked = attemptSnackCabinetHack(state, {
      actionId: "hack-success",
      skill: 6,
      roll: 3,
      now: 10_000,
    });

    expect(hacked.ok).toBe(true);
    if (!hacked.ok) return;
    expect(hasSnackCabinetManagementAccess(hacked.state, { now: 20_000 })).toBe(true);
    expect(hasSnackCabinetManagementAccess(hacked.state, { now: hacked.expiresAt })).toBe(false);

    const result = withdrawSnackCabinetEntity(hacked.state, {
      actionId: "withdraw-with-grant",
      entityId: "machine-oat",
      now: 20_000,
    });
    expect(result.transaction.ok).toBe(true);
  });

  it("keeps ownership unchanged and starts a cooldown after a failed hack", () => {
    const state = createSnackCabinetOperationsState();
    const failed = attemptSnackCabinetHack(state, {
      actionId: "hack-failure",
      skill: 2,
      roll: 1,
      now: 4_000,
    });

    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.reason).toBe("failed");
    expect(failed.state.world).toEqual(state.world);

    const duringCooldown = attemptSnackCabinetHack(failed.state, {
      actionId: "hack-too-soon",
      skill: 10,
      roll: 10,
      now: failed.retryAt - 1,
    });
    expect(duringCooldown.ok).toBe(false);
    if (duringCooldown.ok) return;
    expect(duringCooldown.reason).toBe("cooldown");
  });
});
