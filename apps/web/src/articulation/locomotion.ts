import type {
  ArticulationAnimationClip,
  ArticulationLocomotionProfile,
} from "@solidloom/shared";
import { clampUnit, normalizedDurationMs, sampleAnimationJointValue } from "./runtime";

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
  const clamped = clampUnit(progress);
  return clamped * clamped * (3 - 2 * clamped);
}

function scaledCycleDuration(clip: ArticulationAnimationClip, referenceSpeed: number, speed: number): number {
  const durationMs = normalizedDurationMs(clip.durationMs);
  const safeReferenceSpeed = Math.max(0.01, Number.isFinite(referenceSpeed) ? referenceSpeed : 0.01);
  const rawDuration = durationMs * safeReferenceSpeed / Math.max(0.35, speed);
  return clamp(rawDuration, durationMs * 0.72, durationMs * 1.65);
}

export function resolveLocomotionState(profile: ArticulationLocomotionProfile, speed: number): LocomotionState {
  const transitionStartSpeed = Math.min(profile.transitionStartSpeed, profile.transitionEndSpeed);
  const transitionEndSpeed = Math.max(profile.transitionStartSpeed, profile.transitionEndSpeed);
  if (speed <= Math.max(0.01, profile.minimumSpeed)) return "idle";
  if (speed <= transitionStartSpeed) return "walk";
  if (speed >= transitionEndSpeed) return "run";
  return "blend";
}

export function createLocomotionAnimation(
  profile: ArticulationLocomotionProfile,
  animations: ArticulationAnimationClip[],
  requestedSpeed: number,
): LocomotionAnimationResult | null {
  const minimumSpeed = Math.min(profile.minimumSpeed, profile.maximumSpeed);
  const maximumSpeed = Math.max(profile.minimumSpeed, profile.maximumSpeed);
  const speed = clamp(Number.isFinite(requestedSpeed) ? requestedSpeed : minimumSpeed, minimumSpeed, maximumSpeed);
  const state = resolveLocomotionState(profile, speed);
  if (state === "idle") return null;

  const walk = animations.find((animation) => animation.id === profile.walkAnimationId);
  const run = animations.find((animation) => animation.id === profile.runAnimationId);
  if (!walk || !run) return null;

  const transitionStartSpeed = Math.min(profile.transitionStartSpeed, profile.transitionEndSpeed);
  const transitionEndSpeed = Math.max(profile.transitionStartSpeed, profile.transitionEndSpeed);
  const transitionRange = Math.max(0.001, transitionEndSpeed - transitionStartSpeed);
  const blend = smoothstep((speed - transitionStartSpeed) / transitionRange);
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
