import { describe, expect, it } from "vitest";
import type { ArticulationAnimationClip, ArticulationLocomotionProfile } from "@solidloom/shared";
import { createLocomotionAnimation, resolveLocomotionState } from "../apps/web/src/articulation/locomotion";

const profile: ArticulationLocomotionProfile = {
  id: "locomotion",
  name: "移动速度",
  walkAnimationId: "walk",
  runAnimationId: "run",
  defaultSpeed: 0,
  minimumSpeed: 0,
  maximumSpeed: 5,
  walkReferenceSpeed: 1.4,
  runReferenceSpeed: 3.6,
  transitionStartSpeed: 1.7,
  transitionEndSpeed: 2.7,
  transitionDurationMs: 420,
};

const animations: ArticulationAnimationClip[] = [
  {
    id: "walk",
    name: "走路",
    durationMs: 1_000,
    loop: true,
    keyframes: [
      { offset: 0, jointValues: { hip: -20 } },
      { offset: 0.5, jointValues: { hip: 20 } },
      { offset: 1, jointValues: { hip: -20 } },
    ],
  },
  {
    id: "run",
    name: "奔跑",
    durationMs: 600,
    loop: true,
    keyframes: [
      { offset: 0, jointValues: { hip: -50 } },
      { offset: 0.5, jointValues: { hip: 50 } },
      { offset: 1, jointValues: { hip: -50 } },
    ],
  },
];

describe("locomotion animation", () => {
  it("maps speed to idle, walk, blend, and run states", () => {
    expect(resolveLocomotionState(profile, 0)).toBe("idle");
    expect(resolveLocomotionState(profile, 1.4)).toBe("walk");
    expect(resolveLocomotionState(profile, 2.2)).toBe("blend");
    expect(resolveLocomotionState(profile, 3.6)).toBe("run");
  });

  it("smoothly blends gait amplitude through the transition range", () => {
    const walking = createLocomotionAnimation(profile, animations, 1.4)!;
    const transitioning = createLocomotionAnimation(profile, animations, 2.2)!;
    const running = createLocomotionAnimation(profile, animations, 3.6)!;

    expect(walking.blend).toBe(0);
    expect(transitioning.blend).toBeCloseTo(0.5, 5);
    expect(running.blend).toBe(1);
    expect(walking.animation.keyframes[0]?.jointValues.hip).toBe(-20);
    expect(transitioning.animation.keyframes[0]?.jointValues.hip).toBe(-35);
    expect(running.animation.keyframes[0]?.jointValues.hip).toBe(-50);
  });

  it("increases cadence as speed rises", () => {
    const slowWalk = createLocomotionAnimation(profile, animations, 0.8)!;
    const referenceWalk = createLocomotionAnimation(profile, animations, 1.4)!;
    const fastRun = createLocomotionAnimation(profile, animations, 5)!;

    expect(slowWalk.cycleDurationMs).toBeGreaterThan(referenceWalk.cycleDurationMs);
    expect(referenceWalk.cycleDurationMs).toBeGreaterThan(fastRun.cycleDurationMs);
  });
});
