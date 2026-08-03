import { Fragment, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { FeatureGroup, ModelFeature, Vector3Tuple } from "@solidloom/shared";
import { createFeatureGeometry } from "./meshOperations";

export type TransformMode = "translate" | "rotate" | "scale" | null;
export interface TransformCommit {
  id: string;
  kind: "feature" | "group";
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
}

interface Viewport3DProps {
  annotationMode: boolean;
  annotationStrings: {
    add: string;
    assistActive: string;
    box: string;
    cut: string;
    cylinder: string;
    feature: string;
    group: string;
    members: string;
    mesh: string;
    path: string;
  };
  features: ModelFeature[];
  groups: FeatureGroup[];
  label: string;
  modelId: string;
  modelName: string;
  onSelectFeature: (featureId: string | null, additive: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  onOpenContextMenu: (featureId: string | null, point: { x: number; y: number }) => void;
  onTransformCommit: (transforms: TransformCommit[]) => void;
  selectedFeatureIds: string[];
  selectedGroupId: string | null;
  theme: "light" | "dark" | "system";
  transformMode: TransformMode;
  cutPlane: { offset: number; rotation: Vector3Tuple } | null;
  viewCubeLabel: string;
  viewLabels: [string, string, string, string, string, string];
}

const AXIS_WIDGET_SIZE = 160;
const DEFAULT_TRANSFORM_CONTROL_SIZE = 0.82;
const ROTATION_RING_PADDING = 1.18;

function createSelectionCornerBox(bounds: THREE.Box3, color: THREE.ColorRepresentation) {
  const cornerBox = new THREE.Group();
  cornerBox.name = "selection-corner-box";
  if (bounds.isEmpty()) return cornerBox;

  const objectSize = bounds.getSize(new THREE.Vector3());
  const maximumDimension = Math.max(objectSize.x, objectSize.y, objectSize.z, 1);
  const cornerBounds = bounds.clone();
  const cornerBoxSize = cornerBounds.getSize(new THREE.Vector3());
  const longestCornerSegment = maximumDimension * 0.18;
  const segmentLengths = new THREE.Vector3(
    Math.min(cornerBoxSize.x * 0.38, longestCornerSegment),
    Math.min(cornerBoxSize.y * 0.38, longestCornerSegment),
    Math.min(cornerBoxSize.z * 0.38, longestCornerSegment),
  );
  const thickness = Math.max(maximumDimension * 0.0042, 0.28);
  const segmentGeometry = new THREE.BoxGeometry(1, 1, 1);
  const segmentMaterial = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.96,
    toneMapped: false,
  });

  for (const useMaximumX of [false, true]) {
    for (const useMaximumY of [false, true]) {
      for (const useMaximumZ of [false, true]) {
        const corner = new THREE.Vector3(
          useMaximumX ? cornerBounds.max.x : cornerBounds.min.x,
          useMaximumY ? cornerBounds.max.y : cornerBounds.min.y,
          useMaximumZ ? cornerBounds.max.z : cornerBounds.min.z,
        );
        const inwardDirections = [useMaximumX ? -1 : 1, useMaximumY ? -1 : 1, useMaximumZ ? -1 : 1];

        for (let axis = 0; axis < 3; axis += 1) {
          const length = segmentLengths.getComponent(axis);
          const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
          segment.position.copy(corner);
          segment.position.setComponent(axis, corner.getComponent(axis) + inwardDirections[axis]! * length / 2);
          segment.scale.set(thickness, thickness, thickness);
          segment.scale.setComponent(axis, length);
          segment.renderOrder = 60;
          segment.frustumCulled = false;
          cornerBox.add(segment);
        }
      }
    }
  }

  return cornerBox;
}

function createTextTexture(text: string, background: string, foreground: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");

  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  context.lineWidth = 8;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = foreground;
  context.font = "600 54px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function createAxisLabel(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");

  context.fillStyle = color;
  context.beginPath();
  context.arc(48, 48, 38, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "800 42px ui-sans-serif, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 48, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(0.42);
  sprite.renderOrder = 20;
  return sprite;
}

