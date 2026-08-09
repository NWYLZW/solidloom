import type {
  ArticulationAnimationClip,
  ArticulationJoint,
  ArticulationLocomotionProfile,
} from "@solidloom/shared";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createLocomotionAnimation } from "../apps/web/src/articulation/locomotion";
import {
  easeInOutCubic,
  normalizeAnimationKeyframes,
  resolveAnimationProgress,
  resolveInstanceJointValues,
  sampleAnimationJointValue,
} from "../apps/web/src/articulation/runtime";
import type { JointAnimationRequest } from "../apps/web/src/articulation/types";
import { createJointAnimationRuntime } from "../apps/web/src/viewport/jointAnimationRuntime";

const joint = (id: string, value = 0, min = -100, max = 100): ArticulationJoint => ({
  axis: [0, 1, 0],
  groupId: `${id}:group`,
  id,
  max,
  min,
  name: id,
  pivot: [0, 0, 0],
  restValue: 0,
  type: "revolute",
  value,
});

function poseRequest(
  id: number,
  target: number,
  overrides: Partial<JointAnimationRequest> = {},
): JointAnimationRequest {
  return {
    durationMs: 1_000,
    id,
    jointRanges: { hinge: { min: -100, max: 100 } },
    jointValues: { hinge: target },
    kind: "pose",
    loop: false,
    ...overrides,
  };
}

function clipRequest(
  id: number,
  overrides: Partial<JointAnimationRequest> = {},
): JointAnimationRequest {
  return {
    durationMs: 1_000,
    id,
    jointRanges: { hinge: { min: -100, max: 100 } },
    keyframes: [
      { offset: 0, jointValues: { hinge: 0 } },
      { offset: 0.5, jointValues: { hinge: 100 } },
      { offset: 1, jointValues: { hinge: 0 } },
    ],
    kind: "clip",
    loop: true,
    transitionMs: 0,
    ...overrides,
  };
}

function runtimeHarness(initialValue = 0) {
  let clock = 0;
  let renderRequests = 0;
  const completed: number[] = [];
  const content = new THREE.Group();
  const jointRuntime = {
    axis: new THREE.Vector3(0, 1, 0),
    content,
    restValue: 0,
    value: initialValue,
  };
  const runtime = createJointAnimationRuntime(
    new Map([["hinge", jointRuntime]]),
    (animationId) => completed.push(animationId),
    () => { renderRequests += 1; },
    { now: () => clock },
  );
  return {
    completed,
    content,
    get renderRequests() { return renderRequests; },
    jointRuntime,
    runtime,
    setClock(value: number) { clock = value; },
  };
}

