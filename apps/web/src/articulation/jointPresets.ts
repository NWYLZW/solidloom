import type { ArticulationJoint } from "@solidloom/shared";

export interface JointPresetValues {
  closed: number;
  expanded: number;
  half: number;
}

export function jointPresetValues(joint: Pick<ArticulationJoint, "max" | "min">): JointPresetValues {
  return {
    closed: joint.min,
    expanded: joint.max,
    half: joint.min + (joint.max - joint.min) / 2,
  };
}
