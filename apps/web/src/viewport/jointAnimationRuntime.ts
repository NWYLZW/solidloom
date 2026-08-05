import * as THREE from "three";
import { easeInOutCubic, sampleAnimationJointValue } from "../articulation/runtime";
import type { JointAnimationRequest } from "../articulation/types";
import type { JointRuntime } from "./modelSceneRuntime";

interface ActiveJointAnimation {
  durationMs: number;
  entries: Array<{
    from: number;
    jointId: string;
    runtime: JointRuntime;
  }>;
  request: JointAnimationRequest;
  startedAt: number;
  transitionDurationMs: number;
  transitionStartedAt: number;
}

export interface JointAnimationRuntime {
  readonly active: boolean;
  play: (request: JointAnimationRequest | null) => void;
  update: (frameTime: number) => void;
}

export function createJointAnimationRuntime(
  jointRuntimeById: Map<string, JointRuntime>,
  onComplete: (animationId: number) => void,
  requestRender: () => void,
): JointAnimationRuntime {
  let activeAnimation: ActiveJointAnimation | null = null;

  const play = (request: JointAnimationRequest | null) => {
    requestRender();
    if (!request) {
      activeAnimation = null;
      return;
    }
    const jointIds = request.kind === "pose"
      ? Object.keys(request.jointValues ?? {})
      : [...new Set((request.keyframes ?? []).flatMap((keyframe) => Object.keys(keyframe.jointValues)))];
    const entries = jointIds.flatMap((jointId) => {
      const runtime = jointRuntimeById.get(jointId);
      return runtime ? [{ from: runtime.value, jointId, runtime }] : [];
    });
    if (entries.length === 0) {
      onComplete(request.id);
      return;
    }
    const now = performance.now();
    const durationMs = Math.max(100, request.durationMs);
    const previousPhase = request.kind === "clip" && activeAnimation?.request.kind === "clip"
      ? (() => {
          const elapsedProgress = (now - activeAnimation.startedAt) / activeAnimation.durationMs;
          return activeAnimation.request.loop
            ? ((elapsedProgress % 1) + 1) % 1
            : THREE.MathUtils.clamp(elapsedProgress, 0, 1);
        })()
      : 0;
    activeAnimation = {
      durationMs,
      entries,
      request,
      startedAt: request.kind === "clip" ? now - previousPhase * durationMs : now,
      transitionDurationMs: request.kind === "clip" ? Math.max(0, request.transitionMs ?? 0) : 0,
      transitionStartedAt: now,
    };
  };

  const update = (frameTime: number) => {
    const animation = activeAnimation;
    if (!animation) return;
    const elapsedProgress = (frameTime - animation.startedAt) / animation.durationMs;
    const request = animation.request;
    const progress = request.loop
      ? ((elapsedProgress % 1) + 1) % 1
      : THREE.MathUtils.clamp(elapsedProgress, 0, 1);
    if (request.kind === "pose") {
      const easedProgress = easeInOutCubic(progress);
      for (const entry of animation.entries) {
        const target = request.jointValues?.[entry.jointId] ?? entry.from;
        entry.runtime.value = THREE.MathUtils.lerp(entry.from, target, easedProgress);
      }
    } else {
      const keyframes = request.keyframes ?? [];
      const transitionProgress = animation.transitionDurationMs > 0
        ? easeInOutCubic((frameTime - animation.transitionStartedAt) / animation.transitionDurationMs)
        : 1;
      for (const entry of animation.entries) {
        const target = sampleAnimationJointValue(keyframes, entry.jointId, progress, entry.from, request.loop);
        entry.runtime.value = THREE.MathUtils.lerp(entry.from, target, transitionProgress);
      }
    }
    for (const entry of animation.entries) {
      entry.runtime.content.setRotationFromAxisAngle(
        entry.runtime.axis,
        THREE.MathUtils.degToRad(entry.runtime.value - entry.runtime.restValue),
      );
    }
    if (!request.loop && elapsedProgress >= 1) {
      activeAnimation = null;
      onComplete(request.id);
    }
  };

  return {
    get active() {
      return Boolean(activeAnimation);
    },
    play,
    update,
  };
}
