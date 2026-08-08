import * as THREE from "three";

interface ResolveNavigationCameraPositionOptions {
  clearance: number;
  idealPosition: THREE.Vector3;
  output: THREE.Vector3;
  target: THREE.Vector3;
}

interface CameraCollisionProxy {
  proxy: THREE.Mesh;
  source: THREE.Mesh;
}

export interface NavigationCameraCollisionRuntime {
  dispose: () => void;
  resolvePosition: (options: ResolveNavigationCameraPositionOptions) => THREE.Vector3;
}

export function createNavigationCameraCollisionRuntime(
  featureMeshes: Iterable<THREE.Mesh>,
): NavigationCameraCollisionRuntime {
  const collisionMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const proxies: CameraCollisionProxy[] = Array.from(featureMeshes, (source) => {
    const proxy = new THREE.Mesh(source.geometry, collisionMaterial);
    proxy.matrixAutoUpdate = false;
    return { proxy, source };
  });
  const proxyMeshes = proxies.map(({ proxy }) => proxy);
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3();

  return {
    resolvePosition({ clearance, idealPosition, output, target }) {
      direction.subVectors(idealPosition, target);
      const idealDistance = direction.length();
      output.copy(idealPosition);
      if (idealDistance <= 0.0001 || proxies.length === 0) return output;

      for (const { proxy, source } of proxies) {
        source.updateWorldMatrix(true, false);
        proxy.geometry = source.geometry;
        proxy.matrixWorld.copy(source.matrixWorld);
      }

      direction.multiplyScalar(1 / idealDistance);
      raycaster.set(target, direction);
      raycaster.near = 0;
      raycaster.far = idealDistance;
      const hit = raycaster.intersectObjects(proxyMeshes, false)[0];
      if (!hit) return output;

      const resolvedDistance = Math.max(0, Math.min(idealDistance, hit.distance - clearance));
      return output.copy(target).addScaledVector(direction, resolvedDistance);
    },
    dispose() {
      collisionMaterial.dispose();
    },
  };
}
