import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  clampNavigationCameraPitch,
  clampThirdPersonCameraHeight,
  getNavigationCameraPitchRange,
  resolveThirdPersonAvatarOpacity,
  resolveThirdPersonElevation,
  THIRD_PERSON_MAX_ELEVATION,
  THIRD_PERSON_MIN_ELEVATION,
} from "./navigationCameraMath";

describe("navigationCameraMath", () => {
  it("clamps restored third-person pitch to its visible camera range", () => {
    const range = getNavigationCameraPitchRange("third-person");

    expect(clampNavigationCameraPitch("third-person", THREE.MathUtils.degToRad(-90)))
      .toBeCloseTo(range.minimum, 10);
    expect(clampNavigationCameraPitch("third-person", THREE.MathUtils.degToRad(90)))
      .toBeCloseTo(range.maximum, 10);
  });

  it("maps the complete third-person pitch range directly to visible elevation", () => {
    const range = getNavigationCameraPitchRange("third-person");

    expect(resolveThirdPersonElevation(range.minimum)).toBeCloseTo(THIRD_PERSON_MIN_ELEVATION, 10);
    expect(resolveThirdPersonElevation(range.maximum)).toBeCloseTo(THIRD_PERSON_MAX_ELEVATION, 10);
    expect(THIRD_PERSON_MIN_ELEVATION).toBeLessThan(0);
  });

  it("keeps low-angle third-person camera above the floor", () => {
    expect(clampThirdPersonCameraHeight(-900, 120, 1800)).toBeCloseTo(264, 10);
    expect(clampThirdPersonCameraHeight(900, 120, 1800)).toBe(900);
  });

  it("fades the avatar smoothly as collision pushes the camera toward the character", () => {
    expect(resolveThirdPersonAvatarOpacity(300, 1800)).toBe(0);
    expect(resolveThirdPersonAvatarOpacity(630, 1800)).toBeCloseTo(0.5, 10);
    expect(resolveThirdPersonAvatarOpacity(800, 1800)).toBeGreaterThan(0.85);
    expect(resolveThirdPersonAvatarOpacity(1000, 1800)).toBe(1);
  });

  it("gives first-person camera a wider but pole-safe pitch range", () => {
    const range = getNavigationCameraPitchRange("first-person");

    expect(THREE.MathUtils.radToDeg(range.minimum)).toBeCloseTo(-80, 10);
    expect(THREE.MathUtils.radToDeg(range.maximum)).toBeCloseTo(80, 10);
  });
});
