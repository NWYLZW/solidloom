import { describe, expect, it } from "vitest";
import { createInteractionPlaygroundModel } from "./createInteractionPlaygroundModel.js";

const ids = {
  chairId: "chair",
  coffeeMachineId: "coffee-machine",
  deskId: "desk",
  loungeId: "lounge",
  monitorId: "monitor",
  roomId: "room",
  snackCabinetId: "snack-cabinet",
  waterDispenserId: "water-dispenser",
  warehouseCartId: "warehouse-cart",
  warehousePalletId: "warehouse-pallet",
  warehouseRackId: "warehouse-rack",
  warehouseToteId: "warehouse-tote",
};

describe("createInteractionPlaygroundModel", () => {
  it("把仓储物流资产接入同一个可运行交互场景", () => {
    const model = createInteractionPlaygroundModel(ids);
    const references = model.featureGraph?.references ?? [];

    expect(references.map((reference) => reference.modelId)).toEqual(expect.arrayContaining([
      "warehouse-rack",
      "warehouse-pallet",
      "warehouse-tote",
      "warehouse-cart",
    ]));
    expect(references.find((reference) => reference.modelId === "warehouse-rack")?.interactions?.[0]).toMatchObject({
      kind: "container",
      label: "仓储货架",
      containerCanConfigure: true,
    });
    expect(references.find((reference) => reference.modelId === "warehouse-cart")?.physics).toMatchObject({
      bodyType: "dynamic",
      mass: 28,
    });
  });
});
