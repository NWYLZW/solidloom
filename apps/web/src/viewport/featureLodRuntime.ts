import * as THREE from "three";
import type { FeatureLodEntry } from "./modelSceneRuntime";

interface CreateFeatureLodRuntimeOptions {
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
  entries: FeatureLodEntry[];
  isFeatureSelected: (featureId: string) => boolean;
}

export function createFeatureLodRuntime({
  camera,
  container,
  entries,
  isFeatureSelected,
}: CreateFeatureLodRuntimeOptions) {
  const worldPosition = new THREE.Vector3();
  const worldScale = new THREE.Vector3();

  return {
    update() {
      let changed = false;
      const focalScale = Math.max(1, container.clientHeight)
        / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

      for (const entry of entries) {
        entry.mesh.getWorldPosition(worldPosition);
        entry.mesh.getWorldScale(worldScale);
        const distance = Math.max(1, camera.position.distanceTo(worldPosition));
        const worldRadius = entry.localRadius * Math.max(
          Math.abs(worldScale.x),
          Math.abs(worldScale.y),
          Math.abs(worldScale.z),
        );
        const projectedRadius = worldRadius / distance * focalScale;
        const targetGeometry = !isFeatureSelected(entry.featureId) && projectedRadius < 10
          ? entry.reducedGeometry
          : entry.fullGeometry;
        if (entry.mesh.geometry === targetGeometry) continue;
        entry.mesh.geometry = targetGeometry;
        changed = true;
      }

      return changed;
    },
  };
}
