import { describe, expect, it } from "vitest";
import { resolveTouchJoystick, resolveTouchLookDelta } from "./touchInputMath";

describe("touch input math", () => {
  it("keeps the joystick inside its radius and preserves direction", () => {
    const result = resolveTouchJoystick({ x: 20, y: 20 }, { x: 140, y: -40 }, 60);
    expect(Math.hypot(result.knob.x, result.knob.y)).toBeCloseTo(60);
    expect(Math.hypot(result.value.x, result.value.y)).toBeCloseTo(1);
    expect(result.value.x).toBeGreaterThan(0);
    expect(result.value.y).toBeLessThan(0);
  });

  it("removes small accidental movement with a radial deadzone", () => {
    const result = resolveTouchJoystick({ x: 0, y: 0 }, { x: 3, y: 2 }, 60, 0.12);
    expect(result.value).toEqual({ x: 0, y: 0 });
  });

  it("converts view pixels to an invertible transient delta", () => {
    expect(resolveTouchLookDelta(10, -5, 1, false)).toEqual({ x: 0.032, y: -0.016 });
    expect(resolveTouchLookDelta(10, -5, 1, true)).toEqual({ x: 0.032, y: 0.016 });
  });
});
