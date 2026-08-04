import { describe, expect, it } from "vitest";
import { uniformBoxCornerRadii, type BoxFeature, type CylinderFeature } from "@solidloom/shared";
import { createFeatureGeometry, evaluateBoolean, evaluatePlaneCut, featureGeometryCacheKey, featureTriangleCount, featureVolume } from "../apps/web/src/meshOperations";

const firstBox: BoxFeature = {
  id: "box-a",
  name: "A",
  type: "box",
  operation: "add",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  parameters: { width: 20, depth: 20, height: 20 },
};

const secondBox: BoxFeature = {
  ...firstBox,
  id: "box-b",
  name: "B",
  position: [8, 0, 0],
};

describe("mesh operations", () => {
  it("reuses primitive geometry signatures and keeps cylinders at viewport-friendly density", () => {
    const cylinder: CylinderFeature = {
      id: "leg-a",
      name: "桌腿",
      type: "cylinder",
      operation: "add",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      parameters: { radius: 20, height: 720 },
    };
    expect(featureGeometryCacheKey(cylinder)).toBe(featureGeometryCacheKey({
      ...cylinder,
      id: "leg-b",
      position: [500, 0, 0],
    }));
    expect(featureGeometryCacheKey({
      ...cylinder,
      parameters: { ...cylinder.parameters, radius: 24 },
    })).not.toBe(featureGeometryCacheKey(cylinder));
    expect(featureTriangleCount(cylinder)).toBe(128);
  });

  it("serializes boolean results as persistent mesh features", () => {
    const result = evaluateBoolean([firstBox, secondBox], [], "union", "并集结果");
    expect(result.type).toBe("mesh");
    expect(result.parameters.positions.length).toBeGreaterThan(0);
    expect(result.parameters.indices.length % 3).toBe(0);
    expect(result.scale).toEqual([1, 1, 1]);
  });

  it("cuts a source solid with a persisted plane result", () => {
    const result = evaluatePlaneCut([firstBox], [], [0, 0, 0], 0, true, "切割结果");
    expect(result.type).toBe("mesh");
    expect(result.parameters.positions.length).toBeGreaterThan(0);
    expect(result.parameters.indices.length % 3).toBe(0);
  });

  it("builds rounded boxes with configurable curve density", () => {
    const circular: BoxFeature = {
      ...firstBox,
      parameters: { ...firstBox.parameters, cornerRadius: 3, cornerAlgorithm: "circular" },
    };
    const smooth: BoxFeature = {
      ...circular,
      parameters: { ...circular.parameters, cornerAlgorithm: "smooth" },
    };
    const geometry = createFeatureGeometry(circular);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.toArray()).toEqual([-10, -10, -10]);
    expect(geometry.boundingBox?.max.toArray()).toEqual([10, 10, 10]);
    geometry.dispose();
    expect(featureTriangleCount(circular)).toBeGreaterThan(12);
    expect(featureTriangleCount(smooth)).toBeGreaterThan(featureTriangleCount(circular));
  });

  it("rounds one local-space corner without changing the opposite sharp corner", () => {
    const cornerRadii = uniformBoxCornerRadii(0);
    cornerRadii.xMaxYMaxZMax = 4;
    const asymmetric: BoxFeature = {
      ...firstBox,
      parameters: { ...firstBox.parameters, cornerRadii },
    };
    const geometry = createFeatureGeometry(asymmetric);
    const position = geometry.getAttribute("position");
    let hasSharpMinimumCorner = false;
    let hasRoundedMaximumCorner = false;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      if (Math.abs(x + 10) < 1e-4 && Math.abs(y + 10) < 1e-4 && Math.abs(z + 10) < 1e-4) hasSharpMinimumCorner = true;
      if (Math.abs(x - 10) < 1e-4 && Math.abs(y - 10) < 1e-4 && Math.abs(z - 10) < 1e-4) hasRoundedMaximumCorner = true;
    }
    expect(hasSharpMinimumCorner).toBe(true);
    expect(hasRoundedMaximumCorner).toBe(false);
    expect(featureVolume(asymmetric)).toBeGreaterThan(7_000);
    expect(featureVolume(asymmetric)).toBeLessThan(8_000);
    geometry.dispose();
  });
});
