import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createNavigationAvatar,
  resolveNavigationAvatarDimensions,
} from "../apps/web/src/navigationAvatar";

describe("navigation avatar", () => {
  it("uses one cubic voxel scale for every avatar axis", () => {
    expect(resolveNavigationAvatarDimensions(1720)).toEqual({
      height: 1720,
      pixelSize: 53.75,
      width: 860,
    });
  });

  it("bends at the hips and knees when seated", () => {
    const avatar = createNavigationAvatar({ agentHeight: 320 });
    try {
      avatar.update(0, true, 1);
      const leftHip = avatar.object.getObjectByName("左髋关节");
      const rightHip = avatar.object.getObjectByName("右髋关节");
      const leftKnee = avatar.object.getObjectByName("左膝关节");
      const rightKnee = avatar.object.getObjectByName("右膝关节");

      expect(leftHip?.rotation.x).toBeCloseTo(-Math.PI / 2, 3);
      expect(rightHip?.rotation.x).toBeCloseTo(-Math.PI / 2, 3);
      expect(leftKnee?.rotation.x).toBeCloseTo(Math.PI / 2, 3);
      expect(rightKnee?.rotation.x).toBeCloseTo(Math.PI / 2, 3);

      const lowerLeg = avatar.object.getObjectByName("左小腿");
      avatar.object.updateWorldMatrix(true, true);
      const lowerLegRotation = lowerLeg?.getWorldQuaternion(new THREE.Quaternion());
      const lowerLegDirection = new THREE.Vector3(0, -1, 0)
        .applyQuaternion(lowerLegRotation ?? new THREE.Quaternion());
      expect(lowerLegDirection.y).toBeLessThan(-0.999);
    } finally {
      avatar.dispose();
    }
  });
});
