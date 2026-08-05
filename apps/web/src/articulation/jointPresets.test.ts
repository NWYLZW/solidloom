import { describe, expect, it } from "vitest";
import { jointPresetValues } from "./jointPresets";

describe("jointPresetValues", () => {
  it("uses the complete joint range even when restValue is the closed state", () => {
    expect(jointPresetValues({ min: 0, max: 55 })).toEqual({
      closed: 0,
      half: 27.5,
      expanded: 55,
    });
  });

  it("supports joints whose range crosses zero", () => {
    expect(jointPresetValues({ min: -35, max: 35 })).toEqual({
      closed: -35,
      half: 0,
      expanded: 35,
    });
  });
});
