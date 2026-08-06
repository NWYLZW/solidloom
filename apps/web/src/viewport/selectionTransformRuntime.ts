import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { TransformCommit, TransformMode, Viewport3DProps } from "./types";
import {
  DEFAULT_TRANSFORM_CONTROL_SIZE,
  ROTATION_RING_PADDING,
  createSelectionCornerBox,
} from "./scenePrimitives";
import type { FeatureLodEntry } from "./modelSceneRuntime";

export interface SelectionTransformRuntime {
  applyCutPlane: (
    plane: Viewport3DProps["cutPlane"],
    featureIds: string[],
    groupId: string | null,
  ) => void;
  applySelection: (featureIds: string[], groupId: string | null) => void;
  applyTransformMode: (
    mode: TransformMode,
    featureIds: string[],
    groupId: string | null,
  ) => void;
  dispose: () => void;
  isFeatureSelected: (featureId: string) => boolean;
  readonly transformGestureActive: boolean;
}

interface CreateSelectionTransformRuntimeOptions {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  cornerBoxColor: THREE.ColorRepresentation;
  cutPlane: Viewport3DProps["cutPlane"];
  domElement: HTMLElement;
  featureGroupById: Map<string, THREE.Group>;
  featureLodById: Map<string, FeatureLodEntry>;
  featureMeshById: Map<string, THREE.Mesh>;
  onTransformCommit: (transforms: TransformCommit[]) => void;
  requestRender: () => void;
  scene: THREE.Scene;
  selectedFeatureIds: string[];
  selectedGroupId: string | null;
  transformMode: TransformMode;
}

interface TransformTarget {
  id: string;
  kind: "feature" | "group";
  object: THREE.Object3D;
}