export function Viewport3D({ annotationMode, annotationStrings, cutPlane, features, groups, label, modelId, modelName, onSelectFeature, onSelectGroup, onOpenContextMenu, onTransformCommit, selectedFeatureIds, selectedGroupId, theme, transformMode, viewCubeLabel, viewLabels }: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const axisWidgetRef = useRef<HTMLCanvasElement>(null);
  const annotationOverlayRef = useRef<HTMLDivElement>(null);
  const onSelectFeatureRef = useRef(onSelectFeature);
  const onSelectGroupRef = useRef(onSelectGroup);
  const onOpenContextMenuRef = useRef(onOpenContextMenu);
  const onTransformCommitRef = useRef(onTransformCommit);
  const updateSelectionRef = useRef<((featureIds: string[], groupId: string | null) => void) | null>(null);
  const updateTransformRef = useRef<((mode: TransformMode, featureIds: string[], groupId: string | null) => void) | null>(null);
  const updateCutPlaneRef = useRef<((plane: Viewport3DProps["cutPlane"], featureIds: string[], groupId: string | null) => void) | null>(null);
  const savedViewRef = useRef<{ modelId: string; position: THREE.Vector3; quaternion: THREE.Quaternion; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    onSelectFeatureRef.current = onSelectFeature;
  }, [onSelectFeature]);

  useEffect(() => {
    onSelectGroupRef.current = onSelectGroup;
  }, [onSelectGroup]);

  useEffect(() => {
    onOpenContextMenuRef.current = onOpenContextMenu;
  }, [onOpenContextMenu]);

  useEffect(() => {
    onTransformCommitRef.current = onTransformCommit;
  }, [onTransformCommit]);

  useEffect(() => {
    const container = containerRef.current;
    const axisWidget = axisWidgetRef.current;
    if (!container || !axisWidget) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-label", label);
    renderer.domElement.setAttribute("data-testid", "model-canvas");
    renderer.domElement.tabIndex = 0;
    container.append(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10_000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;

    const axisRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      canvas: axisWidget,
    });
    axisRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    axisRenderer.setSize(AXIS_WIDGET_SIZE, AXIS_WIDGET_SIZE, false);
    axisRenderer.outputColorSpace = THREE.SRGBColorSpace;
    axisRenderer.setClearColor(0x000000, 0);

    const axisScene = new THREE.Scene();
    const axisCamera = new THREE.OrthographicCamera(-2.65, 2.65, 2.65, -2.65, 0.1, 20);
    axisCamera.position.set(0, 0, 6);
    const orientationGroup = new THREE.Group();
    axisScene.add(orientationGroup);

    const widgetStyle = window.getComputedStyle(axisWidget);
    const faceColor = widgetStyle.getPropertyValue("--axis-face-color").trim() || "#464a43";
    const faceTextColor = widgetStyle.getPropertyValue("--axis-face-text").trim() || "#f2f3ef";
    const faceMaterials = viewLabels.map((faceLabel) => new THREE.MeshBasicMaterial({
      map: createTextTexture(faceLabel, faceColor, faceTextColor),
    }));
    const viewCubeSize = 2;
    const viewCubeGeometry = new THREE.BoxGeometry(viewCubeSize, viewCubeSize, viewCubeSize);
    const viewCube = new THREE.Mesh(viewCubeGeometry, faceMaterials);
    orientationGroup.add(viewCube);

    const faceDefinitions = [
      { normal: new THREE.Vector3(1, 0, 0), right: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
      { normal: new THREE.Vector3(-1, 0, 0), right: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
      { normal: new THREE.Vector3(0, 1, 0), right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, -1) },
      { normal: new THREE.Vector3(0, -1, 0), right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 0, 1) },
      { normal: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
      { normal: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
    ];
    const gridCellSize = viewCubeSize / 3;
    const gridCellGeometry = new THREE.PlaneGeometry(gridCellSize - 0.025, gridCellSize - 0.025);
    const gridCellMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const gridCellHoverMaterial = new THREE.MeshBasicMaterial({
      color: 0xd6a06f,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    const gridCellMeshes: THREE.Mesh[] = [];
    const planeNormal = new THREE.Vector3(0, 0, 1);
    for (const [faceIndex, face] of faceDefinitions.entries()) {
      for (const verticalOffset of [-1, 0, 1]) {
        for (const horizontalOffset of [-1, 0, 1]) {
          const cell = new THREE.Mesh(gridCellGeometry, gridCellMaterial);
          cell.position
            .copy(face.normal)
            .multiplyScalar(viewCubeSize / 2 + 0.006)
            .addScaledVector(face.right, horizontalOffset * gridCellSize)
            .addScaledVector(face.up, verticalOffset * gridCellSize);
          cell.quaternion.setFromUnitVectors(planeNormal, face.normal);
          cell.userData.faceIndex = faceIndex;
          cell.userData.viewDirection = face.normal.clone()
            .addScaledVector(face.right, horizontalOffset)
            .addScaledVector(face.up, verticalOffset)
            .normalize();
          cell.renderOrder = 5;
          orientationGroup.add(cell);
          gridCellMeshes.push(cell);
        }
      }
    }

    const cubeEdgesGeometry = new THREE.EdgesGeometry(viewCubeGeometry);
    const cubeEdgesMaterial = new THREE.LineBasicMaterial({ color: 0xaeb3aa, transparent: true, opacity: 0.52 });
    orientationGroup.add(new THREE.LineSegments(cubeEdgesGeometry, cubeEdgesMaterial));

    const axisDefinitions = [
      { name: "X", direction: new THREE.Vector3(1, 0, 0), color: 0xd77878 },
      { name: "Y", direction: new THREE.Vector3(0, 1, 0), color: 0x70c98a },
      { name: "Z", direction: new THREE.Vector3(0, 0, 1), color: 0x7e8fe0 },
    ];
    const axisOrigin = new THREE.Vector3(-1, -1, -1);
    const axisArrows: THREE.ArrowHelper[] = [];
    const axisLabels: THREE.Sprite[] = [];
    for (const axis of axisDefinitions) {
      const arrow = new THREE.ArrowHelper(axis.direction, axisOrigin, 2.85, axis.color, 0.3, 0.17);
      const lineMaterial = arrow.line.material as THREE.LineBasicMaterial;
      const coneMaterial = arrow.cone.material as THREE.MeshBasicMaterial;
      lineMaterial.depthTest = true;
      lineMaterial.transparent = true;
      lineMaterial.opacity = 0.9;
      coneMaterial.depthTest = true;
      arrow.line.renderOrder = 10;
      arrow.cone.renderOrder = 10;
      orientationGroup.add(arrow);
      axisArrows.push(arrow);

      const axisLabel = createAxisLabel(axis.name, `#${axis.color.toString(16).padStart(6, "0")}`);
      axisLabel.position.copy(axisOrigin).addScaledVector(axis.direction, 3.05);
      orientationGroup.add(axisLabel);
      axisLabels.push(axisLabel);
    }

    const computedStyle = window.getComputedStyle(container);
    const gridMajor = computedStyle.getPropertyValue("--color-grid-major").trim() || "#ccccc5";
    const gridMinor = computedStyle.getPropertyValue("--color-grid-minor").trim() || "#d5d5ce";
    const grid = new THREE.GridHelper(300, 30, new THREE.Color(gridMajor), new THREE.Color(gridMinor));
    grid.material.opacity = 0.72;
    grid.material.transparent = true;
    scene.add(grid);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x53604d, theme === "dark" ? 1.8 : 1.45);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, theme === "dark" ? 3.3 : 2.5);
    keyLight.position.set(80, 120, 70);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xbed7ff, 1.1);
    fillLight.position.set(-90, 50, -60);
    scene.add(fillLight);

    const featureGroup = new THREE.Group();
    scene.add(featureGroup);
    const featureGroupById = new Map<string, THREE.Group>();
    const featureMeshById = new Map<string, THREE.Mesh>();
    const groupIdByFeatureId = new Map<string, string>();
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
      for (const featureId of group.featureIds) groupIdByFeatureId.set(featureId, group.id);
    }
    for (const feature of features) {
      const material = feature.operation === "cut"
        ? new THREE.MeshStandardMaterial({ color: 0xc77867, transparent: true, opacity: 0.32, wireframe: true, depthWrite: false })
        : new THREE.MeshStandardMaterial({
          color: 0xb9c9ad,
          emissive: 0x000000,
          emissiveIntensity: 0,
          roughness: 0.62,
          metalness: 0.04,
        });
      const mesh = new THREE.Mesh(createFeatureGeometry(feature), material);
      mesh.position.set(...feature.position);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(feature.rotation[0]),
        THREE.MathUtils.degToRad(feature.rotation[1]),
        THREE.MathUtils.degToRad(feature.rotation[2]),
      );
      mesh.scale.set(...(feature.scale ?? [1, 1, 1]));
      mesh.castShadow = feature.operation === "add";
      mesh.receiveShadow = feature.operation === "add";
      mesh.userData.featureId = feature.id;
      featureMeshById.set(feature.id, mesh);
      const parentGroupId = groupIdByFeatureId.get(feature.id);
      (parentGroupId ? featureGroupById.get(parentGroupId) ?? featureGroup : featureGroup).add(mesh);
    }

    const annotationProjectionMatrix = new THREE.Matrix4();
    const annotationFrustum = new THREE.Frustum();
    const annotationBounds = new THREE.Box3();
    const annotationCenter = new THREE.Vector3();
    const annotationVertex = new THREE.Vector3();
    type AnnotationPoint = { x: number; y: number };
    const annotationCross = (origin: AnnotationPoint, a: AnnotationPoint, b: AnnotationPoint) => (
      (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
    );
    const createAnnotationHull = (points: AnnotationPoint[]) => {
      const uniquePoints = [...new Map(points.map((point) => [
        `${Math.round(point.x * 4)}:${Math.round(point.y * 4)}`,
        point,
      ])).values()].sort((a, b) => a.x - b.x || a.y - b.y);
      if (uniquePoints.length <= 3) return uniquePoints;
      const lower: AnnotationPoint[] = [];
      for (const point of uniquePoints) {
        while (lower.length >= 2 && annotationCross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
        lower.push(point);
      }
      const upper: AnnotationPoint[] = [];
      for (let index = uniquePoints.length - 1; index >= 0; index -= 1) {
        const point = uniquePoints[index]!;
        while (upper.length >= 2 && annotationCross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
        upper.push(point);
      }
      lower.pop();
      upper.pop();
      return [...lower, ...upper];
    };
    const updateAnnotationTargets = () => {
      const overlay = annotationOverlayRef.current;
      if (!overlay || overlay.childElementCount === 0) return;

      camera.updateMatrixWorld(true);
      annotationProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      annotationFrustum.setFromProjectionMatrix(annotationProjectionMatrix);
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
      const labelsByTargetId = new Map(
        [...overlay.querySelectorAll<HTMLElement>("[data-annotation-label-for]")]
          .map((element) => [element.dataset.annotationLabelFor ?? "", element]),
      );

      overlay.querySelectorAll<HTMLElement>("[data-annotation-kind]").forEach((element) => {
        const id = element.dataset.annotationId;
        const kind = element.dataset.annotationKind;
        const targetLabel = labelsByTargetId.get(element.id);
        const object = id
          ? kind === "group" ? featureGroupById.get(id) : featureMeshById.get(id)
          : null;
        if (!object) {
          element.hidden = true;
          if (targetLabel) targetLabel.hidden = true;
          return;
        }

        annotationBounds.setFromObject(object);
        if (annotationBounds.isEmpty() || !annotationFrustum.intersectsBox(annotationBounds)) {
          element.hidden = true;
          if (targetLabel) targetLabel.hidden = true;
          return;
        }

        object.updateWorldMatrix(true, true);
        const projectedPoints: AnnotationPoint[] = [];
        object.traverse((child) => {
          if (!(child instanceof THREE.Mesh) || typeof child.userData.featureId !== "string") return;
          const position = child.geometry.getAttribute("position");
          if (!position) return;
          const samplingStep = Math.max(1, Math.floor(position.count / 480));
          for (let index = 0; index < position.count; index += samplingStep) {
            annotationVertex
              .set(position.getX(index), position.getY(index), position.getZ(index))
              .applyMatrix4(child.matrixWorld)
              .applyMatrix4(camera.matrixWorldInverse);
            if (annotationVertex.z >= 0) continue;
            annotationVertex.applyMatrix4(camera.projectionMatrix);
            projectedPoints.push({
              x: THREE.MathUtils.clamp((annotationVertex.x + 1) * width / 2, 0, width),
              y: THREE.MathUtils.clamp((1 - annotationVertex.y) * height / 2, 0, height),
            });
          }
        });
        const hull = createAnnotationHull(projectedPoints);
        if (hull.length < 3) {
          element.hidden = true;
          if (targetLabel) targetLabel.hidden = true;
          return;
        }

        const left = Math.min(...hull.map((point) => point.x));
        const right = Math.max(...hull.map((point) => point.x));
        const top = Math.min(...hull.map((point) => point.y));
        const bottom = Math.max(...hull.map((point) => point.y));
        const targetWidth = Math.max(20, right - left);
        const targetHeight = Math.max(20, bottom - top);
        const polygonPoints = hull.map((point) => ({
          x: THREE.MathUtils.clamp((point.x - left) / targetWidth * 100, 0, 100),
          y: THREE.MathUtils.clamp((point.y - top) / targetHeight * 100, 0, 100),
        }));
        const polygonCss = `polygon(${polygonPoints.map((point) => `${point.x.toFixed(2)}% ${point.y.toFixed(2)}%`).join(", ")})`;
        const polygonSvg = polygonPoints.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
        annotationBounds.getCenter(annotationCenter);
        const distance = annotationCenter.distanceTo(cameraPosition);
        const targetZIndex = kind === "feature" ? Math.max(2, 2000 - Math.round(distance)) : 1;

        element.hidden = false;
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        element.style.width = `${targetWidth}px`;
        element.style.height = `${targetHeight}px`;
        element.style.zIndex = String(targetZIndex);
        element.style.clipPath = polygonCss;
        element.querySelector("polygon")?.setAttribute("points", polygonSvg);
        if (targetLabel) {
          targetLabel.hidden = false;
          targetLabel.style.left = `${left}px`;
          targetLabel.style.top = `${top}px`;
          targetLabel.style.zIndex = String(targetZIndex + 1);
        }
      });
    };

    const bounds = new THREE.Box3().setFromObject(featureGroup);
    const selectionOutlines: THREE.LineSegments[] = [];
    const selectionCornerBoxes: THREE.Group[] = [];
    const cornerBoxColor = computedStyle.getPropertyValue("--color-text").trim() || "#f7f8f3";
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
      clearSelectionDecorations();
      const selectedIds = new Set(featureIds);
      for (const [featureId, mesh] of featureMeshById) {
        if (!(mesh.material instanceof THREE.MeshStandardMaterial) || mesh.material.wireframe) continue;
        const isSelected = selectedIds.has(featureId);
        mesh.material.color.setHex(isSelected ? 0xd1dfa8 : 0xb9c9ad);
        mesh.material.emissive.setHex(isSelected ? 0x263016 : 0x000000);
        mesh.material.emissiveIntensity = isSelected ? 0.34 : 0;
      }

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
          new THREE.LineBasicMaterial({ color: 0xd8ff45, depthTest: false, transparent: true, opacity: 1 }),
        );
        outline.renderOrder = 50;
        mesh.add(outline);
        selectionOutlines.push(outline);
      }
    };
    updateSelectionRef.current = applySelection;
    applySelection(selectedFeatureIds, selectedGroupId);

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setSize(DEFAULT_TRANSFORM_CONTROL_SIZE);
    transformControls.showE = false;
    const transformHelper = transformControls.getHelper();
    scene.add(transformHelper);
    const selectionPivot = new THREE.Object3D();
    selectionPivot.name = "selection-transform-pivot";
    scene.add(selectionPivot);
    let activeTransformTargets: Array<{ id: string; kind: "feature" | "group"; object: THREE.Object3D }> = [];
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

      // TransformControls 的彩色旋转环基础半径为 0.5，最终世界尺寸为
      // displayFactor * controlSize / 4，因此乘以 8 可让环半径覆盖目标包围盒。
      const nextSize = Math.max(
        DEFAULT_TRANSFORM_CONTROL_SIZE,
        rotationTargetRadius * ROTATION_RING_PADDING * 8 / displayFactor,
      );
      if (Math.abs(transformControls.size - nextSize) > 0.002) {
        transformControls.setSize(nextSize);
      }
    };

    const objectTransform = (target: { id: string; kind: "feature" | "group"; object: THREE.Object3D }): TransformCommit => ({
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
      if (transformControls.object === selectionPivot) {
        selectionPivot.updateMatrixWorld(true);
        pivotStartWorld.copy(selectionPivot.matrixWorld);
        multiTransformStart = activeTransformTargets.map(({ object }) => {
          object.updateMatrixWorld(true);
          return { object, worldMatrix: object.matrixWorld.clone() };
        });
      }
    };
    const handleTransformChange = () => {
      if (transformControls.object === selectionPivot) {
        selectionPivot.updateMatrixWorld(true);
        const delta = selectionPivot.matrixWorld.clone().multiply(pivotStartWorld.clone().invert());
        multiTransformStart.forEach(({ object, worldMatrix }) => {
          const nextWorld = delta.clone().multiply(worldMatrix);
          const parentInverse = object.parent?.matrixWorld.clone().invert() ?? new THREE.Matrix4();
          const localMatrix = parentInverse.multiply(nextWorld);
          localMatrix.decompose(object.position, object.quaternion, object.scale);
          object.updateMatrixWorld(true);
        });
      }
    };
    const handleTransformMouseUp = () => {
      controls.enabled = true;
      if (activeTransformTargets.length > 0) {
        onTransformCommitRef.current(activeTransformTargets.map(objectTransform));
      }
      window.requestAnimationFrame(() => {
        transformGestureActive = false;
      });
    };
    transformControls.addEventListener("mouseDown", handleTransformMouseDown);
    transformControls.addEventListener("objectChange", handleTransformChange);
    transformControls.addEventListener("mouseUp", handleTransformMouseUp);
    controls.addEventListener("change", updateTransformControlSize);
    updateTransformRef.current = applyTransformMode;
    applyTransformMode(transformMode, selectedFeatureIds, selectedGroupId);

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
    const applyCutPlane = (plane: Viewport3DProps["cutPlane"], featureIds: string[], groupId: string | null) => {
      clearCutPlane();
      if (!plane) return;
      const targetObjects = groupId
        ? [featureGroupById.get(groupId)].filter((object): object is THREE.Group => Boolean(object))
        : featureIds.map((id) => featureMeshById.get(id)).filter((object): object is THREE.Mesh => Boolean(object));
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
        new THREE.LineBasicMaterial({ color: 0x7ff7e9, depthTest: false, transparent: true, opacity: 0.9 }),
      );
      edges.position.copy(planeMesh.position);
      edges.quaternion.copy(planeMesh.quaternion);
      edges.renderOrder = 41;
      cutPlaneGroup.add(edges);
    };
    updateCutPlaneRef.current = applyCutPlane;
    applyCutPlane(cutPlane, selectedFeatureIds, selectedGroupId);

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const maximumDimension = Math.max(size.x, size.y, size.z, 20);
    const boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    const viewDirection = new THREE.Vector3(1.35, 1.05, 1.55).normalize();
    const savedView = savedViewRef.current?.modelId === modelId ? savedViewRef.current : null;
    controls.target.copy(savedView?.target ?? center);
    camera.near = Math.max(0.1, maximumDimension / 100);
    camera.far = maximumDimension * 100;

    const previousCameraQuaternion = new THREE.Quaternion();
    let axisWidgetInitialized = false;
    let hoveredCells: THREE.Mesh[] = [];
    let hoveredDirectionKey = "";

    const renderAxisWidget = () => {
      orientationGroup.quaternion.copy(camera.quaternion).invert();
      axisRenderer.render(axisScene, axisCamera);
    };

    const updateAxisWidget = () => {
      if (axisWidgetInitialized && 1 - Math.abs(previousCameraQuaternion.dot(camera.quaternion)) < 0.000001) return;

      previousCameraQuaternion.copy(camera.quaternion);
      renderAxisWidget();
      axisWidgetInitialized = true;
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitTestModel = (event: { clientX: number; clientY: number }) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(featureGroup, true)
        .find((intersection) => typeof intersection.object.userData.featureId === "string");
      return hit ? String(hit.object.userData.featureId) : null;
    };
    let viewportPointerGesture: { button: number; dragged: boolean; pointerId: number; startX: number; startY: number } | null = null;
    let suppressNextContextMenu = false;
    const handleViewportPointerDown = (event: PointerEvent) => {
      if (transformGestureActive) return;
      if (event.button !== 0 && event.button !== 2) return;
      viewportPointerGesture = {
        button: event.button,
        dragged: false,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
    };
    const handleViewportPointerMove = (event: PointerEvent) => {
      if (viewportPointerGesture?.pointerId === event.pointerId) {
        viewportPointerGesture.dragged ||= Math.hypot(
          event.clientX - viewportPointerGesture.startX,
          event.clientY - viewportPointerGesture.startY,
        ) > 3;
      }
      const featureId = viewportPointerGesture?.dragged ? null : hitTestModel(event);
      renderer.domElement.classList.toggle("object-hovered", featureId !== null);
    };
    const handleViewportPointerUp = (event: PointerEvent) => {
      if (!viewportPointerGesture || viewportPointerGesture.pointerId !== event.pointerId) return;
      const gesture = viewportPointerGesture;
      viewportPointerGesture = null;
      if (transformGestureActive) return;
      if (gesture.button === 0 && !gesture.dragged) {
        onSelectFeatureRef.current(hitTestModel(event), event.metaKey || event.ctrlKey);
      }
      if (gesture.button === 2) suppressNextContextMenu = gesture.dragged;
    };
    const handleViewportContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (suppressNextContextMenu) {
        suppressNextContextMenu = false;
        return;
      }
      onOpenContextMenuRef.current(hitTestModel(event), { x: event.clientX, y: event.clientY });
    };
    const handleViewportPointerLeave = () => {
      if (!viewportPointerGesture) renderer.domElement.classList.remove("object-hovered");
    };
    const handleViewportPointerCancel = () => {
      viewportPointerGesture = null;
      renderer.domElement.classList.remove("object-hovered");
    };
    renderer.domElement.addEventListener("pointerdown", handleViewportPointerDown);
    renderer.domElement.addEventListener("pointermove", handleViewportPointerMove);
    renderer.domElement.addEventListener("pointerup", handleViewportPointerUp);
    renderer.domElement.addEventListener("pointerleave", handleViewportPointerLeave);
    renderer.domElement.addEventListener("pointercancel", handleViewportPointerCancel);
    renderer.domElement.addEventListener("contextmenu", handleViewportContextMenu);

    const hitTestViewCube = (event: PointerEvent) => {
      const bounds = axisWidget.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, axisCamera);
      const hit = raycaster.intersectObjects([...gridCellMeshes, viewCube], false)[0];
      if (!hit) return null;
      if (hit.object.userData.viewDirection instanceof THREE.Vector3) {
        return {
          cell: hit.object as THREE.Mesh,
          direction: hit.object.userData.viewDirection as THREE.Vector3,
          faceIndex: Number(hit.object.userData.faceIndex),
        };
      }
      const faceIndex = hit.face?.materialIndex ?? -1;
      const faceDefinition = faceDefinitions[faceIndex];
      return !faceDefinition ? null : { cell: null, direction: faceDefinition.normal, faceIndex };
    };

    const setHoveredTarget = (direction: THREE.Vector3 | null, isInteractive: boolean) => {
      const directionKey = direction
        ? direction.toArray().map((component) => Math.round(component * 1000)).join(":")
        : "";
      if (hoveredDirectionKey === directionKey && axisWidget.classList.contains("face-hovered") === isInteractive) return;
      for (const cell of hoveredCells) cell.material = gridCellMaterial;
      hoveredCells = direction
        ? gridCellMeshes.filter((cell) => (cell.userData.viewDirection as THREE.Vector3).dot(direction) > 0.999)
        : [];
      for (const cell of hoveredCells) cell.material = gridCellHoverMaterial;
      hoveredDirectionKey = directionKey;
      axisWidget.dataset.viewDirection = directionKey;
      axisWidget.classList.toggle("face-hovered", isInteractive);
      renderAxisWidget();
    };

    type ViewTransition = {
      startedAt: number;
      startPosition: THREE.Vector3;
      endPosition: THREE.Vector3;
      startQuaternion: THREE.Quaternion;
      endQuaternion: THREE.Quaternion;
      endUp: THREE.Vector3;
    };
    let viewTransition: ViewTransition | null = null;
    const switchToView = (direction: THREE.Vector3) => {
      const endUp = Math.abs(direction.dot(new THREE.Vector3(0, 1, 0))) > 0.92
        ? new THREE.Vector3(0, 0, direction.y > 0 ? -1 : 1)
        : new THREE.Vector3(0, 1, 0);

      const distance = Math.max(camera.position.distanceTo(controls.target), maximumDimension * 1.4);
      const endPosition = controls.target.clone().addScaledVector(direction, distance);
      const targetCamera = camera.clone();
      targetCamera.position.copy(endPosition);
      targetCamera.up.copy(endUp);
      targetCamera.lookAt(controls.target);
      viewTransition = {
        startedAt: performance.now(),
        startPosition: camera.position.clone(),
        endPosition,
        startQuaternion: camera.quaternion.clone(),
        endQuaternion: targetCamera.quaternion.clone(),
        endUp: endUp.clone(),
      };
    };

    type AxisPointerGesture = {
      dragged: boolean;
      lastX: number;
      lastY: number;
      pointerId: number;
      startX: number;
      startY: number;
      target: ReturnType<typeof hitTestViewCube>;
    };
    let axisPointerGesture: AxisPointerGesture | null = null;

    const rotateCameraFromWidget = (deltaX: number, deltaY: number) => {
      const offset = camera.position.clone().sub(controls.target);
      const yawAxis = camera.up.clone().normalize();
      const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      const yaw = new THREE.Quaternion().setFromAxisAngle(yawAxis, -deltaX * 0.008);
      rightAxis.applyQuaternion(yaw);
      offset.applyQuaternion(yaw);
      const pitch = new THREE.Quaternion().setFromAxisAngle(rightAxis, -deltaY * 0.008);
      offset.applyQuaternion(pitch);
      camera.up.applyQuaternion(pitch).normalize();
      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
      controls.update();
    };

    const handleAxisPointerMove = (event: PointerEvent) => {
      if (!axisPointerGesture || axisPointerGesture.pointerId !== event.pointerId) {
        const target = hitTestViewCube(event);
        setHoveredTarget(target?.direction ?? null, target !== null);
        return;
      }

      const totalDistance = Math.hypot(
        event.clientX - axisPointerGesture.startX,
        event.clientY - axisPointerGesture.startY,
      );
      if (totalDistance > 3) {
        axisPointerGesture.dragged = true;
        axisWidget.classList.add("dragging");
        setHoveredTarget(null, false);
      }
      if (axisPointerGesture.dragged) {
        rotateCameraFromWidget(
          event.clientX - axisPointerGesture.lastX,
          event.clientY - axisPointerGesture.lastY,
        );
      }
      axisPointerGesture.lastX = event.clientX;
      axisPointerGesture.lastY = event.clientY;
    };
    const handleAxisPointerLeave = () => {
      if (!axisPointerGesture) setHoveredTarget(null, false);
    };
    const handleAxisPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      viewTransition = null;
      axisPointerGesture = {
        dragged: false,
        lastX: event.clientX,
        lastY: event.clientY,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        target: hitTestViewCube(event),
      };
      axisWidget.setPointerCapture(event.pointerId);
    };
    const handleAxisPointerUp = (event: PointerEvent) => {
      if (!axisPointerGesture || axisPointerGesture.pointerId !== event.pointerId) return;
      const gesture = axisPointerGesture;
      axisPointerGesture = null;
      axisWidget.classList.remove("dragging");
      if (axisWidget.hasPointerCapture(event.pointerId)) axisWidget.releasePointerCapture(event.pointerId);
      if (!gesture.dragged) {
        const target = hitTestViewCube(event) ?? gesture.target;
        if (target) {
          setHoveredTarget(null, false);
          switchToView(target.direction);
        }
      }
    };
    const handleAxisPointerCancel = (event: PointerEvent) => {
      if (!axisPointerGesture || axisPointerGesture.pointerId !== event.pointerId) return;
      axisPointerGesture = null;
      axisWidget.classList.remove("dragging");
      setHoveredTarget(null, false);
    };
    const cancelViewTransition = () => {
      viewTransition = null;
    };
    axisWidget.addEventListener("pointermove", handleAxisPointerMove);
    axisWidget.addEventListener("pointerleave", handleAxisPointerLeave);
    axisWidget.addEventListener("pointerdown", handleAxisPointerDown);
    axisWidget.addEventListener("pointerup", handleAxisPointerUp);
    axisWidget.addEventListener("pointercancel", handleAxisPointerCancel);
    controls.addEventListener("start", cancelViewTransition);

    let cameraFitted = false;
    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (!cameraFitted) {
        if (savedView) {
          camera.position.copy(savedView.position);
          camera.quaternion.copy(savedView.quaternion);
        } else {
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
          const limitingFov = Math.min(verticalFov, horizontalFov);
          const distance = (boundingSphere.radius / Math.sin(limitingFov / 2)) * 1.18;
          camera.position.copy(center).add(viewDirection.clone().multiplyScalar(distance));
        }
        cameraFitted = true;
      }
      camera.updateProjectionMatrix();
      controls.update();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let animationFrame = 0;
    const render = () => {
      if (viewTransition) {
        const progress = THREE.MathUtils.clamp((performance.now() - viewTransition.startedAt) / 280, 0, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(viewTransition.startPosition, viewTransition.endPosition, easedProgress);
        camera.quaternion.slerpQuaternions(viewTransition.startQuaternion, viewTransition.endQuaternion, easedProgress);
        if (progress >= 1) {
          camera.up.copy(viewTransition.endUp);
          viewTransition = null;
          controls.update();
        }
      } else {
        controls.update();
      }
      updateAnnotationTargets();
      updateAxisWidget();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      if (updateSelectionRef.current === applySelection) updateSelectionRef.current = null;
      if (updateTransformRef.current === applyTransformMode) updateTransformRef.current = null;
      if (updateCutPlaneRef.current === applyCutPlane) updateCutPlaneRef.current = null;
      savedViewRef.current = {
        modelId,
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        target: controls.target.clone(),
      };
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handleViewportPointerDown);
      renderer.domElement.removeEventListener("pointermove", handleViewportPointerMove);
      renderer.domElement.removeEventListener("pointerup", handleViewportPointerUp);
      renderer.domElement.removeEventListener("pointerleave", handleViewportPointerLeave);
      renderer.domElement.removeEventListener("pointercancel", handleViewportPointerCancel);
      renderer.domElement.removeEventListener("contextmenu", handleViewportContextMenu);
      axisWidget.removeEventListener("pointermove", handleAxisPointerMove);
      axisWidget.removeEventListener("pointerleave", handleAxisPointerLeave);
      axisWidget.removeEventListener("pointerdown", handleAxisPointerDown);
      axisWidget.removeEventListener("pointerup", handleAxisPointerUp);
      axisWidget.removeEventListener("pointercancel", handleAxisPointerCancel);
      controls.removeEventListener("start", cancelViewTransition);
      controls.removeEventListener("change", updateTransformControlSize);
      controls.dispose();
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
      const disposedFeatureGeometries = new Set<THREE.BufferGeometry>();
      const disposedFeatureMaterials = new Set<THREE.Material>();
      featureGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (!disposedFeatureGeometries.has(child.geometry)) {
            child.geometry.dispose();
            disposedFeatureGeometries.add(child.geometry);
          }
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            if (disposedFeatureMaterials.has(material)) continue;
            material.dispose();
            disposedFeatureMaterials.add(material);
          }
        }
      });
      renderer.dispose();
      axisRenderer.dispose();
      viewCubeGeometry.dispose();
      cubeEdgesGeometry.dispose();
      cubeEdgesMaterial.dispose();
      gridCellGeometry.dispose();
      gridCellMaterial.dispose();
      gridCellHoverMaterial.dispose();
      for (const material of faceMaterials) {
        material.map?.dispose();
        material.dispose();
      }
      for (const arrow of axisArrows) arrow.dispose();
      for (const axisLabel of axisLabels) {
        axisLabel.material.map?.dispose();
        axisLabel.material.dispose();
      }
      renderer.domElement.remove();
    };
  }, [features, groups, label, modelId, theme, viewCubeLabel, viewLabels]);

  useEffect(() => {
    updateSelectionRef.current?.(selectedFeatureIds, selectedGroupId);
  }, [selectedFeatureIds, selectedGroupId]);

  useEffect(() => {
    updateTransformRef.current?.(transformMode, selectedFeatureIds, selectedGroupId);
  }, [selectedFeatureIds, selectedGroupId, transformMode]);

  useEffect(() => {
    updateCutPlaneRef.current?.(cutPlane, selectedFeatureIds, selectedGroupId);
  }, [cutPlane, selectedFeatureIds, selectedGroupId]);

  return (
    <div className="viewport-3d" ref={containerRef}>
      <canvas className="axis-widget" ref={axisWidgetRef} aria-label={viewCubeLabel} />
      <div
        className={`annotation-overlay${annotationMode ? " active" : ""}`}
        ref={annotationOverlayRef}
        aria-hidden={!annotationMode}
      >
        {annotationMode && (
          <>
            <div className="annotation-assist-banner" role="status">{annotationStrings.assistActive}</div>
            {groups.map((group) => {
              const accessibleLabel = `${annotationStrings.group}: ${group.name}; ${annotationStrings.members}: ${group.featureIds.length}; ${annotationStrings.path}: ${modelName} / ${group.name}`;
              const targetId = `annotation-group-${group.id}`;
              return (
                <Fragment key={group.id}>
                  <button
                    className={`annotation-target annotation-group-target${selectedGroupId === group.id ? " selected" : ""}`}
                    data-annotation-kind="group"
                    data-annotation-id={group.id}
                    data-group-id={group.id}
                    data-object-path={`${modelName}/${group.name}`}
                    id={targetId}
                    type="button"
                    aria-label={accessibleLabel}
                    aria-pressed={selectedGroupId === group.id}
                    title={accessibleLabel}
                    onClick={() => onSelectGroupRef.current(group.id)}
                  >
                    <svg className="annotation-target-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <polygon />
                    </svg>
                  </button>
                  <span className="annotation-target-label annotation-group-label" data-annotation-label-for={targetId} aria-hidden="true">{group.name}</span>
                </Fragment>
              );
            })}
            {features.map((feature) => {
              const parentGroup = groups.find((group) => group.featureIds.includes(feature.id));
              const featureType = feature.type === "box"
                ? annotationStrings.box
                : feature.type === "cylinder"
                  ? annotationStrings.cylinder
                  : annotationStrings.mesh;
              const operation = feature.operation === "add" ? annotationStrings.add : annotationStrings.cut;
              const path = [modelName, parentGroup?.name, feature.name].filter(Boolean).join(" / ");
              const accessibleLabel = `${annotationStrings.feature}: ${feature.name}; ${featureType}; ${operation}; ${annotationStrings.path}: ${path}`;
              const targetId = `annotation-feature-${feature.id}`;
              return (
                <Fragment key={feature.id}>
                  <button
                    className={`annotation-target annotation-feature-target${selectedFeatureIds.includes(feature.id) ? " selected" : ""}`}
                    data-annotation-kind="feature"
                    data-annotation-id={feature.id}
                    data-feature-id={feature.id}
                    data-feature-type={feature.type}
                    data-feature-operation={feature.operation}
                    data-object-path={path}
                    id={targetId}
                    type="button"
                    aria-label={accessibleLabel}
                    aria-pressed={selectedFeatureIds.includes(feature.id)}
                    title={accessibleLabel}
                    onClick={() => onSelectFeatureRef.current(feature.id, false)}
                  >
                    <svg className="annotation-target-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <polygon />
                    </svg>
                  </button>
                  <span className="annotation-target-label" data-annotation-label-for={targetId} aria-hidden="true">{feature.name}</span>
                </Fragment>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
