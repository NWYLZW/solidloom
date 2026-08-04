import { describe, expect, it } from "vitest";
import { easeInOutCubic, sampleAnimationJointValue } from "../apps/web/src/articulation/runtime";

describe("articulation animation runtime", () => {
  it("eases finite pose transitions without overshooting", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(2)).toBe(1);
  });

  it("samples and wraps looping joint keyframes", () => {
    const keyframes = [
      { offset: 0, jointValues: { knee: 10 } },
      { offset: 0.5, jointValues: { knee: 70 } },
      { offset: 1, jointValues: { knee: 10 } },
    ];

    expect(sampleAnimationJointValue(keyframes, "knee", 0, 0)).toBe(10);
    expect(sampleAnimationJointValue(keyframes, "knee", 0.5, 0)).toBe(70);
    expect(sampleAnimationJointValue(keyframes, "knee", 1, 0)).toBe(10);
    expect(sampleAnimationJointValue(keyframes, "knee", 1.5, 0)).toBe(70);
    expect(sampleAnimationJointValue(keyframes, "missing", 0.25, 22)).toBe(22);
  });

  it("keeps joint velocity continuous through an intermediate gait keyframe", () => {
    const hipKeyframes = [
      { offset: 0, jointValues: { hip: 22 } },
      { offset: 0.25, jointValues: { hip: 5 } },
      { offset: 0.5, jointValues: { hip: -28 } },
      { offset: 0.75, jointValues: { hip: -8 } },
      { offset: 1, jointValues: { hip: 22 } },
    ];
    const before = sampleAnimationJointValue(hipKeyframes, "hip", 0.499, 0);
    const atKeyframe = sampleAnimationJointValue(hipKeyframes, "hip", 0.5, 0);
    const after = sampleAnimationJointValue(hipKeyframes, "hip", 0.501, 0);

    expect(atKeyframe - before).toBeLessThan(0);
    expect(after - atKeyframe).toBeLessThan(0);
    expect(Math.abs((atKeyframe - before) - (after - atKeyframe))).toBeLessThan(0.02);
  });

  it("holds the final value for a non-looping clip", () => {
    const keyframes = [
      { offset: 0, jointValues: { shoulder: 0 } },
      { offset: 1, jointValues: { shoulder: 45 } },
    ];

    expect(sampleAnimationJointValue(keyframes, "shoulder", 1, 0, false)).toBe(45);
    expect(sampleAnimationJointValue(keyframes, "shoulder", 2, 0, false)).toBe(45);
  });
});
