import { describe, expect, it } from "vitest";
import {
  formatBoxCornerRadiusExpression,
  parseBoxCornerRadiusExpression,
} from "@solidloom/shared";

describe("3D corner radius expressions", () => {
  it("expands bottom and top layer shorthand using local axes", () => {
    const radii = parseBoxCornerRadiusExpression("corner-radius: 8 / 4;");
    expect(radii).not.toBeNull();
    expect(radii?.xMinYMinZMin).toBe(8);
    expect(radii?.xMaxYMinZMax).toBe(8);
    expect(radii?.xMinYMaxZMin).toBe(4);
    expect(radii?.xMaxYMaxZMax).toBe(4);
    expect(formatBoxCornerRadiusExpression(radii!)).toBe("8 / 4");
  });

  it("maps four footprint values through both height layers", () => {
    const radii = parseBoxCornerRadiusExpression("8 6 4 2");
    expect(radii).toMatchObject({
      xMinYMinZMin: 8,
      xMaxYMinZMin: 6,
      xMaxYMinZMax: 4,
      xMinYMinZMax: 2,
      xMinYMaxZMin: 8,
      xMaxYMaxZMin: 6,
      xMaxYMaxZMax: 4,
      xMinYMaxZMax: 2,
    });
    expect(formatBoxCornerRadiusExpression(radii!)).toBe("8 6 4 2");
  });

  it("rejects ambiguous or negative shorthand", () => {
    expect(parseBoxCornerRadiusExpression("1 2 3")).toBeNull();
    expect(parseBoxCornerRadiusExpression("8 -1")).toBeNull();
  });
});
