import type {
  ArticulationJoint,
  FeatureGroup,
  ModelFeature,
  RoomShellSource,
} from "@solidloom/shared";
import * as THREE from "three";
import { attachJointHierarchy } from "../articulation/jointHierarchy";
import {
  createFeatureMaterial,
  createFeatureMaterialSet,
  disposeFeatureMaterial,
} from "../featureMaterials";
import { createFeatureGeometry, featureGeometryCacheKey } from "../meshOperations";
import { featureShadowPolicy } from "../renderPerformance";
import { resolveVoxelSkinOverlayDimensions } from "../voxelSkin";

export interface JointRuntime {
  axis: THREE.Vector3;
  content: THREE.Group;
  restValue: number;
  value: number;
}

export interface FeatureLodEntry {
  featureId: string;
  fullGeometry: THREE.BufferGeometry;
  localRadius: number;
  mesh: THREE.Mesh;
  reducedGeometry: THREE.BufferGeometry;
}

export interface RoomSurfaceRuntime {
  materials: THREE.MeshStandardMaterial[];
  mesh: THREE.Mesh;
  source: RoomShellSource;
}

export interface ModelSceneRuntime {
  dispose: () => void;
  featureGroup: THREE.Group;
  featureGroupById: Map<string, THREE.Group>;
  featureLodById: Map<string, FeatureLodEntry>;
  featureLodEntries: FeatureLodEntry[];
  featureMeshById: Map<string, THREE.Mesh>;
  groupIdByFeatureId: Map<string, string>;
  jointRuntimeById: Map<string, JointRuntime>;
  roomSurfaceMeshes: RoomSurfaceRuntime[];
}

interface CreateModelSceneRuntimeOptions {
  features: ModelFeature[];
  groups: FeatureGroup[];
  joints: ArticulationJoint[];
  requestRender: () => void;
  scene: THREE.Scene;
}

