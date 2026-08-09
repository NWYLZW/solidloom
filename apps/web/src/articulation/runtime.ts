import type { ArticulationAnimationKeyframe, ArticulationJoint } from "@solidloom/shared";
import type {
  JointAnimationDirection,
  JointAnimationProgress,
  JointValueRange,
} from "./types";

const MINIMUM_DURATION_MS = 1;

export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function normalizeLoopProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return ((value % 1) + 1) % 1;
}

export function normalizedDurationMs(value: number, fallback = MINIMUM_DURATION_MS): number {
  return Math.max(MINIMUM_DURATION_MS, Number.isFinite(value) ? value : fallback);
}

export function resolveAnimationProgress(
  elapsedMs: number,
  durationMs: number,
  loop: boolean,
  direction: JointAnimationDirection = 1,
  initialProgress = direction === -1 ? 1 : 0,
): JointAnimationProgress {
  const safeElapsedMs = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const elapsedCycles = safeElapsedMs / normalizedDurationMs(durationMs);
  const directedProgress = clampUnit(initialProgress) + elapsedCycles * direction;
  if (loop) {
    return {
      completed: false,
      cycle: Math.max(0, Math.floor(Math.abs(directedProgress))),
      direction,
      elapsedMs: safeElapsedMs,
      progress: normalizeLoopProgress(directedProgress),
    };
  }
  return {
    completed: direction === 1 ? directedProgress >= 1 : directedProgress <= 0,
    cycle: 0,
    direction,
    elapsedMs: safeElapsedMs,
    progress: clampUnit(directedProgress),
  };
}

export function clampJointValue(value: number, range?: JointValueRange, fallback = 0): number {
  const finiteFallback = Number.isFinite(fallback) ? fallback : 0;
  const finiteValue = Number.isFinite(value) ? value : finiteFallback;
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return finiteValue;
  const minimum = Math.min(range.min, range.max);
  const maximum = Math.max(range.min, range.max);
  return Math.min(maximum, Math.max(minimum, finiteValue));
}

export function jointRangesFromJoints(joints: ArticulationJoint[]): Record<string, JointValueRange> {
  return Object.fromEntries(joints.map((joint) => [joint.id, {
    max: Math.max(joint.min, joint.max),
    min: Math.min(joint.min, joint.max),
  }]));
}

/** Resolves per-instance values without mutating the reusable source model. */
export function resolveInstanceJointValues(
  joints: ArticulationJoint[],
  instanceJointValues: Record<string, number> = {},
  baseJointValues: Record<string, number> = {},
): Record<string, number> {
  const ranges = jointRangesFromJoints(joints);
  return Object.fromEntries(joints.map((joint) => {
    const baseValue = baseJointValues[joint.id] ?? joint.value;
    return [
      joint.id,
      clampJointValue(instanceJointValues[joint.id] ?? baseValue, ranges[joint.id], baseValue),
    ];
  }));
}

export function normalizeAnimationKeyframes(
  keyframes: ArticulationAnimationKeyframe[],
  jointRanges: Record<string, JointValueRange> = {},
): ArticulationAnimationKeyframe[] {
  const frameByOffset = new Map<number, ArticulationAnimationKeyframe>();
  for (const keyframe of keyframes) {
    if (!Number.isFinite(keyframe.offset)) continue;
    const offset = clampUnit(keyframe.offset);
    const previousValues = frameByOffset.get(offset)?.jointValues ?? {};
    const jointValues = Object.fromEntries(Object.entries(keyframe.jointValues).flatMap(([jointId, value]) => {
      if (!Number.isFinite(value)) return [];
      return [[jointId, clampJointValue(value, jointRanges[jointId])]];
    }));
    frameByOffset.set(offset, {
      offset,
      jointValues: { ...previousValues, ...jointValues },
    });
  }
  return [...frameByOffset.values()].sort((left, right) => left.offset - right.offset);
}

