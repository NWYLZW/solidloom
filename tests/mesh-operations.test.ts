import { describe, expect, it } from "vitest";
import type { BoxFeature } from "@solidloom/shared";
import { evaluateBoolean, evaluatePlaneCut } from "../apps/web/src/meshOperations";

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
});
