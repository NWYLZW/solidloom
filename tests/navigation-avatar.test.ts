import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createNavigationAvatar,
  resolveMinecraftFirstPersonArmTransform,
  resolveNavigationAvatarPresentation,
  resolveNavigationAvatarDimensions,
} from "../apps/web/src/navigationAvatar";

function materialOpacities(object: THREE.Object3D, name: string) {
  const mesh = object.getObjectByName(name) as THREE.Mesh | undefined;
  if (!mesh) return [];
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.map((material) => material.opacity);
}

function expectMaterialOpacity(object: THREE.Object3D, name: string, opacity: number) {
  const opacities = materialOpacities(object, name);
  expect(opacities.length).toBeGreaterThan(0);
  opacities.forEach((value) => expect(value).toBe(opacity));
}

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

  it("crossfades from hands to the body while looking down in automatic mode", () => {
    expect(resolveNavigationAvatarPresentation("automatic", 0)).toEqual({
      bodyOpacity: 0,
      handsOpacity: 1,
    });
    const transition = resolveNavigationAvatarPresentation("automatic", THREE.MathUtils.degToRad(-32.5));
    expect(transition.bodyOpacity).toBeCloseTo(0.5);
    expect(transition.handsOpacity).toBeCloseTo(0.5);
    expect(resolveNavigationAvatarPresentation("automatic", THREE.MathUtils.degToRad(-60))).toEqual({
      bodyOpacity: 1,
      handsOpacity: 0,
    });
  });

  it("switches between body, hands, hidden, and world presentations", () => {
    const avatar = createNavigationAvatar({ agentHeight: 320 });
    try {
      avatar.setPresentation(true, "body", 0);
      expectMaterialOpacity(avatar.object, "躯干", 1);
      expectMaterialOpacity(avatar.object, "头部", 0);
      expect(avatar.firstPersonObject.visible).toBe(false);

      avatar.setPresentation(true, "hands", 0);
      expectMaterialOpacity(avatar.object, "躯干", 0);
      expectMaterialOpacity(avatar.firstPersonObject, "第一人称主手", 1);
      expect(avatar.firstPersonObject.visible).toBe(true);
      const mainHand = avatar.firstPersonObject.getObjectByName("第一人称主手") as THREE.Mesh | undefined;
      expect(avatar.firstPersonObject.scale.toArray()).toEqual([160, 160, 160]);
      expect(mainHand?.position.toArray()).toEqual([-0.375, 0.375, 0]);
      expect(mainHand?.scale.toArray()).toEqual([1, -1, 1]);
      expect(mainHand?.layers.isEnabled(1)).toBe(true);
      const mainHandMaterials = Array.isArray(mainHand?.material) ? mainHand.material : [mainHand?.material];
      expect(mainHandMaterials.every((material) => material?.depthTest)).toBe(true);
      expect(avatar.firstPersonObject.getObjectByName("第一人称左手")).toBeUndefined();

      avatar.setPresentation(true, "hidden", 0);
      expect(avatar.firstPersonObject.visible).toBe(false);

      avatar.setPresentation(false, "hidden", 0);
      expectMaterialOpacity(avatar.object, "躯干", 1);
      expectMaterialOpacity(avatar.object, "头部", 1);

      avatar.setOpacity(0.5, 0);
      expectMaterialOpacity(avatar.object, "躯干", 0.5);
      expectMaterialOpacity(avatar.object, "头部", 0.5);

      avatar.setPresentation(true, "body", 0);
      expectMaterialOpacity(avatar.object, "躯干", 1);
      expectMaterialOpacity(avatar.object, "头部", 0);

      avatar.setPresentation(false, "body", 0);
      expectMaterialOpacity(avatar.object, "躯干", 0.5);
      expectMaterialOpacity(avatar.object, "头部", 0.5);
    } finally {
      avatar.dispose();
    }
  });

  it("uses Minecraft's first-person empty-hand matrix chain", () => {
    const idle = resolveMinecraftFirstPersonArmTransform();
    const center = new THREE.Vector3(-0.375, 0.375, 0).applyMatrix4(idle);
    expect(center.toArray()).toEqual([
      expect.closeTo(0.6103512705, 8),
      expect.closeTo(-0.6552730525, 8),
      expect.closeTo(-0.8318813178, 8),
    ]);

    const swinging = resolveMinecraftFirstPersonArmTransform({ swingProgress: 0.5 });
    expect(swinging.equals(idle)).toBe(false);
  });

  it("resolves eye height from the avatar root so seated poses follow the seat", () => {
    const avatar = createNavigationAvatar({ agentHeight: 320 });
    try {
      avatar.object.position.set(30, 180, -45);
      avatar.object.updateWorldMatrix(true, true);
      expect(avatar.getEyePosition(new THREE.Vector3()).toArray()).toEqual([30, 295.2, -3]);
    } finally {
      avatar.dispose();
    }
  });
});
