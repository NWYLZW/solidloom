import * as THREE from "three";
import type { ArticulationJoint } from "@solidloom/shared";

interface JointSceneRuntime {
  content: THREE.Group;
}

/**
 * Parents a child joint beneath its upstream joint while keeping every pivot in
 * model coordinates. This lets the elbow follow the shoulder and the knee
 * follow the hip without duplicating features across tree groups.
 */
export function attachJointHierarchy(
  joints: ArticulationJoint[],
  featureGroupById: Map<string, THREE.Group>,
  jointRuntimeById: Map<string, JointSceneRuntime>,
): void {
  const jointById = new Map(joints.map((joint) => [joint.id, joint]));

  for (const joint of joints) {
    if (!joint.parentJointId || joint.parentJointId === joint.id) continue;
    const parentJoint = jointById.get(joint.parentJointId);
    const parentRuntime = jointRuntimeById.get(joint.parentJointId);
    const childGroup = featureGroupById.get(joint.groupId);
    if (!parentJoint || !parentRuntime || !childGroup) continue;

    childGroup.removeFromParent();
    childGroup.position.sub(new THREE.Vector3(...parentJoint.pivot));
    parentRuntime.content.add(childGroup);
  }
}
