import type { ArticulationAnimationKeyframe } from "@solidloom/shared";

export interface JointAnimationRequest {
  durationMs: number;
  id: number;
  kind: "pose" | "clip";
  jointValues?: Record<string, number>;
  keyframes?: ArticulationAnimationKeyframe[];
  loop: boolean;
  sourceId?: string;
  transitionMs?: number;
}