describe("articulation animation runtime", () => {
  it("eases finite pose transitions without overshooting", () => {
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(2)).toBe(1);
    expect(easeInOutCubic(Number.NaN)).toBe(0);
  });

  it("samples, wraps, and holds joint keyframes", () => {
    const keyframes = [
      { offset: 0, jointValues: { knee: 10 } },
      { offset: 0.5, jointValues: { knee: 70 } },
      { offset: 1, jointValues: { knee: 10 } },
    ];

    expect(sampleAnimationJointValue(keyframes, "knee", 0, 0)).toBe(10);
    expect(sampleAnimationJointValue(keyframes, "knee", 0.5, 0)).toBe(70);
    expect(sampleAnimationJointValue(keyframes, "knee", 1.5, 0)).toBe(70);
    expect(sampleAnimationJointValue(keyframes, "missing", 0.25, 22)).toBe(22);
    expect(sampleAnimationJointValue(keyframes, "knee", 2, 0, false)).toBe(10);
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

  it("normalizes malformed boundaries and clamps spline overshoot to joint ranges", () => {
    const normalized = normalizeAnimationKeyframes([
      { offset: -2, jointValues: { hinge: -200 } },
      { offset: 0.5, jointValues: { hinge: 200 } },
      { offset: 0.5, jointValues: { other: 4 } },
      { offset: 4, jointValues: { hinge: 20 } },
      { offset: Number.NaN, jointValues: { hinge: 30 } },
    ], { hinge: { min: -45, max: 90 } });

    expect(normalized).toEqual([
      { offset: 0, jointValues: { hinge: -45 } },
      { offset: 0.5, jointValues: { hinge: 90, other: 4 } },
      { offset: 1, jointValues: { hinge: 20 } },
    ]);
    expect(sampleAnimationJointValue(normalized, "hinge", 0.4, 0, false, { min: -45, max: 90 }))
      .toBeLessThanOrEqual(90);
  });

  it("resolves absolute duration and progress independently of render steps", () => {
    expect(resolveAnimationProgress(250, 1_000, false)).toMatchObject({
      completed: false,
      elapsedMs: 250,
      progress: 0.25,
    });
    expect(resolveAnimationProgress(1_250, 1_000, true).progress).toBe(0.25);
    expect(resolveAnimationProgress(250, 1_000, false, -1).progress).toBe(0.75);
    expect(resolveAnimationProgress(2_000, 1_000, false, -1)).toMatchObject({
      completed: true,
      progress: 0,
    });
  });

  it("animates poses visibly and validates the final joint range", () => {
    const harness = runtimeHarness();
    harness.runtime.play(poseRequest(1, 400, {
      jointRanges: { hinge: { min: -20, max: 80 } },
    }), 0);

    expect(harness.jointRuntime.value).toBe(0);
    harness.runtime.update(500);
    expect(harness.jointRuntime.value).toBe(40);
    expect(harness.runtime.progress?.progress).toBe(0.5);
    harness.runtime.update(1_000);
    expect(harness.jointRuntime.value).toBe(80);
    expect(harness.completed).toEqual([1]);
    expect(harness.runtime.active).toBe(false);
  });

  it("loops clips at a stable phase", () => {
    const harness = runtimeHarness();
    harness.runtime.play(clipRequest(2), 0);
    harness.runtime.update(250);
    const firstCycle = harness.jointRuntime.value;
    harness.runtime.update(1_250);

    expect(firstCycle).toBeGreaterThan(0);
    expect(harness.jointRuntime.value).toBeCloseTo(firstCycle, 10);
    expect(harness.completed).toEqual([]);
    expect(harness.runtime.active).toBe(true);
  });

  it("blends walk and run clips smoothly from the speed parameter", () => {
    const walk: ArticulationAnimationClip = {
      durationMs: 1_000,
      id: "walk",
      keyframes: [
        { offset: 0, jointValues: { hip: -20 } },
        { offset: 0.5, jointValues: { hip: 20 } },
        { offset: 1, jointValues: { hip: -20 } },
      ],
      loop: true,
      name: "walk",
    };
    const run: ArticulationAnimationClip = {
      ...walk,
      durationMs: 600,
      id: "run",
      keyframes: walk.keyframes.map((frame) => ({
        ...frame,
        jointValues: { hip: frame.jointValues.hip! * 2.5 },
      })),
      name: "run",
    };
    const profile: ArticulationLocomotionProfile = {
      defaultSpeed: 1,
      id: "locomotion",
      maximumSpeed: 4,
      minimumSpeed: 0,
      name: "locomotion",
      runAnimationId: "run",
      runReferenceSpeed: 3,
      transitionDurationMs: 300,
      transitionEndSpeed: 3,
      transitionStartSpeed: 1,
      walkAnimationId: "walk",
      walkReferenceSpeed: 1,
    };

    const walking = createLocomotionAnimation(profile, [walk, run], 1)!;
    const blended = createLocomotionAnimation(profile, [walk, run], 2)!;
    const running = createLocomotionAnimation(profile, [walk, run], 3)!;

    expect(walking.state).toBe("walk");
    expect(blended.state).toBe("blend");
    expect(blended.blend).toBe(0.5);
    expect(blended.animation.keyframes[0]?.jointValues.hip).toBe(-35);
    expect(running.state).toBe("run");
    expect(blended.cycleDurationMs).toBeGreaterThan(running.cycleDurationMs);
  });

  it("cancels at the current visible value without signaling completion", () => {
    const harness = runtimeHarness();
    harness.runtime.play(poseRequest(3, 100, { semanticActionId: "action-3" }), 0);
    harness.setClock(400);
    harness.runtime.cancel();
    const cancelledValue = harness.jointRuntime.value;
    harness.runtime.update(1_000);

    expect(cancelledValue).toBeGreaterThan(0);
    expect(harness.jointRuntime.value).toBe(cancelledValue);
    expect(harness.completed).toEqual([]);
    expect(harness.runtime.active).toBe(false);
  });

  it("reverses a pose from its current sample to the original endpoint", () => {
    const harness = runtimeHarness();
    harness.runtime.play(poseRequest(4, 100), 0);
    harness.runtime.update(400);
    const beforeReverse = harness.jointRuntime.value;

    expect(harness.runtime.reverse(400)).toBe(true);
    expect(harness.jointRuntime.value).toBe(beforeReverse);
    harness.runtime.update(800);

    expect(harness.jointRuntime.value).toBe(0);
    expect(harness.completed).toEqual([4]);
  });

  it("reverses a looping clip without a phase jump", () => {
    const harness = runtimeHarness();
    harness.runtime.play(clipRequest(5), 0);
    harness.runtime.update(250);
    const beforeReverse = harness.jointRuntime.value;
    harness.runtime.reverse(250);

    expect(harness.jointRuntime.value).toBe(beforeReverse);
    harness.runtime.update(500);
    expect(harness.jointRuntime.value).toBeCloseTo(0, 10);
    expect(harness.runtime.active).toBe(true);
  });

  it("redirects from the current pose instead of snapping", () => {
    const harness = runtimeHarness();
    harness.runtime.play(poseRequest(6, 100), 0);
    harness.runtime.update(500);
    expect(harness.jointRuntime.value).toBe(50);

    harness.runtime.redirect(poseRequest(7, -100), 500);
    expect(harness.jointRuntime.value).toBe(50);
    harness.runtime.update(1_000);
    expect(harness.jointRuntime.value).toBe(-25);
    expect(harness.completed).toEqual([]);
  });

  it("produces the same sample for sparse and dense render frame schedules", () => {
    const sparse = runtimeHarness();
    const dense = runtimeHarness();
    sparse.runtime.play(poseRequest(8, 100), 0);
    dense.runtime.play(poseRequest(8, 100), 0);
    for (let frameTime = 16; frameTime < 736; frameTime += 16) dense.runtime.update(frameTime);
    dense.runtime.update(736);
    sparse.runtime.update(736);

    expect(dense.jointRuntime.value).toBeCloseTo(sparse.jointRuntime.value, 12);
    expect(dense.runtime.progress).toEqual(sparse.runtime.progress);
  });

  it("applies model-reference joint overrides per instance and preserves the source", () => {
    const sourceJoint = joint("screen", 12, 0, 75);
    const source = [sourceJoint];

    const openInstance = resolveInstanceJointValues(source, { screen: 60 });
    const closedInstance = resolveInstanceJointValues(source, { screen: -40, unknown: 20 });

    expect(openInstance).toEqual({ screen: 60 });
    expect(closedInstance).toEqual({ screen: 0 });
    expect(sourceJoint.value).toBe(12);
  });

  it("uses instance overrides as the initial presentation value", () => {
    const harness = runtimeHarness(12);
    harness.runtime.play(poseRequest(9, 75, {
      initialJointValues: { hinge: 45 },
      jointRanges: { hinge: { min: 0, max: 75 } },
    }), 0);

    expect(harness.jointRuntime.value).toBe(45);
    harness.runtime.update(500);
    expect(harness.jointRuntime.value).toBe(60);
  });
});