export function createSelectionTransformRuntime({
  camera,
  controls,
  cornerBoxColor,
  cutPlane,
  domElement,
  featureGroupById,
  featureLodById,
  featureMeshById,
  onTransformCommit,
  requestRender,
  scene,
  selectedFeatureIds,
  selectedGroupId,
  transformMode,
}: CreateSelectionTransformRuntimeOptions): SelectionTransformRuntime {
  const selectionOutlines: THREE.LineSegments[] = [];
  const selectionCornerBoxes: THREE.Group[] = [];
  let renderedSelectedFeatureIds = new Set<string>();

  const clearSelectionDecorations = () => {
    for (const outline of selectionOutlines.splice(0)) {
      outline.parent?.remove(outline);
      outline.geometry.dispose();
      if (Array.isArray(outline.material)) outline.material.forEach((material) => material.dispose());
      else outline.material.dispose();
    }
    for (const cornerBox of selectionCornerBoxes.splice(0)) {
      cornerBox.parent?.remove(cornerBox);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      cornerBox.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        geometries.add(child.geometry);
        const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
        childMaterials.forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    }
  };

  const applySelection = (featureIds: string[], groupId: string | null) => {
    requestRender();
    clearSelectionDecorations();
    const selectedIds = new Set(featureIds);
    const changedSelectionIds = new Set([...renderedSelectedFeatureIds, ...selectedIds]);
    for (const featureId of changedSelectionIds) {
      if (renderedSelectedFeatureIds.has(featureId) === selectedIds.has(featureId)) continue;
      const mesh = featureMeshById.get(featureId);
      if (!mesh) continue;
      const isSelected = selectedIds.has(featureId);
      const lodEntry = featureLodById.get(featureId);
      if (isSelected && lodEntry) mesh.geometry = lodEntry.fullGeometry;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial) || material.wireframe) continue;
        material.emissive.setHex(isSelected ? 0x263016 : 0x000000);
        material.emissiveIntensity = isSelected ? 0.34 : 0;
      }
    }
    renderedSelectedFeatureIds = selectedIds;

    if (groupId) {
      const selectedGroupObject = featureGroupById.get(groupId);
      if (!selectedGroupObject) return;
      const selectedGroupBounds = new THREE.Box3().setFromObject(selectedGroupObject);
      const outline = new THREE.BoxHelper(selectedGroupObject, 0xd8ff45);
      outline.material.depthTest = false;
      outline.material.transparent = true;
      outline.material.opacity = 0.96;
      outline.renderOrder = 50;
      scene.add(outline);
      selectionOutlines.push(outline);
      const cornerBox = createSelectionCornerBox(selectedGroupBounds, cornerBoxColor);
      scene.add(cornerBox);
      selectionCornerBoxes.push(cornerBox);
      return;
    }

    for (const featureId of selectedIds) {
      const mesh = featureMeshById.get(featureId);
      if (!mesh) continue;
      const cornerBox = createSelectionCornerBox(new THREE.Box3().setFromObject(mesh), cornerBoxColor);
      scene.add(cornerBox);
      selectionCornerBoxes.push(cornerBox);
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 20),
        new THREE.LineBasicMaterial({
          color: 0xd8ff45,
          depthTest: false,
          opacity: 1,
          transparent: true,
        }),
      );
      outline.renderOrder = 50;
      mesh.add(outline);
      selectionOutlines.push(outline);
    }
  };

  const transformControls = new TransformControls(camera, domElement);
  transformControls.setSize(DEFAULT_TRANSFORM_CONTROL_SIZE);
  transformControls.showE = false;
  const transformHelper = transformControls.getHelper();
  scene.add(transformHelper);
  const selectionPivot = new THREE.Object3D();
  selectionPivot.name = "selection-transform-pivot";
  scene.add(selectionPivot);
  let activeTransformTargets: TransformTarget[] = [];
  let multiTransformStart: Array<{ object: THREE.Object3D; worldMatrix: THREE.Matrix4 }> = [];
  let pivotStartWorld = new THREE.Matrix4();
  let transformGestureActive = false;
  let activeTransformMode: TransformMode = null;
  let rotationTargetRadius = 0;

  const forEachWorldGeometryCorner = (
    objects: THREE.Object3D[],
    visitor: (corner: THREE.Vector3) => void,
  ) => {
    for (const object of objects) {
      object.updateMatrixWorld(true);
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.geometry.computeBoundingBox();
        const geometryBounds = child.geometry.boundingBox;
        if (!geometryBounds) return;
        for (const x of [geometryBounds.min.x, geometryBounds.max.x]) {
          for (const y of [geometryBounds.min.y, geometryBounds.max.y]) {
            for (const z of [geometryBounds.min.z, geometryBounds.max.z]) {
              visitor(new THREE.Vector3(x, y, z).applyMatrix4(child.matrixWorld));
            }
          }
        }
      });
    }
  };

  const calculateTransformCenter = (objects: THREE.Object3D[]) => {
    const center = new THREE.Vector3();
    let cornerCount = 0;
    forEachWorldGeometryCorner(objects, (corner) => {
      center.add(corner);
      cornerCount += 1;
    });
    return cornerCount > 0 ? center.divideScalar(cornerCount) : center;
  };

  const measureRotationTargetRadius = () => {
    if (!transformControls.object || activeTransformTargets.length === 0) return 0;
    transformControls.object.updateMatrixWorld(true);
    const controlOrigin = transformControls.object.getWorldPosition(new THREE.Vector3());
    let maximumRadius = 0;
    forEachWorldGeometryCorner(activeTransformTargets.map(({ object }) => object), (worldCorner) => {
      maximumRadius = Math.max(maximumRadius, controlOrigin.distanceTo(worldCorner));
    });
    return maximumRadius;
  };

  const updateTransformControlSize = () => {
    if (activeTransformMode !== "rotate" || !transformControls.object || activeTransformTargets.length === 0) {
      if (transformControls.size !== DEFAULT_TRANSFORM_CONTROL_SIZE) {
        transformControls.setSize(DEFAULT_TRANSFORM_CONTROL_SIZE);
      }
      return;
    }
    transformControls.object.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const controlOrigin = transformControls.object.getWorldPosition(new THREE.Vector3());
    if (rotationTargetRadius <= 0) return;
    const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
    const distance = Math.max(controlOrigin.distanceTo(cameraPosition), 0.001);
    const displayFactor = distance * Math.min(
      1.9 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / camera.zoom,
      7,
    );
    if (displayFactor <= 0) return;
    const nextSize = Math.max(
      DEFAULT_TRANSFORM_CONTROL_SIZE,
      rotationTargetRadius * ROTATION_RING_PADDING * 8 / displayFactor,
    );
    if (Math.abs(transformControls.size - nextSize) > 0.002) transformControls.setSize(nextSize);
  };

  const objectTransform = (target: TransformTarget): TransformCommit => ({
    id: target.id,
    kind: target.kind,
    position: [target.object.position.x, target.object.position.y, target.object.position.z],
    rotation: [
      THREE.MathUtils.radToDeg(target.object.rotation.x),
      THREE.MathUtils.radToDeg(target.object.rotation.y),
      THREE.MathUtils.radToDeg(target.object.rotation.z),
    ],
    scale: [target.object.scale.x, target.object.scale.y, target.object.scale.z],
  });

  const applyTransformMode = (mode: TransformMode, featureIds: string[], groupId: string | null) => {
    requestRender();
    transformControls.detach();
    activeTransformMode = mode;
    activeTransformTargets = [];
    rotationTargetRadius = 0;
    selectionPivot.position.set(0, 0, 0);
    selectionPivot.rotation.set(0, 0, 0);
    selectionPivot.scale.set(1, 1, 1);
    if (!mode) return;

    let target: THREE.Object3D | null = null;
    if (groupId) {
      const groupObject = featureGroupById.get(groupId);
      if (groupObject) {
        activeTransformTargets = [{ id: groupId, kind: "group", object: groupObject }];
        selectionPivot.position.copy(calculateTransformCenter([groupObject]));
        if (mode === "scale") {
          selectionPivot.quaternion.copy(groupObject.getWorldQuaternion(new THREE.Quaternion()));
        }
        selectionPivot.updateMatrixWorld(true);
        target = selectionPivot;
      }
    } else {
      activeTransformTargets = featureIds.flatMap((featureId) => {
        const object = featureMeshById.get(featureId);
        return object ? [{ id: featureId, kind: "feature" as const, object }] : [];
      });
      if (activeTransformTargets.length === 1) {
        target = activeTransformTargets[0]!.object;
      } else if (activeTransformTargets.length > 1) {
        selectionPivot.position.copy(calculateTransformCenter(activeTransformTargets.map(({ object }) => object)));
        selectionPivot.updateMatrixWorld(true);
        target = selectionPivot;
      }
    }
    if (!target) return;
    transformControls.setMode(mode);
    transformControls.setSpace(mode === "scale" ? "local" : "world");
    transformControls.attach(target);
    rotationTargetRadius = mode === "rotate" ? measureRotationTargetRadius() : 0;
    updateTransformControlSize();
  };

  const handleTransformMouseDown = () => {
    transformGestureActive = true;
    controls.enabled = false;
    if (transformControls.object !== selectionPivot) return;
    selectionPivot.updateMatrixWorld(true);
    pivotStartWorld.copy(selectionPivot.matrixWorld);
    multiTransformStart = activeTransformTargets.map(({ object }) => {
      object.updateMatrixWorld(true);
      return { object, worldMatrix: object.matrixWorld.clone() };
    });
  };
  const handleTransformChange = () => {
    requestRender();
    if (transformControls.object !== selectionPivot) return;
    selectionPivot.updateMatrixWorld(true);
    const delta = selectionPivot.matrixWorld.clone().multiply(pivotStartWorld.clone().invert());
    multiTransformStart.forEach(({ object, worldMatrix }) => {
      const nextWorld = delta.clone().multiply(worldMatrix);
      const parentInverse = object.parent?.matrixWorld.clone().invert() ?? new THREE.Matrix4();
      const localMatrix = parentInverse.multiply(nextWorld);
      localMatrix.decompose(object.position, object.quaternion, object.scale);
      object.updateMatrixWorld(true);
    });
  };
  const handleTransformMouseUp = () => {
    controls.enabled = true;
    if (activeTransformTargets.length > 0) onTransformCommit(activeTransformTargets.map(objectTransform));
    window.requestAnimationFrame(() => {
      transformGestureActive = false;
    });
  };
  transformControls.addEventListener("mouseDown", handleTransformMouseDown);
  transformControls.addEventListener("objectChange", handleTransformChange);
  transformControls.addEventListener("mouseUp", handleTransformMouseUp);
  controls.addEventListener("change", updateTransformControlSize);
  controls.addEventListener("change", requestRender);

  const cutPlaneGroup = new THREE.Group();
  scene.add(cutPlaneGroup);
  const clearCutPlane = () => {
    for (const child of [...cutPlaneGroup.children]) {
      cutPlaneGroup.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      }
    }
  };
  const applyCutPlane = (
    plane: Viewport3DProps["cutPlane"],
    featureIds: string[],
    groupId: string | null,
  ) => {
    requestRender();
    clearCutPlane();
    if (!plane) return;
    const targetObjects = groupId
      ? [featureGroupById.get(groupId)].filter((object): object is THREE.Group => Boolean(object))
      : featureIds
        .map((id) => featureMeshById.get(id))
        .filter((object): object is THREE.Mesh => Boolean(object));
    if (targetObjects.length === 0) return;
    const targetBounds = new THREE.Box3();
    targetObjects.forEach((object) => targetBounds.expandByObject(object));
    const targetCenter = targetBounds.getCenter(new THREE.Vector3());
    const targetSize = targetBounds.getSize(new THREE.Vector3());
    const planeSize = Math.max(targetSize.x, targetSize.y, targetSize.z, 1) * 1.65;
    const normal = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(plane.rotation[0]),
      THREE.MathUtils.degToRad(plane.rotation[1]),
      THREE.MathUtils.degToRad(plane.rotation[2]),
      "XYZ",
    )).normalize();
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const material = new THREE.MeshBasicMaterial({
      color: 0x52d3c5,
      depthWrite: false,
      opacity: 0.22,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const planeMesh = new THREE.Mesh(geometry, material);
    planeMesh.position.copy(targetCenter).addScaledVector(normal, plane.offset);
    planeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    planeMesh.renderOrder = 40;
    cutPlaneGroup.add(planeMesh);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0x7ff7e9,
        depthTest: false,
        opacity: 0.9,
        transparent: true,
      }),
    );
    edges.position.copy(planeMesh.position);
    edges.quaternion.copy(planeMesh.quaternion);
    edges.renderOrder = 41;
    cutPlaneGroup.add(edges);
  };

  applySelection(selectedFeatureIds, selectedGroupId);
  applyTransformMode(transformMode, selectedFeatureIds, selectedGroupId);
  applyCutPlane(cutPlane, selectedFeatureIds, selectedGroupId);

  return {
    applyCutPlane,
    applySelection,
    applyTransformMode,
    isFeatureSelected: (featureId) => renderedSelectedFeatureIds.has(featureId),
    get transformGestureActive() {
      return transformGestureActive;
    },
    dispose: () => {
      controls.removeEventListener("change", updateTransformControlSize);
      controls.removeEventListener("change", requestRender);
      transformControls.removeEventListener("mouseDown", handleTransformMouseDown);
      transformControls.removeEventListener("objectChange", handleTransformChange);
      transformControls.removeEventListener("mouseUp", handleTransformMouseUp);
      transformControls.detach();
      transformControls.dispose();
      transformHelper.removeFromParent();
      selectionPivot.removeFromParent();
      clearCutPlane();
      cutPlaneGroup.removeFromParent();
      clearSelectionDecorations();
    },
  };
}
