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
  warehouseStackerCraneId: "warehouse-stacker-crane",
  warehouseToteId: "warehouse-tote",
};

describe("createInteractionPlaygroundModel", () => {
  it("沿主通道按固定顺序线性陈列交互站点", () => {
    const model = createInteractionPlaygroundModel(ids);
    const references = model.featureGraph?.references ?? [];
    const referenceById = new Map(references.map((reference) => [reference.id, reference]));
    const stationIds = [
      "interaction-playground-coffee-machine",
      "interaction-playground-water-dispenser",
      "interaction-playground-container",
      "interaction-playground-desk",
      "interaction-playground-lounge",
      "interaction-playground-warehouse-rack",
      "interaction-playground-warehouse-stacker-crane",
      "interaction-playground-warehouse-cart",
    ];
    const stationXs = stationIds.map((id) => referenceById.get(id)?.position[0]);

    expect(stationXs).toEqual([...stationXs].sort((left, right) => Number(left) - Number(right)));
    expect(referenceById.get("interaction-playground-room")?.scale).toEqual([2.65, 1, 1.2]);
    expect(model.featureGraph?.navigation).toMatchObject({
      bounds: [-11_900, 11_900, -3_300, 3_300],
      start: [-11_250, 900],
    });
  });

  it("按真实比例展示大型资产，并把小型设备放在真实台面高度", () => {
    const model = createInteractionPlaygroundModel(ids);
    const referenceById = new Map((model.featureGraph?.references ?? []).map((reference) => [reference.id, reference]));

    expect(referenceById.get("interaction-playground-coffee-counter")?.modelId).toBe("desk");
    expect(referenceById.get("interaction-playground-coffee-counter")?.scale).toBeUndefined();
    expect(referenceById.get("interaction-playground-coffee-machine")?.position[1]).toBe(760);
    for (const id of [
      "interaction-playground-lounge",
      "interaction-playground-desk",
      "interaction-playground-warehouse-rack",
      "interaction-playground-warehouse-stacker-crane",
      "interaction-playground-warehouse-pallet",
      "interaction-playground-warehouse-tote",
      "interaction-playground-warehouse-cart",
    ]) {
      expect(referenceById.get(id)?.scale).toEqual([1, 1, 1]);
    }
  });

  it("把仓储物流资产接入同一个可运行交互场景", () => {
    const model = createInteractionPlaygroundModel(ids);
    const references = model.featureGraph?.references ?? [];

    expect(references.map((reference) => reference.modelId)).toEqual(expect.arrayContaining([
      "warehouse-rack",
      "warehouse-stacker-crane",
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
    expect(references.find((reference) => reference.modelId === "warehouse-stacker-crane")).toMatchObject({
      name: "自动取货机",
      position: [3_600, 0, 240],
      scale: [1, 1, 1],
    });
    const interaction = references.find((reference) => reference.modelId === "warehouse-stacker-crane")
      ?.interactions?.[0];
    expect(interaction).toMatchObject({
      kind: "device",
      label: "自动取货机",
      operationExecuteLabel: "开始取货",
      operationGroups: [{
        id: "slot",
        options: expect.arrayContaining([
          expect.objectContaining({ id: "component-a", label: "标准组件 A", description: "第 1 列 · 第 1 层" }),
          expect.objectContaining({ id: "component-b", label: "标准组件 B", description: "第 2 列 · 第 2 层" }),
          expect.objectContaining({ id: "maintenance-kit", label: "维护套件", description: "第 3 列 · 第 3 层" }),
        ]),
      }],
    });
    expect(interaction?.operationGroups?.[0]?.options.every((option) => (
      option.program?.steps.length === 9 && option.program.collect?.label === "领取货物"
    ))).toBe(true);
    const firstProgram = interaction?.operationGroups?.[0]?.options[0]?.program;
    const extendedForkMotion = firstProgram?.steps.find(({ id }) => id === "extend")?.motions
      .find(({ targetFeatureIds }) => targetFeatureIds?.includes("warehouse-stacker-left-fork"));
    const retractedCargoMotion = firstProgram?.steps.find(({ id }) => id === "retract")?.motions
      .find(({ targetReferenceId }) => targetReferenceId === "interaction-playground-warehouse-cargo-a");
    expect(extendedForkMotion?.positionOffset?.[2]).toBeLessThan(0);
    expect(retractedCargoMotion?.positionOffset?.[2]).toBeGreaterThan(0);
    expect(references.filter((reference) => reference.id.startsWith("interaction-playground-warehouse-cargo-")))
      .toHaveLength(3);
  });
});
