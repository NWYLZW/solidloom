import { validateModelAssetDefinition } from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
  createWarehouseCartDefinition,
  createWarehousePalletDefinition,
  createWarehouseRackDefinition,
  createWarehouseToteDefinition,
  defaultWarehouseRackParameters,
  warehouseAssetDefinitions,
  warehouseAssetModules,
  warehouseGroupIds,
} from "./index.js";

describe("warehouse and internal logistics asset kit", () => {
  it("publishes four independent planned assets that satisfy the shared contract", () => {
    expect(warehouseAssetDefinitions.map(({ manifest }) => manifest.id)).toEqual([
      "cyber-factory-warehouse-rack",
      "cyber-factory-warehouse-pallet",
      "cyber-factory-warehouse-tote",
      "cyber-factory-warehouse-cart",
    ]);
    expect(warehouseAssetDefinitions.map(validateModelAssetDefinition)).toEqual(
      Array.from({ length: 4 }, () => ({ valid: true, issues: [] })),
    );
    expect(warehouseAssetModules.every(({ status }) => status === "planned")).toBe(true);
  });

  it("generates deterministic rack shelf and slot ids from bay and level parameters", () => {
    const compact = createWarehouseRackDefinition({ bayCount: 2, levelCount: 3 });
    const expanded = createWarehouseRackDefinition({ bayCount: 4, levelCount: 5 });
    const compactFeatures = compact.createModel().featureGraph!.features.map(({ id }) => id);
    const expandedFeatures = expanded.createModel().featureGraph!.features.map(({ id }) => id);
    const compactSlots = compact.manifest.anchors.filter(({ id }) => id.startsWith("warehouse-rack-slot-"));
    const expandedSlots = expanded.manifest.anchors.filter(({ id }) => id.startsWith("warehouse-rack-slot-"));

    expect(compactFeatures.filter((id) => id.includes("rack-shelf-"))).toHaveLength(6);
    expect(expandedFeatures.filter((id) => id.includes("rack-shelf-"))).toHaveLength(20);
    expect(compactSlots).toHaveLength(6);
    expect(expandedSlots).toHaveLength(20);
    expect(compactSlots.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "warehouse-rack-slot-b01-l01",
      "warehouse-rack-slot-b02-l03",
    ]));
    expect(expandedSlots.map(({ id }) => id)).toEqual(expect.arrayContaining(compactSlots.map(({ id }) => id)));
  });

  it("exposes a socket, front pick point and rear restock point for every rack slot", () => {
    const definition = createWarehouseRackDefinition();
    const expectedSlots = defaultWarehouseRackParameters.bayCount * defaultWarehouseRackParameters.levelCount;
    const sockets = definition.manifest.anchors.filter(({ id }) => id.startsWith("warehouse-rack-slot-"));
    const picks = definition.manifest.anchors.filter(({ id }) => id.startsWith("warehouse-rack-pick-"));
    const restocks = definition.manifest.anchors.filter(({ id }) => id.startsWith("warehouse-rack-restock-"));

    expect(sockets).toHaveLength(expectedSlots);
    expect(picks).toHaveLength(expectedSlots);
    expect(restocks).toHaveLength(expectedSlots);
    expect(picks.every(({ position }) => position[2] > defaultWarehouseRackParameters.depth / 2)).toBe(true);
    expect(restocks.every(({ position }) => position[2] < -defaultWarehouseRackParameters.depth / 2)).toBe(true);
    expect(definition.manifest.colliders.every(({ groupId }) => groupId !== warehouseGroupIds.rackStorage)).toBe(true);
  });

  it("keeps pallet fork access, tote content storage and cart transport semantics distinct", () => {
    const pallet = createWarehousePalletDefinition({ width: 1_200, depth: 1_000 });
    const tote = createWarehouseToteDefinition({ width: 700, height: 440 });
    const cart = createWarehouseCartDefinition({ width: 1_000, handleHeight: 1_250 });

    expect(pallet.manifest.anchors.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "warehouse-pallet-load-socket",
      "warehouse-pallet-fork-entry-front",
      "warehouse-pallet-fork-entry-rear",
    ]));
    expect(tote.manifest.anchors.find(({ id }) => id === "warehouse-tote-content-socket")?.kind).toBe("socket");
    expect(cart.manifest.anchors.find(({ id }) => id === "warehouse-cart-push-handle")).toMatchObject({
      featureId: "warehouse-cart-handle-bar",
      tags: ["warehouse", "push", "transport"],
    });
  });

  it("uses a zero ground baseline without sealing the tote interior", () => {
    for (const definition of warehouseAssetDefinitions) {
      expect(definition.manifest.placement.groundY).toBe(0);
    }
    const toteGraph = createWarehouseToteDefinition().createModel().featureGraph!;
    const toteBase = toteGraph.features.find(({ id }) => id === "warehouse-tote-base");
    expect(toteBase?.type).toBe("box");
    if (toteBase?.type === "box") {
      expect(toteBase.position[1] - toteBase.parameters.height / 2).toBe(0);
    }
    expect(toteGraph.features.some(({ id }) => id.includes("lid"))).toBe(false);
  });

  it("reduces feature and triangle budgets for mobile previews", () => {
    for (const definition of warehouseAssetDefinitions) {
      const desktop = definition.manifest.lod.find(({ device }) => device === "desktop")!.levels[0]!;
      const mobile = definition.manifest.lod.find(({ device }) => device === "mobile")!.levels[0]!;
      expect(mobile.featureIds!.length).toBeLessThanOrEqual(desktop.featureIds!.length);
      expect(mobile.triangleBudget!).toBeLessThan(desktop.triangleBudget!);
    }
  });

  it("keeps every feature, group, anchor and collider id stable and unique per asset", () => {
    for (const definition of warehouseAssetDefinitions) {
      const graph = definition.createModel().featureGraph!;
      const ids = [
        ...graph.features.map(({ id }) => id),
        ...(graph.groups ?? []).map(({ id }) => id),
        ...definition.manifest.anchors.map(({ id }) => id),
        ...definition.manifest.colliders.map(({ id }) => id),
      ];
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id))).toBe(true);
    }
  });

  it("keeps every numeric default value on its declared control step", () => {
    for (const definition of warehouseAssetDefinitions) {
      for (const parameter of definition.manifest.parameters) {
        if (parameter.type !== "number" || parameter.minimum === undefined || parameter.step === undefined) continue;
        expect((Number(parameter.defaultValue) - parameter.minimum) % parameter.step).toBe(0);
      }
    }
  });
});