export function createModelSceneRuntime({
  features,
  groups,
  joints,
  requestRender,
  scene,
}: CreateModelSceneRuntimeOptions): ModelSceneRuntime {
  const featureGroup = new THREE.Group();
  scene.add(featureGroup);
  const featureGroupById = new Map<string, THREE.Group>();
  const featureGroupContentById = new Map<string, THREE.Group>();
  const featureMeshById = new Map<string, THREE.Mesh>();
  const jointRuntimeById = new Map<string, JointRuntime>();
  const roomSurfaceMeshes: RoomSurfaceRuntime[] = [];
  const groupIdByFeatureId = new Map<string, string>();
  const jointByGroupId = new Map(joints.map((joint) => [joint.groupId, joint]));
  const primitiveGeometryCache = new Map<string, THREE.BufferGeometry>();
  const reducedGeometryCache = new Map<string, THREE.BufferGeometry>();
  const featureLodEntries: FeatureLodEntry[] = [];
  const featureLodById = new Map<string, FeatureLodEntry>();

  for (const group of groups) {
    const groupObject = new THREE.Group();
    groupObject.position.set(...group.position);
    groupObject.rotation.set(
      THREE.MathUtils.degToRad(group.rotation[0]),
      THREE.MathUtils.degToRad(group.rotation[1]),
      THREE.MathUtils.degToRad(group.rotation[2]),
    );
    groupObject.scale.set(...(group.scale ?? [1, 1, 1]));
    groupObject.userData.groupId = group.id;
    featureGroup.add(groupObject);
    featureGroupById.set(group.id, groupObject);
    const joint = jointByGroupId.get(group.id);
    if (joint) {
      const jointContent = new THREE.Group();
      const axis = new THREE.Vector3(...joint.axis);
      jointContent.position.set(...joint.pivot);
      if (axis.lengthSq() > 0.000001) {
        jointContent.setRotationFromAxisAngle(
          axis.normalize(),
          THREE.MathUtils.degToRad(joint.value - joint.restValue),
        );
      }
      groupObject.add(jointContent);
      featureGroupContentById.set(group.id, jointContent);
      jointRuntimeById.set(joint.id, {
        axis: axis.normalize(),
        content: jointContent,
        restValue: joint.restValue,
        value: joint.value,
      });
    } else {
      featureGroupContentById.set(group.id, groupObject);
    }
    for (const featureId of group.featureIds) groupIdByFeatureId.set(featureId, group.id);
  }
  attachJointHierarchy(joints, featureGroupById, jointRuntimeById);

  for (const feature of features) {
    const geometryKey = featureGeometryCacheKey(feature);
    let geometry = geometryKey ? primitiveGeometryCache.get(geometryKey) : undefined;
    if (!geometry) {
      geometry = createFeatureGeometry(feature);
      if (geometryKey) primitiveGeometryCache.set(geometryKey, geometry);
    }
    const featureMaterialSet = createFeatureMaterialSet(feature, requestRender);
    const featureMaterial = featureMaterialSet.base;
    const baseMaterial = Array.isArray(featureMaterial)
      ? featureMaterial[0] ?? createFeatureMaterial(feature)
      : featureMaterial;
    const roomSource = feature.type === "mesh" && feature.parameters.source?.kind === "room-shell"
      ? feature.parameters.source
      : null;
    const roomMaterials = roomSource
      ? Array.from({ length: 6 }, () => baseMaterial.clone())
      : null;
    if (roomMaterials) {
      baseMaterial.dispose();
      geometry.clearGroups();
      const roomSurfaceIndexCounts = [36, 36, 36, roomSource!.window.fullWall ? 0 : 144, 108, 36];
      let groupStart = 0;
      roomSurfaceIndexCounts.forEach((count, index) => {
        geometry.addGroup(groupStart, count, index);
        groupStart += count;
      });
    }
    const mesh = new THREE.Mesh(geometry, roomMaterials ?? featureMaterial);
    mesh.position.set(...feature.position);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(feature.rotation[0]),
      THREE.MathUtils.degToRad(feature.rotation[1]),
      THREE.MathUtils.degToRad(feature.rotation[2]),
    );
    mesh.scale.set(...(feature.scale ?? [1, 1, 1]));
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const shadowPolicy = featureShadowPolicy(
      feature,
      geometry.boundingSphere?.radius ?? Number.POSITIVE_INFINITY,
    );
    mesh.castShadow = shadowPolicy.cast;
    mesh.receiveShadow = shadowPolicy.receive;
    mesh.userData.featureId = feature.id;
    mesh.userData.feature = feature;
    const overlayDimensions = resolveVoxelSkinOverlayDimensions(feature);
    if (overlayDimensions && featureMaterialSet.overlay) {
      const overlayGeometry = new THREE.BoxGeometry(...overlayDimensions);
      const overlayMesh = new THREE.Mesh(overlayGeometry, featureMaterialSet.overlay);
      overlayMesh.name = `${feature.id}:皮肤外层`;
      overlayMesh.castShadow = false;
      overlayMesh.receiveShadow = shadowPolicy.receive;
      overlayMesh.userData.featureId = feature.id;
      overlayMesh.userData.feature = feature;
      overlayMesh.userData.voxelSkinOverlay = true;
      mesh.add(overlayMesh);
    }
    featureMeshById.set(feature.id, mesh);
    if (feature.type === "cylinder") {
      const reducedGeometryKey = featureGeometryCacheKey(feature, "reduced")!;
      let reducedGeometry = reducedGeometryCache.get(reducedGeometryKey);
      if (!reducedGeometry) {
        reducedGeometry = createFeatureGeometry(feature, "reduced");
        reducedGeometryCache.set(reducedGeometryKey, reducedGeometry);
      }
      const lodEntry: FeatureLodEntry = {
        featureId: feature.id,
        fullGeometry: geometry,
        localRadius: geometry.boundingSphere?.radius ?? 1,
        mesh,
        reducedGeometry,
      };
      featureLodEntries.push(lodEntry);
      featureLodById.set(feature.id, lodEntry);
    }
    if (roomSource && roomMaterials) roomSurfaceMeshes.push({ mesh, source: roomSource, materials: roomMaterials });
    const parentGroupId = groupIdByFeatureId.get(feature.id);
    const parentGroup = parentGroupId ? featureGroupContentById.get(parentGroupId) : null;
    const parentJoint = parentGroupId ? jointByGroupId.get(parentGroupId) : null;
    if (parentJoint) mesh.position.sub(new THREE.Vector3(...parentJoint.pivot));
    (parentGroup ?? featureGroup).add(mesh);
  }

  return {
    featureGroup,
    featureGroupById,
    featureLodById,
    featureLodEntries,
    featureMeshById,
    groupIdByFeatureId,
    jointRuntimeById,
    roomSurfaceMeshes,
    dispose: () => {
      const disposedGeometries = new Set<THREE.BufferGeometry>();
      const disposedMaterials = new Set<THREE.Material>();
      featureGroup.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (!disposedGeometries.has(child.geometry)) {
          child.geometry.dispose();
          disposedGeometries.add(child.geometry);
        }
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (disposedMaterials.has(material)) continue;
          disposeFeatureMaterial(material);
          disposedMaterials.add(material);
        }
      });
      for (const geometry of [...primitiveGeometryCache.values(), ...reducedGeometryCache.values()]) {
        if (disposedGeometries.has(geometry)) continue;
        geometry.dispose();
        disposedGeometries.add(geometry);
      }
      featureGroup.removeFromParent();
    },
  };
}
