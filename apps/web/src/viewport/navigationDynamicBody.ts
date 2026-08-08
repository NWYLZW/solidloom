import * as THREE from "three";
import type { NavigationObstacle } from "../navigation";

export interface NavigationMeshCollisionObstacle {
  mesh: THREE.Mesh;
  obstacle: NavigationObstacle;
}

function updateObstacleFromMesh(
  collision: NavigationMeshCollisionObstacle,
  bounds: THREE.Box3,
) {
  bounds.setFromObject(collision.mesh);
  collision.obstacle.minX = bounds.min.x;
  collision.obstacle.maxX = bounds.max.x;
  collision.obstacle.minY = bounds.min.y;
  collision.obstacle.maxY = bounds.max.y;
  collision.obstacle.minZ = bounds.min.z;
  collision.obstacle.maxZ = bounds.max.z;
}

export function collectNavigationMeshCollisionObstacles(object: THREE.Object3D) {
  const collisions: NavigationMeshCollisionObstacle[] = [];
  const bounds = new THREE.Box3();
  object.updateWorldMatrix(true, true);
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.userData.feature) return;
    const collision: NavigationMeshCollisionObstacle = {
      mesh: child,
      obstacle: {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        minZ: 0,
        maxZ: 0,
      },
    };
    updateObstacleFromMesh(collision, bounds);
    collisions.push(collision);
  });
  return collisions;
}

export function updateNavigationMeshCollisionObstacles(
  collisions: NavigationMeshCollisionObstacle[],
  bounds = new THREE.Box3(),
) {
  for (const collision of collisions) updateObstacleFromMesh(collision, bounds);
}
