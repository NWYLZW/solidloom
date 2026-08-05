import * as THREE from "three";
import type { NavigationObstacle } from "../navigation";

export interface NavigationSeatPose {
  position: THREE.Vector3;
  rotationY: number;
}

interface ResolveNavigationSeatPoseOptions {
  agentHeight: number;
  fallbackFloorY: number;
  object: THREE.Object3D;
  obstacle: NavigationObstacle;
  targetMeshes: THREE.Mesh[];
}

export interface NavigationSeatPoseResolver {
  resolve: (options: ResolveNavigationSeatPoseOptions) => NavigationSeatPose;
}

export function createNavigationSeatPoseResolver(): NavigationSeatPoseResolver {
  const bounds = new THREE.Box3();
  const center = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const pose: NavigationSeatPose = { position, rotationY: 0 };

  return {
    resolve: ({ agentHeight, fallbackFloorY, object, obstacle, targetMeshes }) => {
      object.updateWorldMatrix(true, true);
      bounds.makeEmpty();
      for (const mesh of targetMeshes) bounds.expandByObject(mesh);

      if (bounds.isEmpty()) {
        center.set(
          (obstacle.minX + obstacle.maxX) / 2,
          fallbackFloorY + agentHeight * 0.37,
          (obstacle.minZ + obstacle.maxZ) / 2,
        );
      } else {
        bounds.getCenter(center);
        // 方块角色的髋关节位于根节点下方 4 个像素；坐下时大腿
        // 横放后的半厚度为 2 个像素，因此根节点应高于座面 6 个像素。
        center.y = bounds.max.y + agentHeight * 6 / 32;
      }

      object.getWorldQuaternion(quaternion);
      forward.set(0, 0, 1).applyQuaternion(quaternion).setY(0);
      pose.rotationY = forward.lengthSq() < 0.0001
        ? object.rotation.y
        : Math.atan2(forward.x, forward.z);
      pose.position.copy(center);
      return pose;
    },
  };
}
