import * as THREE from "three";
import {
  clampJointValue,
  clampUnit,
  easeInOutCubic,
  normalizedDurationMs,
  resolveAnimationProgress,
  sampleAnimationJointValue,
} from "../articulation/runtime";
import type {
  JointAnimationDirection,
  JointAnimationProgress,
  JointAnimationRequest,
} from "../articulation/types";
import type { JointRuntime } from "./modelSceneRuntime";

interface ActiveJointEntry {
  endpointA: number;
  endpointB: number;
  from: number;
  jointId: string;
  runtime: JointRuntime;
  target: number;
}

interface ActiveJointAnimation {
  baseDurationMs: number;
  direction: JointAnimationDirection;
  durationMs: number;
  entries: ActiveJointEntry[];
  lastProgress: JointAnimationProgress;
  phaseAtStart: number;
  request: JointAnimationRequest;
  startedAt: number;
  targetSide: 0 | 1;
  transitionDurationMs: number;
  transitionStartedAt: number;
}

export interface JointAnimationRuntime {
  readonly active: boolean;
  readonly progress: JointAnimationProgress | null;
  /** Cancels the presentation at its sampled value without committing semantic state. */
  cancel: (frameTime?: number) => void;
  play: (request: JointAnimationRequest | null, frameTime?: number) => void;
  /** Redirects from the current visible values and never jumps to the new target. */
  redirect: (request: JointAnimationRequest, frameTime?: number) => void;
  /** Reverses the active pose endpoints or clip playback phase in place. */
  reverse: (frameTime?: number) => boolean;
  update: (frameTime: number) => void;
}

export interface CreateJointAnimationRuntimeOptions {
  now?: () => number;
}

function animationJointIds(request: JointAnimationRequest): string[] {
  return request.kind === "pose"
    ? Object.keys(request.jointValues ?? {})
    : [...new Set((request.keyframes ?? []).flatMap((keyframe) => Object.keys(keyframe.jointValues)))];
}

function applyJointValue(entry: ActiveJointEntry, value: number, request: JointAnimationRequest): void {
  entry.runtime.value = clampJointValue(value, request.jointRanges?.[entry.jointId], entry.runtime.value);
  entry.runtime.content.setRotationFromAxisAngle(
    entry.runtime.axis,
    THREE.MathUtils.degToRad(entry.runtime.value - entry.runtime.restValue),
  );
}

