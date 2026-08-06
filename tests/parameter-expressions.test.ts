import { describe, expect, it } from "vitest";
import {
  applyFeatureGraphExpressions,
  evaluateParameterExpression,
  modelVariableValues,
  type FeatureGraph,
} from "@solidloom/shared";

describe("parameter expressions", () => {
  it("evaluates CSS-style variables and numeric functions", () => {
    expect(evaluateParameterExpression(
      "max(10, var(--height) - 2 * var(--floor))",
      { "--height": 2800, "--floor": 160 },
    )).toBe(2480);
    expect(evaluateParameterExpression("clamp(0, -12, 50) + abs(-4)", {})).toBe(4);
  });

  it("writes evaluated values into numeric feature paths", () => {
    const graph: FeatureGraph = {
      version: 1,
      variables: [{ id: "--height", label: "整体高度", value: 2800, unit: "mm" }],
      features: [{
        id: "panel",
        name: "面板",
        type: "box",
        operation: "add",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        parameters: { width: 100, height: 10, depth: 20 },
        parameterExpressions: {
          "parameters.height": "var(--height) / 2",
          "position.1": "var(--height) / 4",
        },
      }],
    };
    const result = applyFeatureGraphExpressions(graph);
    expect(result.issues).toEqual([]);
    expect(result.featureGraph.features[0]?.parameters.height).toBe(1400);
    expect(result.featureGraph.features[0]?.position[1]).toBe(700);
  });

  it("reports missing variables without corrupting the previous value", () => {
    const graph: FeatureGraph = {
      version: 1,
      features: [{
        id: "panel",
        name: "面板",
        type: "box",
        operation: "add",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        parameters: { width: 100, height: 10, depth: 20 },
        parameterExpressions: { "parameters.height": "var(--missing)" },
      }],
    };
    const result = applyFeatureGraphExpressions(graph);
    expect(result.issues[0]?.message).toContain("--missing");
    expect(result.featureGraph.features[0]?.parameters.height).toBe(10);
  });

  it("keeps color variables out of numeric expressions", () => {
    expect(modelVariableValues([
      { id: "--height", label: "整体高度", value: 2800, unit: "mm" },
      { id: "--surface-color", label: "表面颜色", type: "color", value: "#AABBCC" },
    ])).toEqual({ "--height": 2800 });
  });
});
