import type { ArticulationAnimationKeyframe } from "@solidloom/shared";

export interface JointValueRange {
  max: number;
  min: number;
}

export type JointAnimationDirection = 1 | -1;

export interface JointAnimationRequest {
  /** Duration of one pose transition or clip cycle. */
  durationMs: number;
  id: number;
  kind: "pose" | "clip";
  /** Values supplied by a model-reference instance before animation starts. */
  initialJointValues?: Record<string, number>;
  /** Normalized starting phase; reverse clips default to 1. */
  initialProgress?: number;
  jointValues?: Record<string, number>;
  /** Runtime-only validation boundaries copied from the model joints. */
  jointRanges?: Record<string, JointValueRange>;
  keyframes?: ArticulationAnimationKeyframe[];
  loop: boolean;
  playbackDirection?: JointAnimationDirection;
  /** Reverses the currently active request without recreating its endpoints. */
  reverseFromId?: number;
  /** Correlation only; the presentation runtime never mutates semantic action state. */
  semanticActionId?: string;
  sourceId?: string;
  transitionMs?: number;
}

export interface JointAnimationProgress {
  completed: boolean;
  cycle: number;
  direction: JointAnimationDirection;
  elapsedMs: number;
  progress: number;
}