export function createJointAnimationRuntime(
  jointRuntimeById: Map<string, JointRuntime>,
  onComplete: (animationId: number) => void,
  requestRender: () => void,
  { now = () => performance.now() }: CreateJointAnimationRuntimeOptions = {},
): JointAnimationRuntime {
  let activeAnimation: ActiveJointAnimation | null = null;

  const progressAt = (animation: ActiveJointAnimation, frameTime: number): JointAnimationProgress => (
    resolveAnimationProgress(
      Math.max(0, frameTime - animation.startedAt),
      animation.durationMs,
      animation.request.loop,
      animation.direction,
      animation.phaseAtStart,
    )
  );

  const update = (frameTime: number) => {
    const animation = activeAnimation;
    if (!animation) return;
    const progress = progressAt(animation, frameTime);
    animation.lastProgress = progress;
    const request = animation.request;
    if (request.kind === "pose") {
      const easedProgress = easeInOutCubic(progress.progress);
      for (const entry of animation.entries) {
        applyJointValue(entry, THREE.MathUtils.lerp(entry.from, entry.target, easedProgress), request);
      }
    } else {
      const keyframes = request.keyframes ?? [];
      const transitionProgress = animation.transitionDurationMs > 0
        ? easeInOutCubic((frameTime - animation.transitionStartedAt) / animation.transitionDurationMs)
        : 1;
      for (const entry of animation.entries) {
        const target = sampleAnimationJointValue(
          keyframes,
          entry.jointId,
          progress.progress,
          entry.from,
          request.loop,
          request.jointRanges?.[entry.jointId],
        );
        applyJointValue(entry, THREE.MathUtils.lerp(entry.from, target, transitionProgress), request);
      }
    }
    if (progress.completed) {
      activeAnimation = null;
      onComplete(request.id);
    }
  };

  const cancel = (frameTime = now()) => {
    if (activeAnimation) update(frameTime);
    activeAnimation = null;
    requestRender();
  };

  const reverse = (frameTime = now()): boolean => {
    const animation = activeAnimation;
    if (!animation) return false;
    update(frameTime);
    if (activeAnimation !== animation) return false;

    if (animation.request.kind === "clip") {
      animation.phaseAtStart = animation.lastProgress.progress;
      animation.startedAt = frameTime;
      animation.direction = animation.direction === 1 ? -1 : 1;
      animation.transitionStartedAt = frameTime;
      for (const entry of animation.entries) entry.from = entry.runtime.value;
    } else {
      animation.targetSide = animation.targetSide === 1 ? 0 : 1;
      let maximumDistanceRatio = 0;
      for (const entry of animation.entries) {
        const target = animation.targetSide === 1 ? entry.endpointB : entry.endpointA;
        const endpointDistance = Math.abs(entry.endpointB - entry.endpointA);
        const distanceRatio = endpointDistance > 0
          ? Math.abs(target - entry.runtime.value) / endpointDistance
          : 0;
        maximumDistanceRatio = Math.max(maximumDistanceRatio, distanceRatio);
        entry.from = entry.runtime.value;
        entry.target = target;
      }
      animation.durationMs = normalizedDurationMs(animation.baseDurationMs * maximumDistanceRatio);
      animation.direction = 1;
      animation.phaseAtStart = 0;
      animation.startedAt = frameTime;
    }
    animation.lastProgress = resolveAnimationProgress(
      0,
      animation.durationMs,
      animation.request.loop,
      animation.direction,
      animation.phaseAtStart,
    );
    requestRender();
    return true;
  };

  const redirect = (request: JointAnimationRequest, frameTime = now()) => {
    if (request.reverseFromId !== undefined && activeAnimation?.request.id === request.reverseFromId) {
      if (reverse(frameTime) && activeAnimation) {
        activeAnimation.request = request;
        return;
      }
    }
    if (request.reverseFromId !== undefined) {
      activeAnimation = null;
      onComplete(request.id);
      requestRender();
      return;
    }

    let previousPhase: number | null = null;
    if (activeAnimation) {
      update(frameTime);
      if (activeAnimation?.request.kind === "clip" && request.kind === "clip") {
        previousPhase = activeAnimation.lastProgress.progress;
      }
    }

    const entries = animationJointIds(request).flatMap((jointId) => {
      const runtime = jointRuntimeById.get(jointId);
      if (!runtime) return [];
      const range = request.jointRanges?.[jointId];
      const initialValue = activeAnimation
        ? runtime.value
        : request.initialJointValues?.[jointId] ?? runtime.value;
      const from = clampJointValue(initialValue, range, runtime.value);
      const target = request.kind === "pose"
        ? clampJointValue(request.jointValues?.[jointId] ?? from, range, from)
        : from;
      runtime.value = from;
      return [{
        endpointA: from,
        endpointB: target,
        from,
        jointId,
        runtime,
        target,
      }];
    });
    if (entries.length === 0) {
      activeAnimation = null;
      onComplete(request.id);
      requestRender();
      return;
    }

    const durationMs = normalizedDurationMs(request.durationMs);
    const direction = request.kind === "clip" ? request.playbackDirection ?? 1 : 1;
    const phaseAtStart = request.kind === "clip"
      ? clampUnit(request.initialProgress ?? previousPhase ?? (direction === -1 ? 1 : 0))
      : 0;
    activeAnimation = {
      baseDurationMs: durationMs,
      direction,
      durationMs,
      entries,
      lastProgress: resolveAnimationProgress(0, durationMs, request.loop, direction, phaseAtStart),
      phaseAtStart,
      request,
      startedAt: frameTime,
      targetSide: 1,
      transitionDurationMs: request.kind === "clip"
        ? Math.min(durationMs, Math.max(0, request.transitionMs ?? 0))
        : 0,
      transitionStartedAt: frameTime,
    };
    for (const entry of entries) applyJointValue(entry, entry.from, request);
    requestRender();
  };

  const play = (request: JointAnimationRequest | null, frameTime = now()) => {
    if (!request) {
      cancel(frameTime);
      return;
    }
    redirect(request, frameTime);
  };

  return {
    get active() {
      return Boolean(activeAnimation);
    },
    get progress() {
      return activeAnimation?.lastProgress ?? null;
    },
    cancel,
    play,
    redirect,
    reverse,
    update,
  };
}
