import type {
  ArticulationAnimationClip,
  ArticulationLocomotionProfile,
} from "@solidloom/shared";
import { sampleAnimationJointValue } from "./runtime";

export type LocomotionState = "idle" | "walk" | "blend" | "run";

export interface LocomotionAnimationResult {
  animation: ArticulationAnimationClip;
  blend: number;
  cycleDurationMs: number;
  speed: number;
  state: LocomotionState;
}

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;

function smoothstep(progress: number): number {
  const clamped = clamp(progress, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function scaledCycleDuration(clip: ArticulationAnimationClip, referenceSpeed: number, speed: number): number {
  const rawDuration = clip.durationMs * referenceSpeed / Math.max(0.35, speed);
  return clamp(rawDuration, clip.durationMs * 0.72, clip.durationMs * 1.65);
}

export function resolveLocomotionState(profile: ArticulationLocomotionProfile, speed: number): LocomotionState {
  if (speed <= Math.max(0.01, profile.minimumSpeed)) return "idle";
  if (speed <= profile.transitionStartSpeed) return "walk";
  if (speed >= profile.transitionEndSpeed) return "run";
  return "blend";
}

export function createLocomotionAnimation(
  profile: ArticulationLocomotionProfile,
  animations: ArticulationAnimationClip[],
  requestedSpeed: number,
): LocomotionAnimationResult | null {
  const speed = clamp(requestedSpeed, profile.minimumSpeed, profile.maximumSpeed);
  const state = resolveLocomotionState(profile, speed);
  if (state === "idle") return null;

  const walk = animations.find((animation) => animation.id === profile.walkAnimationId);
  const run = animations.find((animation) => animation.id === profile.runAnimationId);
  if (!walk || !run) return null;

  const transitionRange = Math.max(0.001, profile.transitionEndSpeed - profile.transitionStartSpeed);
  const blend = smoothstep((speed - profile.transitionStartSpeed) / transitionRange);
  const walkDuration = scaledCycleDuration(walk, profile.walkReferenceSpeed, speed);
  const runDuration = scaledCycleDuration(run, profile.runReferenceSpeed, speed);
  const cycleDurationMs = Math.round(lerp(walkDuration, runDuration, blend));
  const offsets = [...new Set([
    ...walk.keyframes.map((keyframe) => keyframe.offset),
    ...run.keyframes.map((keyframe) => keyframe.offset),
  ])].sort((left, right) => left - right);
  const jointIds = [...new Set([
    ...walk.keyframes.flatMap((keyframe) => Object.keys(keyframe.jointValues)),
    ...run.keyframes.flatMap((keyframe) => Object.keys(keyframe.jointValues)),
  ])];
  const fallbackByJoint = new Map(jointIds.map((jointId) => [
    jointId,
    walk.keyframes[0]?.jointValues[jointId] ?? run.keyframes[0]?.jointValues[jointId] ?? 0,
  ]));

  return {
    animation: {
      id: profile.id,
      name: profile.name,
      durationMs: cycleDurationMs,
      loop: true,
      keyframes: offsets.map((offset) => ({
        offset,
        jointValues: Object.fromEntries(jointIds.map((jointId) => {
          const fallback = fallbackByJoint.get(jointId) ?? 0;
          const walkValue = sampleAnimationJointValue(walk.keyframes, jointId, offset, fallback, true);
          const runValue = sampleAnimationJointValue(run.keyframes, jointId, offset, fallback, true);
          return [jointId, lerp(walkValue, runValue, blend)];
        })),
      })),
    },
    blend,
    cycleDurationMs,
    speed,
    state,
  };
}
