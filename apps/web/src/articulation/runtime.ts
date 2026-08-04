import type { ArticulationAnimationKeyframe } from "@solidloom/shared";

export function easeInOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
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
): number {
  if (keyframes.length === 0) return fallback;

  const orderedKeyframes = [...keyframes].sort((left, right) => left.offset - right.offset);
  const frames = loop
    && orderedKeyframes.length > 2
    && orderedKeyframes[0]?.offset === 0
    && orderedKeyframes.at(-1)?.offset === 1
    ? orderedKeyframes.slice(0, -1)
    : orderedKeyframes;
  if (frames.length === 1) return frames[0]?.jointValues[jointId] ?? fallback;

  const sampledProgress = loop
    ? ((progress % 1) + 1) % 1
    : Math.min(1, Math.max(0, progress));
  let segmentIndex = -1;
  for (let index = 0; index < frames.length; index += 1) {
    if (frames[index]!.offset > sampledProgress) break;
    segmentIndex = index;
  }
  if (segmentIndex < 0) segmentIndex = loop ? frames.length - 1 : 0;
  const nextIndex = loop
    ? (segmentIndex + 1) % frames.length
    : Math.min(frames.length - 1, segmentIndex + 1);
  if (segmentIndex === nextIndex) return frames[segmentIndex]?.jointValues[jointId] ?? fallback;

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
  return currentWeight * currentValue
    + currentVelocityWeight * segmentDuration * currentVelocity
    + nextWeight * nextValue
    + nextVelocityWeight * segmentDuration * nextVelocity;
}
