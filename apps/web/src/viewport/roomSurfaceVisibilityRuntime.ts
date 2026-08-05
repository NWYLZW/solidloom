import type { Vector3Tuple } from "@solidloom/shared";
import * as THREE from "three";
import { roomSurfaceVisibilityForCamera } from "../roomSurfaces";
import type { RoomSurfaceRuntime } from "./modelSceneRuntime";

interface CreateRoomSurfaceVisibilityRuntimeOptions {
  camera: THREE.Camera;
  featureMeshById: Map<string, THREE.Mesh>;
  roomSurfaceMeshes: RoomSurfaceRuntime[];
}

export function createRoomSurfaceVisibilityRuntime({
  camera,
  featureMeshById,
  roomSurfaceMeshes,
}: CreateRoomSurfaceVisibilityRuntimeOptions) {
  const cameraPosition = new THREE.Vector3();
  const inverseWorldMatrix = new THREE.Matrix4();
  const localCameraPosition = new THREE.Vector3();

  return {
    update() {
      let visibilityChanged = false;
      camera.getWorldPosition(cameraPosition);

      for (const { mesh, source, materials } of roomSurfaceMeshes) {
        mesh.updateWorldMatrix(true, false);
        localCameraPosition
          .copy(cameraPosition)
          .applyMatrix4(inverseWorldMatrix.copy(mesh.matrixWorld).invert());
        const surfaceVisibility = roomSurfaceVisibilityForCamera(
          source,
          localCameraPosition.toArray() as Vector3Tuple,
        );

        materials.forEach((material, index) => {
          const visible = surfaceVisibility[index] ?? true;
          if (material.visible !== visible) visibilityChanged = true;
          material.visible = visible;
        });

        const roomFeatureId = String(mesh.userData.featureId ?? "");
        const roomFeatureSuffix = "cyber-room-shell";
        if (!roomFeatureId.endsWith(roomFeatureSuffix)) continue;
        const roomFeaturePrefix = roomFeatureId.slice(0, -roomFeatureSuffix.length);

        for (const [featureId, featureMesh] of featureMeshById) {
          if (!featureId.startsWith(roomFeaturePrefix)) continue;
          const isWindowPart = featureId.endsWith("cyber-room-window-glass")
            || featureId.endsWith("cyber-room-window-frame-left")
            || featureId.endsWith("cyber-room-window-frame-right");
          const isDoorPart = featureId.endsWith("cyber-room-door")
            || featureId.endsWith("cyber-room-door-handle");
          const visible = isWindowPart
            ? surfaceVisibility[3]
            : isDoorPart
              ? surfaceVisibility[4]
              : undefined;
          if (visible === undefined) continue;
          if (featureMesh.visible !== visible) visibilityChanged = true;
          featureMesh.visible = visible;
        }
      }

      return visibilityChanged;
    },
  };
}
