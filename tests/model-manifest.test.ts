import {
  assertModelAssetDefinition,
  type ModelAssetDefinition,
  validateModelAssetDefinition,
} from "@solidloom/shared";
import { describe, expect, it } from "vitest";

function definition(): ModelAssetDefinition {
  return {
    manifest: {
      schemaVersion: 1,
      id: "test-desk",
      displayName: "测试桌",
      description: "用于验证独立模型资产契约。",
      version: "1.0.0",
      kind: "asset",
      modelUnit: "mm",
      parameters: [
        { id: "width", label: "宽度", type: "number", defaultValue: 1200, unit: "mm", minimum: 600, maximum: 2400 },
      ],
      materials: [
        { id: "desktop", label: "桌面", material: "wood", color: "#6B4528", featureIds: ["desktop"] },
      ],
      placement: { upAxis: "y", groundY: 0, origin: [0, 0, 0], defaultScale: [1, 1, 1] },
      colliders: [
        { id: "body", label: "桌体", shape: "box", position: [0, 375, 0], rotation: [0, 0, 0], size: [1200, 750, 600], groupId: "desk" },
      ],
      anchors: [
        { id: "work-position", label: "工作位", kind: "interaction", position: [0, 0, 420], rotation: [0, 180, 0], range: 900, featureId: "desktop" },
      ],
      joints: [],
      lod: [
        { device: "desktop", levels: [{ id: "full", maximumDistance: 5000, featureIds: ["desktop"], triangleBudget: 2000 }] },
        { device: "mobile", levels: [{ id: "mobile", maximumDistance: 3000, featureIds: ["desktop"], triangleBudget: 800 }] },
      ],
      previews: [
        { device: "desktop", cameraPosition: [1500, 1000, 1500], cameraTarget: [0, 350, 0], background: "dark" },
        { device: "mobile", cameraPosition: [1800, 1200, 1800], cameraTarget: [0, 350, 0], background: "light" },
      ],
    },
    createModel: () => ({
      name: "测试桌",
      unit: "mm",
      featureGraph: {
        version: 1,
        features: [{
          id: "desktop",
          name: "桌面",
          type: "box",
          operation: "add",
          position: [0, 725, 0],
          rotation: [0, 0, 0],
          parameters: { width: 1200, height: 50, depth: 600 },
        }],
        groups: [{ id: "desk", name: "桌体", featureIds: ["desktop"], position: [0, 0, 0], rotation: [0, 0, 0] }],
      },
    }),
  };
}

describe("model asset manifest", () => {
  it("accepts a self-contained desktop and mobile asset", () => {
    const asset = definition();
    expect(validateModelAssetDefinition(asset)).toEqual({ valid: true, issues: [] });
    expect(assertModelAssetDefinition(asset)).toBe(asset);
  });

  it("reports duplicate IDs without throwing away the other diagnostics", () => {
    const asset = definition();
    asset.manifest.anchors.push({ ...asset.manifest.anchors[0]! });
    asset.manifest.materials[0]!.color = "wood";

    const result = validateModelAssetDefinition(asset);
    expect(result.valid).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining(["duplicate-id", "invalid-color"]));
  });

  it("rejects anchors and colliders that reference missing graph targets", () => {
    const asset = definition();
    asset.manifest.anchors[0]!.featureId = "missing-feature";
    asset.manifest.colliders[0]!.groupId = "missing-group";

    const result = validateModelAssetDefinition(asset);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing-feature", path: "manifest.anchors[0].featureId" }),
      expect.objectContaining({ code: "missing-group", path: "manifest.colliders[0].groupId" }),
    ]));
  });

  it("rejects invalid placement, LOD ordering and selection defaults", () => {
    const asset = definition();
    asset.manifest.placement.defaultScale = [1, 0, 1];
    asset.manifest.parameters.push({ id: "finish", label: "饰面", type: "select", defaultValue: "glass", options: ["wood"] });
    asset.manifest.lod[0]!.levels.push({ id: "near", maximumDistance: 1000 });

    const result = validateModelAssetDefinition(asset);
    expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "invalid-placement",
      "invalid-parameter",
      "invalid-lod",
    ]));
  });
});
