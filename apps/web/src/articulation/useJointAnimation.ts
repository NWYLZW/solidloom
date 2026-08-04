import { useRef, useState } from "react";
import type { ArticulationAnimationClip, ArticulationJoint } from "@solidloom/shared";
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

  const start = (jointValues: Record<string, number>, durationMs: number, joints: ArticulationJoint[]) => {
    const jointById = new Map(joints.map((joint) => [joint.id, joint]));
    const clampedValues = Object.fromEntries(Object.entries(jointValues).flatMap(([jointId, value]) => {
      const joint = jointById.get(jointId);
      return joint ? [[jointId, clamp(value, joint.min, joint.max)]] : [];
    }));
    if (Object.keys(clampedValues).length === 0) return;
    const nextRequest: JointAnimationRequest = {
      durationMs: clamp(durationMs, 100, 10_000),
      id: nextIdRef.current + 1,
      kind: "pose",
      jointValues: clampedValues,
      loop: false,
    };
    nextIdRef.current = nextRequest.id;
    requestRef.current = nextRequest;
    setRequest(nextRequest);
  };

  const startClip = (
    clip: ArticulationAnimationClip,
    joints: ArticulationJoint[],
    options: { transitionMs?: number } = {},
  ) => {
    const jointById = new Map(joints.map((joint) => [joint.id, joint]));
    const keyframes = clip.keyframes.map((keyframe) => ({
      offset: keyframe.offset,
      jointValues: Object.fromEntries(Object.entries(keyframe.jointValues).flatMap(([jointId, value]) => {
        const joint = jointById.get(jointId);
        return joint ? [[jointId, clamp(value, joint.min, joint.max)]] : [];
      })),
    })).filter((keyframe) => Object.keys(keyframe.jointValues).length > 0);
    if (keyframes.length < 2) return;
    const nextRequest: JointAnimationRequest = {
      durationMs: clamp(clip.durationMs, 100, 60_000),
      id: nextIdRef.current + 1,
      keyframes,
      kind: "clip",
      loop: clip.loop,
      sourceId: clip.id,
      transitionMs: clamp(options.transitionMs ?? 320, 0, 3_000),
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
    if (current.kind === "pose" && current.jointValues) onCommitRef.current(current.jointValues);
  };

  return {
    activeClipId: request?.kind === "clip" ? request.sourceId ?? null : null,
    cancel,
    complete,
    request,
    start,
    startClip,
  };
}