export function easeInOutCubic(progress: number): number {
  const clamped = clampUnit(progress);
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export function sampleAnimationJointValue(
  keyframes: ArticulationAnimationKeyframe[],
  jointId: string,
  progress: number,
  fallback: number,
  loop = true,
  range?: JointValueRange,
): number {
  if (keyframes.length === 0) return clampJointValue(fallback, range, fallback);

  const orderedKeyframes = normalizeAnimationKeyframes(keyframes, range ? { [jointId]: range } : {});
  if (orderedKeyframes.length === 0) return clampJointValue(fallback, range, fallback);
  const frames = loop
    && orderedKeyframes.length > 2
    && orderedKeyframes[0]?.offset === 0
    && orderedKeyframes.at(-1)?.offset === 1
    ? orderedKeyframes.slice(0, -1)
    : orderedKeyframes;
  if (frames.length === 1) {
    return clampJointValue(frames[0]?.jointValues[jointId] ?? fallback, range, fallback);
  }

  const sampledProgress = loop
    ? ((progress % 1) + 1) % 1
    : clampUnit(progress);
  let segmentIndex = -1;
  for (let index = 0; index < frames.length; index += 1) {
    if (frames[index]!.offset > sampledProgress) break;
    segmentIndex = index;
  }
  if (segmentIndex < 0) segmentIndex = loop ? frames.length - 1 : 0;
  const nextIndex = loop
    ? (segmentIndex + 1) % frames.length
    : Math.min(frames.length - 1, segmentIndex + 1);
  if (segmentIndex === nextIndex) {
    return clampJointValue(frames[segmentIndex]?.jointValues[jointId] ?? fallback, range, fallback);
  }

  const previousIndex = loop
    ? (segmentIndex - 1 + frames.length) % frames.length
    : Math.max(0, segmentIndex - 1);
  const afterNextIndex = loop
    ? (nextIndex + 1) % frames.length
    : Math.min(frames.length - 1, nextIndex + 1);
  const currentFrame = frames[segmentIndex]!;
  const nextFrame = frames[nextIndex]!;
  const previousFrame = frames[previousIndex]!;
  const afterNextFrame = frames[afterNextIndex]!;

  const currentTime = currentFrame.offset;
  let nextTime = nextFrame.offset;
  if (loop && nextTime <= currentTime) nextTime += 1;
  let previousTime = previousFrame.offset;
  if (loop && previousTime >= currentTime) previousTime -= 1;
  let afterNextTime = afterNextFrame.offset;
  if (loop) while (afterNextTime <= nextTime) afterNextTime += 1;
  const evaluationTime = loop && sampledProgress < currentTime ? sampledProgress + 1 : sampledProgress;
  const segmentDuration = Math.max(0.000001, nextTime - currentTime);
  const localProgress = Math.min(1, Math.max(0, (evaluationTime - currentTime) / segmentDuration));

  const currentValue = currentFrame.jointValues[jointId] ?? fallback;
  const nextValue = nextFrame.jointValues[jointId] ?? currentValue;
  const previousValue = previousFrame.jointValues[jointId] ?? currentValue;
  const afterNextValue = afterNextFrame.jointValues[jointId] ?? nextValue;
  const currentVelocity = previousIndex === segmentIndex
    ? (nextValue - currentValue) / segmentDuration
    : (nextValue - previousValue) / Math.max(0.000001, nextTime - previousTime);
  const nextVelocity = afterNextIndex === nextIndex
    ? (nextValue - currentValue) / segmentDuration
    : (afterNextValue - currentValue) / Math.max(0.000001, afterNextTime - currentTime);

  const squaredProgress = localProgress * localProgress;
  const cubedProgress = squaredProgress * localProgress;
  const currentWeight = 2 * cubedProgress - 3 * squaredProgress + 1;
  const currentVelocityWeight = cubedProgress - 2 * squaredProgress + localProgress;
  const nextWeight = -2 * cubedProgress + 3 * squaredProgress;
  const nextVelocityWeight = cubedProgress - squaredProgress;
  return clampJointValue(currentWeight * currentValue
    + currentVelocityWeight * segmentDuration * currentVelocity
    + nextWeight * nextValue
    + nextVelocityWeight * segmentDuration * nextVelocity, range, fallback);
}

export function sampleAnimationJointValues(
  keyframes: ArticulationAnimationKeyframe[],
  jointIds: Iterable<string>,
  progress: number,
  fallbackJointValues: Record<string, number>,
  loop = true,
  jointRanges: Record<string, JointValueRange> = {},
): Record<string, number> {
  return Object.fromEntries([...jointIds].map((jointId) => [
    jointId,
    sampleAnimationJointValue(
      keyframes,
      jointId,
      progress,
      fallbackJointValues[jointId] ?? 0,
      loop,
      jointRanges[jointId],
    ),
  ]));
}
