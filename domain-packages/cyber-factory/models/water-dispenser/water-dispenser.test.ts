import {
  applyFeatureGraphExpressions,
  validateModelAssetDefinition,
} from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
  createWaterDispenserAssetDefinition,
  createWaterDispenserModel,
  defaultWaterDispenserParameters,
  waterDispenserAssetDefinition,
  waterDispenserCoreFeatureIds,
} from "./index.js";

describe("parameterized water dispenser asset", () => {
  it("passes the shared model asset contract", () => {
    expect(validateModelAssetDefinition(waterDispenserAssetDefinition)).toEqual({
      valid: true,
      issues: [],
    });
    expect(waterDispenserAssetDefinition.manifest.id).toBe("water-dispenser");
    expect(waterDispenserAssetDefinition.manifest.modelUnit).toBe("mm");
  });

  it("keeps stable feature and anchor ids across parameter variants", () => {
    const baseline = createWaterDispenserAssetDefinition();
    const wider = createWaterDispenserAssetDefinition({ width: 420, tankRadius: 150 });
    const baselineGraph = baseline.createModel().featureGraph!;
    const widerGraph = wider.createModel().featureGraph!;

    expect(widerGraph.features.map(({ id }) => id)).toEqual(baselineGraph.features.map(({ id }) => id));
    expect(wider.manifest.anchors.map(({ id }) => id)).toEqual(baseline.manifest.anchors.map(({ id }) => id));
    expect(wider.manifest.colliders.map(({ id }) => id)).toEqual(baseline.manifest.colliders.map(({ id }) => id));
  });

  it("applies parameters to geometry, collision and anchor placement", () => {
    const definition = createWaterDispenserAssetDefinition({
      width: 420,
      depth: 440,
      bodyHeight: 1_120,
      tankRadius: 160,
      tankHeight: 480,
      nozzleSpacing: 140,
    });
    const graph = definition.createModel().featureGraph!;
    const shell = graph.features.find(({ id }) => id === "body-shell");
    const tank = graph.features.find(({ id }) => id === "water-tank");
    const bodyCollider = definition.manifest.colliders.find(({ id }) => id === "body-collider");
    const tankCollider = definition.manifest.colliders.find(({ id }) => id === "tank-collider");

    expect(shell).toMatchObject({ type: "box", parameters: { width: 420, height: 1_120, depth: 440 }, position: [0, 560, 0] });
    expect(tank).toMatchObject({ type: "cylinder", parameters: { radius: 160, height: 480 } });
    expect(bodyCollider).toMatchObject({ shape: "box", size: [420, 1_120, 440] });
    expect(tankCollider).toMatchObject({ shape: "cylinder", radius: 160, height: 480, position: [0, 1_416, 0] });
    expect(definition.manifest.anchors.find(({ id }) => id === "hot-water-button")?.position[0]).toBe(-70);
    expect(definition.manifest.placement.groundY).toBe(0);
  });

  it("places the fill target and actor approach in front of the body", () => {
    const { manifest } = waterDispenserAssetDefinition;
    const bodyFront = defaultWaterDispenserParameters.depth / 2;
    const target = manifest.anchors.find(({ id }) => id === "water-fill-target")!;
    const approach = manifest.anchors.find(({ id }) => id === "water-fill-approach")!;

    expect(target.kind).toBe("interaction");
    expect(target.position[2]).toBeGreaterThan(bodyFront);
    expect(target.range).toBe(900);
    expect(approach.kind).toBe("approach");
    expect(approach.position[1]).toBe(0);
    expect(approach.position[2]).toBeGreaterThan(target.position[2]);
    expect(approach.rotation).toEqual([0, 180, 0]);
  });

  it("declares a lower-complexity mobile LOD without losing semantic parts", () => {
    const desktop = waterDispenserAssetDefinition.manifest.lod.find(({ device }) => device === "desktop")!;
    const mobile = waterDispenserAssetDefinition.manifest.lod.find(({ device }) => device === "mobile")!;
    const desktopFull = desktop.levels[0]!;
    const mobileLevel = mobile.levels[0]!;

    expect(mobileLevel.featureIds).toEqual([...waterDispenserCoreFeatureIds]);
    expect(mobileLevel.featureIds).toEqual(expect.arrayContaining([
      "body-shell",
      "hot-button",
      "cold-button",
      "hot-nozzle",
      "cold-nozzle",
      "water-tank",
    ]));
    expect(mobileLevel.featureIds!.length).toBeLessThan(desktopFull.featureIds!.length);
    expect(mobileLevel.triangleBudget).toBeLessThan(desktopFull.triangleBudget!);
  });

  it("regenerates parameterized geometry from feature graph variables", () => {
    const model = createWaterDispenserModel();
    const graph = model.featureGraph!;
    graph.variables!.find(({ id }) => id === "--width")!.value = 420;
    graph.variables!.find(({ id }) => id === "--body-height")!.value = 1_120;
    const result = applyFeatureGraphExpressions(graph);
    const shell = result.featureGraph.features.find(({ id }) => id === "body-shell");

    expect(result.issues).toEqual([]);
    expect(shell).toMatchObject({
      type: "box",
      position: [0, 560, 0],
      parameters: { width: 420, height: 1_120 },
    });
  });

  it("rejects physically invalid parameter combinations", () => {
    expect(() => createWaterDispenserAssetDefinition({ width: 299 })).toThrow(/width/);
    expect(() => createWaterDispenserAssetDefinition({ tankRadius: 180, width: 340 })).toThrow(/clearance/);
    expect(() => createWaterDispenserAssetDefinition({ nozzleSpacing: 151 })).toThrow(/nozzleSpacing/);
    expect(() => createWaterDispenserAssetDefinition({ depth: Number.NaN })).toThrow(/depth/);
  });
});
