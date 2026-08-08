import { describe, expect, it } from "vitest";
import {
  moveNavigationVelocityToward,
  resolveNavigationMotionProfile,
  resolveNavigationPathSpeed,
} from "../apps/web/src/navigationMotion";

describe("navigation motion", () => {
  it("uses brisk walking and running defaults for the standard avatar", () => {
    expect(resolveNavigationMotionProfile(1720)).toEqual({
      acceleration: 7500,
      braking: 9000,
      gravity: 9800,
      jumpVelocity: 3100,
      pathSpeed: 2100,
      runSpeed: 5000,
      seatedSpeed: 720,
      walkSpeed: 2100,
    });
  });

  it("scales speeds and acceleration with avatar size", () => {
    expect(resolveNavigationMotionProfile(860)).toEqual({
      acceleration: 3750,
      braking: 4500,
      gravity: 4900,
      jumpVelocity: 1550,
      pathSpeed: 1050,
      runSpeed: 2500,
      seatedSpeed: 360,
      walkSpeed: 1050,
    });
  });

  it("approaches the target velocity over multiple frames", () => {
    const velocity = { x: 0, y: 0, z: 0 };
    const target = { x: 0, y: 0, z: 1500 };

    moveNavigationVelocityToward(velocity, target, 480);
    expect(velocity.z).toBe(480);
    moveNavigationVelocityToward(velocity, target, 480);
    expect(velocity.z).toBe(960);
    moveNavigationVelocityToward(velocity, target, 480);
    expect(velocity.z).toBe(1440);
    moveNavigationVelocityToward(velocity, target, 480);
    expect(velocity.z).toBe(1500);
  });

  it("brakes to a stop without overshooting zero", () => {
    const velocity = { x: 320, y: 0, z: 0 };
    const stopped = { x: 0, y: 0, z: 0 };

    moveNavigationVelocityToward(velocity, stopped, 200);
    expect(velocity.x).toBe(120);
    moveNavigationVelocityToward(velocity, stopped, 200);
    expect(velocity.x).toBe(0);
  });

  it("accelerates along a path and slows before the destination", () => {
    const profile = resolveNavigationMotionProfile(1720);
    const startingSpeed = resolveNavigationPathSpeed(profile, 0, 4000, true, 0.1);
    const cruisingSpeed = resolveNavigationPathSpeed(profile, 2100, 4000, true, 0.1);
    const arrivalSpeed = resolveNavigationPathSpeed(profile, 2100, 100, true, 0.1);

    expect(startingSpeed).toBe(750);
    expect(cruisingSpeed).toBe(2100);
    expect(arrivalSpeed).toBeCloseTo(Math.sqrt(2 * 9000 * 100));
  });
});
