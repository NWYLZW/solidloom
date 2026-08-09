import { useRef, useState } from "react";
import type { ArticulationAnimationClip, ArticulationJoint } from "@solidloom/shared";
import {
  clampJointValue,
  jointRangesFromJoints,
  normalizeAnimationKeyframes,
  normalizedDurationMs,
  resolveInstanceJointValues,
} from "./runtime";
import type { JointAnimationRequest } from "./types";

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function useJointAnimation(onCommit: (jointValues: Record<string, number>) => void) {
  const [request, setRequest] = useState<JointAnimationRequest | null>(null);
  const requestRef = useRef<JointAnimationRequest | null>(null);
  const nextIdRef = useRef(0);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const cancel = () => {
    requestRef.current = null;
    setRequest(null);
  };

  const start = (
    jointValues: Record<string, number>,
    durationMs: number,
    joints: ArticulationJoint[],
    options: { initialJointValues?: Record<string, number>; semanticActionId?: string } = {},
  ) => {
    const jointById = new Map(joints.map((joint) => [joint.id, joint]));
    const jointRanges = jointRangesFromJoints(joints);
    const clampedValues = Object.fromEntries(Object.entries(jointValues).flatMap(([jointId, value]) => {
      const joint = jointById.get(jointId);
      return joint ? [[jointId, clampJointValue(value, jointRanges[jointId], joint.value)]] : [];
    }));
    if (Object.keys(clampedValues).length === 0) return;
    const nextRequest: JointAnimationRequest = {
      durationMs: clamp(normalizedDurationMs(durationMs, 420), 100, 10_000),
      id: nextIdRef.current + 1,
      ...(options.initialJointValues ? {
        initialJointValues: resolveInstanceJointValues(joints, options.initialJointValues),
      } : {}),
      jointRanges,
      kind: "pose",
      jointValues: clampedValues,
      loop: false,
      ...(options.semanticActionId ? { semanticActionId: options.semanticActionId } : {}),
    };
    nextIdRef.current = nextRequest.id;
    requestRef.current = nextRequest;
    setRequest(nextRequest);
  };

  const startClip = (
    clip: ArticulationAnimationClip,
    joints: ArticulationJoint[],
    options: {
      initialJointValues?: Record<string, number>;
      initialProgress?: number;
      semanticActionId?: string;
      transitionMs?: number;
    } = {},
  ) => {
    const jointById = new Map(joints.map((joint) => [joint.id, joint]));
    const jointRanges = jointRangesFromJoints(joints);
    const keyframes = normalizeAnimationKeyframes(clip.keyframes.map((keyframe) => ({
      offset: keyframe.offset,
      jointValues: Object.fromEntries(Object.entries(keyframe.jointValues).flatMap(([jointId, value]) => {
        const joint = jointById.get(jointId);
        return joint ? [[jointId, clampJointValue(value, jointRanges[jointId], joint.value)]] : [];
      })),
    })).filter((keyframe) => Object.keys(keyframe.jointValues).length > 0), jointRanges);
    if (keyframes.length < 2) return;
    const nextRequest: JointAnimationRequest = {
      durationMs: clamp(normalizedDurationMs(clip.durationMs, 1_000), 100, 60_000),
      id: nextIdRef.current + 1,
      ...(options.initialJointValues ? {
        initialJointValues: resolveInstanceJointValues(joints, options.initialJointValues),
      } : {}),
      ...(options.initialProgress === undefined ? {} : { initialProgress: clamp(options.initialProgress, 0, 1) }),
      jointRanges,
      keyframes,
      kind: "clip",
      loop: clip.loop,
      ...(options.semanticActionId ? { semanticActionId: options.semanticActionId } : {}),
      sourceId: clip.id,
      transitionMs: clamp(options.transitionMs ?? 320, 0, 3_000),
    };
    nextIdRef.current = nextRequest.id;
    requestRef.current = nextRequest;
    setRequest(nextRequest);
  };

  const reverse = () => {
    const current = requestRef.current;
    if (!current) return;
    const nextRequest: JointAnimationRequest = {
      ...current,
      id: nextIdRef.current + 1,
      playbackDirection: current.playbackDirection === -1 ? 1 : -1,
      reverseFromId: current.id,
    };
    nextIdRef.current = nextRequest.id;
    requestRef.current = nextRequest;
    setRequest(nextRequest);
  };

  const complete = (animationId: number) => {
    const current = requestRef.current;
    if (!current || current.id !== animationId) return;
    requestRef.current = null;
    setRequest(null);
    if (
      current.kind === "pose"
      && current.jointValues
      && current.playbackDirection !== -1
      && current.semanticActionId === undefined
    ) {
      onCommitRef.current(current.jointValues);
    }
  };

  return {
    activeClipId: request?.kind === "clip" ? request.sourceId ?? null : null,
    cancel,
    complete,
    request,
    reverse,
    start,
    startClip,
  };
}
