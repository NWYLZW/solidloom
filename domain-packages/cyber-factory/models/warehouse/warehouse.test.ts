import { validateModelAssetDefinition } from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
  createWarehouseCartDefinition,
  createWarehousePalletDefinition,
  createWarehouseRackAutomationBinding,
  createWarehouseRackDefinition,
  createWarehouseStackerCrane,
  createWarehouseStackerCraneDefinition,
  createWarehouseToteDefinition,
  defaultWarehousePalletParameters,
  defaultWarehouseRackParameters,
  defaultWarehouseStackerCraneParameters,
  planWarehouseRestock,
  planWarehouseRetrieval,
  warehouseAssetDefinitions,
  warehouseAssetModules,
  warehouseGroupIds,
  warehouseRackBayX,
  warehouseRackShelfY,
  warehouseStackerMaximumTravel,
  warehouseStackerRackAssemblyZ,
} from "./index.js";

describe("warehouse and internal logistics asset kit", () => {
  it("publishes four available warehouse assets and keeps the standalone stacker internal", () => {
    expect(warehouseAssetDefinitions.map(({ manifest }) => manifest.id)).toEqual([
      "cyber-factory-warehouse-rack",
      "cyber-factory-warehouse-pallet",
      "cyber-factory-warehouse-tote",
      "cyber-factory-warehouse-cart",
      "cyber-factory-warehouse-stacker-crane",
    ]);
    expect(warehouseAssetDefinitions.map(validateModelAssetDefinition)).toEqual(
      Array.from({ length: 5 }, () => ({ valid: true, issues: [] })),
    );
    expect(warehouseAssetModules.map(({ status }) => status)).toEqual([
      "available",
      "available",
      "available",
      "available",
      "planned",
    ]);
  });

  it("generates deterministic rack shelf and slot ids from bay and level parameters", () => {
    const compact = createWarehouseRackDefinition({ bayCount: 2, levelCount: 3 });
    const expanded = createWarehouseRackDefinition({ bayCount: 12, levelCount: 8 });
    const compactFeatures = compact.createModel().featureGraph!.features.map(({ id }) => id);
    const expandedFeatures = expanded.createModel().featureGraph!.features.map(({ id }) => id);
    const compactSlots = compact.manifest.anchors.filter(({ id }) => id.startsWith("warehouse-rack-slot-"));
    const expandedSlots = expanded.manifest.anchors.filter(({ id }) => id.startsWith("warehouse-rack-slot-"));

    expect(compactFeatures.filter((id) => id.includes("rack-shelf-"))).toHaveLength(6);
    expect(expandedFeatures.filter((id) => id.includes("rack-shelf-"))).toHaveLength(96);
    expect(compactSlots).toHaveLength(6);
    expect(expandedSlots).toHaveLength(96);
    expect(compactSlots.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "warehouse-rack-slot-b01-l01",
      "warehouse-rack-slot-b02-l03",
    ]));
    expect(expandedSlots.map(({ id }) => id)).toEqual(expect.arrayContaining(compactSlots.map(({ id }) => id)));
    expect(expanded.manifest.parameters.find(({ id }) => id === "bay-count")?.maximum).toBeUndefined();
    expect(expanded.manifest.parameters.find(({ id }) => id === "level-count")?.maximum).toBeUndefined();
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

  it("binds the optional stacker crane to rack-derived slots, axes and control anchors", () => {
    const definition = createWarehouseRackDefinition({ bayCount: 4, levelCount: 5 });
    const graph = definition.createModel().featureGraph!;
    const binding = createWarehouseRackAutomationBinding({ bayCount: 4, levelCount: 5 });

    expect(graph.features.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "warehouse-rack-shelf-b04-l05",
      "warehouse-stacker-left-rail",
      "warehouse-stacker-single-mast",
      "warehouse-stacker-left-fork",
    ]));
    expect(definition.manifest.parameters.find(({ id }) => id === "stacker-crane")).toMatchObject({
      label: "绑定堆垛机",
      defaultValue: true,
    });
    expect(definition.manifest.anchors.find(({ id }) => id === "warehouse-rack-automation-slot")?.position)
      .toEqual(binding.stackerOffset);
    expect(binding.crane.railLength).toBe(4 * defaultWarehouseRackParameters.bayWidth + 500);
    expect(binding.slots).toHaveLength(20);
    expect(binding.stackerOffset[2]).toBeGreaterThan(defaultWarehouseRackParameters.depth / 2);
    expect(binding.forkAxis).toEqual([0, 0, -1]);
    expect(binding.slots.find(({ id }) => id === "warehouse-rack-slot-b04-l05")).toMatchObject({
      bayIndex: 3,
      levelIndex: 4,
      bayX: warehouseRackBayX({ ...defaultWarehouseRackParameters, bayCount: 4, levelCount: 5 }, 3),
      shelfY: warehouseRackShelfY({ ...defaultWarehouseRackParameters, bayCount: 4, levelCount: 5 }, 4),
    });
    expect(binding.stackerOffset[2]).toBeGreaterThan(defaultWarehouseRackParameters.depth / 2);
  });

  it("can generate the same rack without its bound automation option", () => {
    const definition = createWarehouseRackDefinition({}, { stackerCrane: false });
    const featureIds = definition.createModel().featureGraph!.features.map(({ id }) => id);

    expect(featureIds.some((id) => id.startsWith("warehouse-stacker-"))).toBe(false);
    expect(definition.manifest.anchors.some(({ id }) => id === "warehouse-rack-automation-slot")).toBe(false);
    expect(definition.manifest.parameters.find(({ id }) => id === "stacker-crane")?.defaultValue).toBe(false);
  });

  it("keeps the pick face open and aligns every steel beam with its shelf top", () => {
    const graph = createWarehouseRackDefinition().createModel().featureGraph!;
    expect(graph.features.some(({ id }) => id.includes("top-beam"))).toBe(false);
    expect(graph.features.filter(({ id }) => id.includes("level-beam"))).toHaveLength(
      defaultWarehouseRackParameters.levelCount * 2,
    );
    for (let level = 0; level < defaultWarehouseRackParameters.levelCount; level += 1) {
      const suffix = String(level + 1).padStart(2, "0");
      const shelf = graph.features.find(({ id }) => id === `warehouse-rack-shelf-b01-l${suffix}`);
      const frontBeam = graph.features.find(({ id }) => id === `warehouse-rack-level-beam-front-l${suffix}`);
      expect(shelf?.type).toBe("box");
      expect(frontBeam?.type).toBe("box");
      if (shelf?.type !== "box" || frontBeam?.type !== "box") continue;
      expect(frontBeam.position[1] + frontBeam.parameters.height / 2).toBe(
        shelf.position[1] + shelf.parameters.height / 2,
      );
    }
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

  it("builds an independent stacker crane with stable motion groups and runtime anchors", () => {
    const definition = createWarehouseStackerCraneDefinition({ railLength: 18_000, mastHeight: 5_200 });
    const graph = definition.createModel().featureGraph!;

    expect(graph.groups?.map(({ id }) => id)).toEqual(expect.arrayContaining([
      warehouseGroupIds.stackerRails,
      warehouseGroupIds.stackerTravelFrame,
      warehouseGroupIds.stackerCarriage,
      warehouseGroupIds.stackerForks,
    ]));
    expect(graph.features.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "warehouse-stacker-travel-base",
      "warehouse-stacker-carriage-deck",
      "warehouse-stacker-left-fork",
      "warehouse-stacker-right-fork",
    ]));
    expect(definition.manifest.anchors.map(({ id }) => id)).toEqual(expect.arrayContaining([
      "warehouse-stacker-fork-load-socket",
      "warehouse-stacker-control-panel",
      "warehouse-stacker-outbound-socket",
    ]));
    expect(definition.manifest.joints).toEqual([]);
    expect(definition.manifest.tags).not.toContain("planned");
    expect(definition.manifest.anchors.find(({ id }) => id === "warehouse-stacker-control-panel")?.tags)
      .toContain("runtime-control");
  });

  it("uses a compact single-mast default that still reaches every slot in the default rack", () => {
    expect(defaultWarehouseStackerCraneParameters).toEqual({
      railLength: 3_800,
      mastHeight: 2_600,
      carriageWidth: 1_160,
      carriageDepth: 900,
      forkReach: 1_000,
    });
    expect(defaultWarehouseStackerCraneParameters.carriageWidth - 108).toBeGreaterThan(
      defaultWarehousePalletParameters.width,
    );
    expect(defaultWarehouseStackerCraneParameters.carriageDepth).toBeGreaterThan(
      defaultWarehousePalletParameters.depth,
    );
    const graph = createWarehouseStackerCraneDefinition().createModel().featureGraph!;
    expect(graph.features.some(({ id }) => id === "warehouse-stacker-single-mast")).toBe(true);
    expect(graph.features.some(({ id }) => id === "warehouse-stacker-right-mast")).toBe(false);
    const outerTopPlan = planWarehouseRetrieval(
      "warehouse-rack-slot-b03-l04",
      defaultWarehouseRackParameters,
      defaultWarehouseStackerCraneParameters,
    );
    expect(outerTopPlan).toMatchObject({ valid: true });
    const rackZ = warehouseStackerRackAssemblyZ(
      defaultWarehouseRackParameters,
      defaultWarehouseStackerCraneParameters,
    );
    if (outerTopPlan.valid) {
      expect(outerTopPlan.targetPose.liftY).toBe(warehouseRackShelfY(defaultWarehouseRackParameters, 3) + 72);
      expect(outerTopPlan.targetPose.forkExtension).toBeCloseTo(951);
      expect(outerTopPlan.steps[0]?.pose.travelX).toBe(
        -warehouseStackerMaximumTravel(defaultWarehouseStackerCraneParameters),
      );
      const extend = outerTopPlan.steps.find(({ id }) => id === "extend")!;
      expect(extend.pose.liftY - 30).toBe(
        warehouseRackShelfY(defaultWarehouseRackParameters, 3) + 22,
      );
      expect(rackZ + outerTopPlan.targetPose.forkExtension).toBeCloseTo(
        -30,
      );
    }
    expect(rackZ + defaultWarehouseRackParameters.depth / 2).toBeCloseTo(
      -defaultWarehouseStackerCraneParameters.carriageDepth * 1.18 / 2,
    );
  });

  it("keeps retracted forks inside the carriage and extends only toward the rack", () => {
    const retracted = createWarehouseStackerCrane(defaultWarehouseStackerCraneParameters, { forkExtension: 0 });
    const extended = createWarehouseStackerCrane(defaultWarehouseStackerCraneParameters, { forkExtension: 600 });
    const retractedFork = retracted.featureGraph!.features.find(({ id }) => id === "warehouse-stacker-left-fork");
    const extendedFork = extended.featureGraph!.features.find(({ id }) => id === "warehouse-stacker-left-fork");
    expect(retractedFork?.type).toBe("box");
    expect(extendedFork?.type).toBe("box");
    if (retractedFork?.type !== "box" || extendedFork?.type !== "box") return;
    expect(retractedFork.parameters.depth).toBe(defaultWarehouseStackerCraneParameters.carriageDepth - 80);
    expect(retractedFork.position[2] + retractedFork.parameters.depth / 2).toBe(
      defaultWarehouseStackerCraneParameters.carriageDepth / 2 - 80,
    );
    expect(extendedFork.position[2] + extendedFork.parameters.depth / 2).toBe(
      defaultWarehouseStackerCraneParameters.carriageDepth / 2 - 80,
    );
    expect(extendedFork.position[2] - extendedFork.parameters.depth / 2).toBe(
      -defaultWarehouseStackerCraneParameters.carriageDepth / 2 - 600,
    );
    const crosshead = extended.featureGraph!.features.find(({ id }) => id === "warehouse-stacker-fork-crosshead");
    expect(crosshead?.position[2]).toBe(defaultWarehouseStackerCraneParameters.carriageDepth / 2 - 140);
  });

  it("turns a stable rack slot id into a deterministic planned retrieval sequence", () => {
    const rack = { ...defaultWarehouseRackParameters, bayCount: 12, levelCount: 8 };
    const plan = planWarehouseRetrieval(
      "warehouse-rack-slot-b03-l04",
      rack,
      { ...defaultWarehouseStackerCraneParameters, railLength: 14_000 },
    );
    expect(plan.valid).toBe(true);
    if (!plan.valid) return;

    expect(plan.targetPose.travelX).toBe(warehouseRackBayX(rack, 2));
    expect(plan.targetPose.liftY).toBe(warehouseRackShelfY(rack, 3) + 72);
    expect(plan.steps.map(({ id }) => id)).toEqual([
      "reserve",
      "travel",
      "lift",
      "extend",
      "capture",
      "retract",
      "lower",
      "deliver",
      "release",
    ]);
    expect(plan.steps.find(({ id }) => id === "capture")?.plannedActions).toEqual(["attach-cargo"]);
    expect(plan.steps.find(({ id }) => id === "release")?.plannedActions).toEqual(["detach-cargo", "release-slot"]);
    const maximumTravel = warehouseStackerMaximumTravel({
      ...defaultWarehouseStackerCraneParameters,
      railLength: 14_000,
    });
    expect(plan.steps.find(({ id }) => id === "deliver")?.pose.travelX).toBe(-maximumTravel);
    expect(plan.steps.find(({ id }) => id === "release")?.pose.travelX).toBe(-maximumTravel);
    expect(createWarehouseStackerCraneDefinition().manifest.anchors.find(
      ({ id }) => id === "warehouse-stacker-outbound-socket",
    )?.position).toEqual([
      -warehouseStackerMaximumTravel(defaultWarehouseStackerCraneParameters),
      290,
      -30,
    ]);
  });

  it("plans a deterministic restock sequence from the left carriage into a rack slot", () => {
    const plan = planWarehouseRestock(
      "warehouse-rack-slot-b02-l03",
      defaultWarehouseRackParameters,
      defaultWarehouseStackerCraneParameters,
    );
    expect(plan.valid).toBe(true);
    if (!plan.valid) return;

    expect(plan.steps.map(({ id }) => id)).toEqual([
      "reserve",
      "attach",
      "travel",
      "lift",
      "extend",
      "place",
      "release",
      "retract",
      "lower",
      "return",
    ]);
    expect(plan.steps[0]?.pose.travelX).toBe(
      -warehouseStackerMaximumTravel(defaultWarehouseStackerCraneParameters),
    );
    expect(plan.steps.find(({ id }) => id === "attach")?.plannedActions).toEqual(["attach-cargo"]);
    expect(plan.steps.find(({ id }) => id === "release")?.plannedActions).toEqual([
      "detach-cargo",
      "occupy-slot",
    ]);
    expect(plan.steps.find(({ id }) => id === "place")?.pose.liftY).toBe(
      warehouseRackShelfY(defaultWarehouseRackParameters, 2) + 52,
    );
    expect(plan.steps.at(-1)?.pose).toEqual(plan.steps[0]?.pose);
  });

  it("uses one cart deck with grounded wheels connected by four supports", () => {
    const features = createWarehouseCartDefinition().createModel().featureGraph!.features;
    const wheels = features.filter(({ id }) => id.startsWith("warehouse-cart-wheel-"));
    const supports = features.filter(({ id }) => id.startsWith("warehouse-cart-support-"));
    const mainDeck = features.find(({ id }) => id === "warehouse-cart-main-deck");

    expect(features.filter(({ id }) => id.includes("-deck")).map(({ id }) => id)).toEqual([
      "warehouse-cart-main-deck",
    ]);
    expect(wheels).toHaveLength(4);
    for (const wheel of wheels) {
      expect(wheel.type).toBe("cylinder");
      if (wheel.type === "cylinder") expect(wheel.position[1] - wheel.parameters.radius).toBe(0);
    }
    expect(supports).toHaveLength(4);
    expect(mainDeck?.type).toBe("box");
    if (mainDeck?.type !== "box") return;
    for (const support of supports) {
      expect(support.type).toBe("box");
      if (support.type !== "box") continue;
      const wheel = wheels.find(({ id }) => id === support.id.replace("-support-", "-wheel-"));
      expect(wheel?.type).toBe("cylinder");
      if (wheel?.type !== "cylinder") continue;
      expect(support.position[1] - support.parameters.height / 2).toBe(
        wheel.position[1] + wheel.parameters.radius,
      );
      expect(support.position[1] + support.parameters.height / 2).toBe(
        mainDeck.position[1] - mainDeck.parameters.height / 2,
      );
      expect([support.position[0], support.position[2]]).toEqual([
        wheel.position[0],
        wheel.position[2],
      ]);
    }
  });

  it("rejects malformed, missing and unreachable stacker targets without inventing availability", () => {
    expect(planWarehouseRetrieval("b03-l04")).toMatchObject({ valid: false, code: "invalid-slot-id" });
    expect(planWarehouseRestock("b03-l04")).toMatchObject({ valid: false, code: "invalid-slot-id" });
    expect(planWarehouseRetrieval("warehouse-rack-slot-b99-l04")).toMatchObject({ valid: false, code: "slot-out-of-range" });
    expect(planWarehouseRetrieval(
      "warehouse-rack-slot-b08-l02",
      { bayCount: 8 },
      { railLength: 6_000 },
    )).toMatchObject({ valid: false, code: "insufficient-rail-travel" });
    expect(planWarehouseRetrieval(
      "warehouse-rack-slot-b01-l01",
      { depth: 1_200 },
      { forkReach: 400 },
    )).toMatchObject({ valid: false, code: "insufficient-fork-reach" });
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
