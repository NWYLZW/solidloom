import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  clampOrbitDirection,
  ORBIT_MAX_POLAR_ANGLE,
  ORBIT_MIN_POLAR_ANGLE,
  rotateOrbitOffset,
} from "./cameraOrbitMath";

describe("cameraOrbitMath", () => {
  it("keeps orbit distance stable while rotating", () => {
    const offset = new THREE.Vector3(8, 6, 12);
    const distance = offset.length();

    rotateOrbitOffset(offset, 42, -27);

    expect(offset.length()).toBeCloseTo(distance, 10);
  });

  it("stops vertical dragging before the orbit poles", () => {
    const above = new THREE.Vector3(4, 3, 5);
    const below = new THREE.Vector3(4, -3, 5);

    rotateOrbitOffset(above, 0, 100_000);
    rotateOrbitOffset(below, 0, -100_000);

    expect(new THREE.Spherical().setFromVector3(above).phi).toBeCloseTo(ORBIT_MIN_POLAR_ANGLE, 10);
    expect(new THREE.Spherical().setFromVector3(below).phi).toBeCloseTo(ORBIT_MAX_POLAR_ANGLE, 10);
    expect(above.z).toBeGreaterThan(0);
    expect(below.z).toBeGreaterThan(0);
  });

  it("turns exact top and bottom views into stable orbit directions", () => {
    const top = clampOrbitDirection(new THREE.Vector3(0, 1, 0));
    const bottom = clampOrbitDirection(new THREE.Vector3(0, -1, 0));

    expect(new THREE.Spherical().setFromVector3(top).phi).toBeCloseTo(ORBIT_MIN_POLAR_ANGLE, 10);
    expect(new THREE.Spherical().setFromVector3(bottom).phi).toBeCloseTo(ORBIT_MAX_POLAR_ANGLE, 10);
    expect(top.z).toBeGreaterThan(0);
    expect(bottom.z).toBeGreaterThan(0);
  });
});
