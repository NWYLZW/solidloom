import { Fragment, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { ArticulationJoint, FeatureGroup, ModelFeature, NavigationSurface, RoomShellSource, Vector3Tuple } from "@solidloom/shared";
import { createFeatureMaterial } from "./featureMaterials";
import { createFeatureGeometry, featureGeometryCacheKey } from "./meshOperations";
import { collectNavigationPushChain, findNavigationPath, isNavigationPointWalkable, type NavigationObstacle, type NavigationPoint } from "./navigation";
import { featureShadowPolicy } from "./renderPerformance";
import { roomSurfaceVisibilityForCamera } from "./roomSurfaces";
import type { JointAnimationRequest } from "./articulation/types";
import { easeInOutCubic, sampleAnimationJointValue } from "./articulation/runtime";
import { attachJointHierarchy } from "./articulation/jointHierarchy";

export type TransformMode = "translate" | "rotate" | "scale" | null;
export type NavigationCameraMode = "god" | "first-person" | "third-person";
export interface TransformCommit {
  id: string;
  kind: "feature" | "group";
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
}

interface NavigationDynamicBodyRuntime {
  friction: number;
  id: string;
  linearDamping: number;
  mass: number;
  object: THREE.Group;
  obstacle: NavigationObstacle;
  velocity: THREE.Vector3;
}

interface NavigationInteractionDescriptor {
  groupId: string;
  id: string;
  kind: "power" | "seat" | "door" | "articulation";
  jointAxis?: Vector3Tuple;
  jointClosedValue?: number;
  jointInitialValue?: number;
  jointOpenValue?: number;
  jointPivot?: Vector3Tuple;
  openAngle?: number;
  range?: number;
  targetFeatureIds: string[];
}

interface NavigationInteractionRuntime extends NavigationInteractionDescriptor {
  active: boolean;
  anchor: THREE.Object3D;
  articulationAxis: THREE.Vector3 | null;
  articulationCurrentValue: number;
  articulationPivot: THREE.Group | null;
  articulationTargetValue: number;
  doorPivot: THREE.Group | null;
  dynamicBody: NavigationDynamicBodyRuntime | null;
  powerMaterials: Array<{
    emissive: THREE.Color;
    emissiveIntensity: number;
    material: THREE.MeshStandardMaterial;
  }>;
  raycastMeshes: THREE.Mesh[];
  targetMeshes: THREE.Mesh[];
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
    proceduralShell: string;
    roomShell: string;
  };
  features: ModelFeature[];
  groups: FeatureGroup[];
  joints: ArticulationJoint[];
  jointAnimation: JointAnimationRequest | null;
  label: string;
  modelId: string;
  modelName: string;
  rendererFailureLabel: string;
  rendererReloadLabel: string;
  onSelectFeature: (featureId: string | null, additive: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  onOpenContextMenu: (featureId: string | null, point: { x: number; y: number }) => void;
  onTransformCommit: (transforms: TransformCommit[]) => void;
  navigation: NavigationSurface | null;
  navigationCameraLabels: Record<NavigationCameraMode, string>;
  navigationCameraMode: NavigationCameraMode;
  navigationMode: boolean;
  navigationModeLabel: string;
  onNavigationCameraModeChange: (mode: NavigationCameraMode) => void;
  onJointAnimationComplete: (animationId: number) => void;
  navigationDynamicBodies: Array<{
    friction: number;
    groupId: string;
    linearDamping: number;
    mass: number;
  }>;
  navigationInteractions: NavigationInteractionDescriptor[];
  navigationInteractionLabels: {
    articulationClose: string;
    articulationOpen: string;
    doorClose: string;
    doorOpen: string;
    keyHint: string;
    powerOff: string;
    powerOn: string;
    sit: string;
    stand: string;
  };
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
const GRID_MINOR_SPACING = 10;
const GRID_MAJOR_SPACING = 100;
const GRID_COARSE_SPACING = 1000;
// Keep the visual grid slightly below the mathematical Y=0 plane. Floors then
// occlude it cleanly while uncovered workspace still shows the modeling grid.
const GRID_DISPLAY_OFFSET = -0.5;

function createInfiniteGrid(minorColor: THREE.ColorRepresentation, majorColor: THREE.ColorRepresentation, extent: number) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      minorColor: { value: new THREE.Color(minorColor) },
      majorColor: { value: new THREE.Color(majorColor) },
      minorSpacing: { value: GRID_MINOR_SPACING },
      majorSpacing: { value: GRID_MAJOR_SPACING },
      coarseSpacing: { value: GRID_COARSE_SPACING },
    },
    vertexShader: `
      varying vec3 worldPosition;

      void main() {
        vec4 positionInWorld = modelMatrix * vec4(position, 1.0);
        worldPosition = positionInWorld.xyz;
        gl_Position = projectionMatrix * viewMatrix * positionInWorld;
      }
    `,
    fragmentShader: `
      uniform vec3 minorColor;
      uniform vec3 majorColor;
      uniform float minorSpacing;
      uniform float majorSpacing;
      uniform float coarseSpacing;
      varying vec3 worldPosition;

      float gridLine(float spacing) {
        vec2 coordinate = worldPosition.xz / spacing;
        vec2 derivativeWidth = max(fwidth(coordinate), vec2(0.0001));
        vec2 distanceToLine = abs(fract(coordinate - 0.5) - 0.5) / derivativeWidth;
        float line = 1.0 - min(min(distanceToLine.x, distanceToLine.y), 1.0);
        float detailVisibility = 1.0 - smoothstep(0.55, 1.2, max(derivativeWidth.x, derivativeWidth.y));
        return line * detailVisibility;
      }

      void main() {
        float minorLine = gridLine(minorSpacing);
        float majorLine = gridLine(majorSpacing);
        float coarseLine = gridLine(coarseSpacing);
        float planarDistance = length(cameraPosition.xz - worldPosition.xz);
        minorLine *= 1.0 - smoothstep(1200.0, 4000.0, planarDistance);
        majorLine *= 1.0 - smoothstep(5000.0, 15000.0, planarDistance);
        float opacity = max(max(minorLine * 0.48, majorLine * 0.72), coarseLine * 0.84);
        if (opacity < 0.01) discard;
        gl_FragColor = vec4(mix(minorColor, majorColor, max(majorLine, coarseLine)), opacity);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "infinite-grid";
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(extent, extent, 1);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { geometry, material, mesh };
}

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

export function Viewport3D({ annotationMode, annotationStrings, cutPlane, features, groups, jointAnimation, joints, label, modelId, modelName, navigation, navigationCameraLabels, navigationCameraMode, navigationDynamicBodies, navigationInteractions, navigationInteractionLabels, navigationMode, navigationModeLabel, onJointAnimationComplete, onNavigationCameraModeChange, onSelectFeature, onSelectGroup, onOpenContextMenu, onTransformCommit, rendererFailureLabel, rendererReloadLabel, selectedFeatureIds, selectedGroupId, theme, transformMode, viewCubeLabel, viewLabels }: Viewport3DProps) {
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
  const playJointAnimationRef = useRef<((request: JointAnimationRequest | null) => void) | null>(null);
  const onJointAnimationCompleteRef = useRef(onJointAnimationComplete);
  const savedViewRef = useRef<{ modelId: string; position: THREE.Vector3; quaternion: THREE.Quaternion; target: THREE.Vector3 } | null>(null);
  const navigationAgentStateRef = useRef<{
    cameraPitch: number;
    cameraYaw: number;
    modelId: string;
    position: THREE.Vector3;
    rotationY: number;
    velocity: THREE.Vector3;
  } | null>(null);
  const navigationDynamicBodyStateRef = useRef<{
    modelId: string;
    states: Map<string, { position: THREE.Vector3; velocity: THREE.Vector3 }>;
  } | null>(null);
  const navigationInteractionStateRef = useRef<{
    modelId: string;
    seatedInteractionId: string | null;
    states: Map<string, boolean>;
  } | null>(null);
  const performNavigationInteractionRef = useRef<((interactionId: string) => void) | null>(null);
  const [navigationInteractionPrompts, setNavigationInteractionPrompts] = useState<Array<{ id: string; label: string }>>([]);
  const [navigationAimTargetVisible, setNavigationAimTargetVisible] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);

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
    onJointAnimationCompleteRef.current = onJointAnimationComplete;
  }, [onJointAnimationComplete]);

  useEffect(() => {
    const container = containerRef.current;
    const axisWidget = axisWidgetRef.current;
    if (!container || !axisWidget) return;

    const createRenderers = () => {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      try {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
        renderer.domElement.setAttribute("aria-label", label);
        renderer.domElement.setAttribute("data-testid", "model-canvas");
        renderer.domElement.tabIndex = 0;
        container.append(renderer.domElement);

        const axisRenderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          canvas: axisWidget,
        });
        axisRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        axisRenderer.setSize(AXIS_WIDGET_SIZE, AXIS_WIDGET_SIZE, false);
        axisRenderer.outputColorSpace = THREE.SRGBColorSpace;
        axisRenderer.setClearColor(0x000000, 0);
        return { axisRenderer, renderer };
      } catch (error) {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        throw error;
      }
    };
    let renderers: ReturnType<typeof createRenderers>;
    try {
      renderers = createRenderers();
      setRendererFailed(false);
    } catch {
      setRendererFailed(true);
      return;
    }
    const { axisRenderer, renderer } = renderers;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setRendererFailed(true);
    };
    const handleContextRestored = () => setRendererFailed(false);
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);
    axisWidget.addEventListener("webglcontextlost", handleContextLost);
    axisWidget.addEventListener("webglcontextrestored", handleContextRestored);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10_000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.enabled = !navigationMode || navigationCameraMode === "god";

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
    const infiniteGrid = createInfiniteGrid(gridMinor, gridMajor, camera.far);
    scene.add(infiniteGrid.mesh);

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
    const featureGroupContentById = new Map<string, THREE.Group>();
    const featureMeshById = new Map<string, THREE.Mesh>();
    const jointRuntimeById = new Map<string, {
      axis: THREE.Vector3;
      content: THREE.Group;
      restValue: number;
      value: number;
    }>();
    const roomSurfaceMeshes: Array<{
      mesh: THREE.Mesh;
      source: RoomShellSource;
      materials: THREE.MeshStandardMaterial[];
    }> = [];
    const groupIdByFeatureId = new Map<string, string>();
    const jointByGroupId = new Map(joints.map((joint) => [joint.groupId, joint]));
    const primitiveGeometryCache = new Map<string, THREE.BufferGeometry>();
    let renderRequested = true;
    const requestRender = () => {
      renderRequested = true;
    };
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
    let activeJointAnimation: {
      durationMs: number;
      entries: Array<{
        from: number;
        jointId: string;
        runtime: NonNullable<ReturnType<typeof jointRuntimeById.get>>;
      }>;
      request: JointAnimationRequest;
      startedAt: number;
      transitionDurationMs: number;
      transitionStartedAt: number;
    } | null = null;
    playJointAnimationRef.current = (request) => {
      requestRender();
      if (!request) {
        activeJointAnimation = null;
        return;
      }
      const jointIds = request.kind === "pose"
        ? Object.keys(request.jointValues ?? {})
        : [...new Set((request.keyframes ?? []).flatMap((keyframe) => Object.keys(keyframe.jointValues)))];
      const entries = jointIds.flatMap((jointId) => {
        const runtime = jointRuntimeById.get(jointId);
        return runtime ? [{ from: runtime.value, jointId, runtime }] : [];
      });
      if (entries.length === 0) {
        onJointAnimationCompleteRef.current(request.id);
        return;
      }
      const now = performance.now();
      const durationMs = Math.max(100, request.durationMs);
      const previousPhase = request.kind === "clip" && activeJointAnimation?.request.kind === "clip"
        ? (() => {
            const elapsedProgress = (now - activeJointAnimation.startedAt) / activeJointAnimation.durationMs;
            return activeJointAnimation.request.loop
              ? ((elapsedProgress % 1) + 1) % 1
              : THREE.MathUtils.clamp(elapsedProgress, 0, 1);
          })()
        : 0;
      activeJointAnimation = {
        durationMs,
        entries,
        request,
        startedAt: request.kind === "clip" ? now - previousPhase * durationMs : now,
        transitionDurationMs: request.kind === "clip" ? Math.max(0, request.transitionMs ?? 0) : 0,
        transitionStartedAt: now,
      };
    };
    for (const feature of features) {
      const geometryKey = featureGeometryCacheKey(feature);
      let geometry = geometryKey ? primitiveGeometryCache.get(geometryKey) : undefined;
      if (!geometry) {
        geometry = createFeatureGeometry(feature);
        if (geometryKey) primitiveGeometryCache.set(geometryKey, geometry);
      }
      const baseMaterial = createFeatureMaterial(feature);
      const roomSource = feature.type === "mesh" && feature.parameters.source?.kind === "room-shell"
        ? feature.parameters.source
        : null;
      const roomMaterials = roomSource
        ? Array.from({ length: 6 }, () => baseMaterial.clone())
        : null;
      if (roomMaterials) {
        baseMaterial.dispose();
        geometry.clearGroups();
        const roomSurfaceIndexCounts = [36, 36, 36, roomSource?.window.fullWall ? 0 : 144, 108, 36];
        let groupStart = 0;
        roomSurfaceIndexCounts.forEach((count, index) => {
          geometry.addGroup(groupStart, count, index);
          groupStart += count;
        });
      }
      const mesh = new THREE.Mesh(geometry, roomMaterials ?? baseMaterial);
      mesh.position.set(...feature.position);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(feature.rotation[0]),
        THREE.MathUtils.degToRad(feature.rotation[1]),
        THREE.MathUtils.degToRad(feature.rotation[2]),
      );
      mesh.scale.set(...(feature.scale ?? [1, 1, 1]));
      geometry.computeBoundingSphere();
      const shadowPolicy = featureShadowPolicy(feature, geometry.boundingSphere?.radius ?? Number.POSITIVE_INFINITY);
      mesh.castShadow = shadowPolicy.cast;
      mesh.receiveShadow = shadowPolicy.receive;
      mesh.userData.featureId = feature.id;
      mesh.userData.feature = feature;
      featureMeshById.set(feature.id, mesh);
      if (roomSource && roomMaterials) roomSurfaceMeshes.push({ mesh, source: roomSource, materials: roomMaterials });
      const parentGroupId = groupIdByFeatureId.get(feature.id);
      const parentGroup = parentGroupId ? featureGroupContentById.get(parentGroupId) : null;
      const parentJoint = parentGroupId ? jointByGroupId.get(parentGroupId) : null;
      if (parentJoint) mesh.position.sub(new THREE.Vector3(...parentJoint.pivot));
      (parentGroup ?? featureGroup).add(mesh);
    }

    const savedInteractionState = navigationInteractionStateRef.current?.modelId === modelId
      ? navigationInteractionStateRef.current
      : null;
    let seatedInteractionId = savedInteractionState?.seatedInteractionId ?? null;
    const navigationInteractionRuntimes: NavigationInteractionRuntime[] = navigationInteractions.flatMap((interaction) => {
      const groupObject = featureGroupById.get(interaction.groupId);
      if (!groupObject) return [];
      const targetMeshes = interaction.targetFeatureIds
        .map((featureId) => featureMeshById.get(featureId))
        .filter((mesh): mesh is THREE.Mesh => Boolean(mesh));
      let doorPivot: THREE.Group | null = null;
      if (interaction.kind === "door" && targetMeshes.length > 0) {
        const doorMesh = targetMeshes[0]!;
        const doorFeature = doorMesh.userData.feature as ModelFeature | undefined;
        const parent = doorMesh.parent;
        if (parent && doorFeature?.type === "box") {
          const doorWidth = doorFeature.parameters.depth * Math.abs(doorMesh.scale.z);
          doorPivot = new THREE.Group();
          doorPivot.name = `navigation-door-pivot:${interaction.id}`;
          doorPivot.position.set(
            doorMesh.position.x,
            doorMesh.position.y,
            doorMesh.position.z - doorWidth / 2,
          );
          parent.add(doorPivot);
          for (const mesh of targetMeshes) {
            if (mesh.parent !== parent) continue;
            parent.remove(mesh);
            mesh.position.sub(doorPivot.position);
            doorPivot.add(mesh);
          }
        }
      }
      let articulationPivot: THREE.Group | null = null;
      let articulationAxis: THREE.Vector3 | null = null;
      if (
        interaction.kind === "articulation"
        && interaction.jointPivot
        && interaction.jointAxis
        && targetMeshes.length > 0
      ) {
        const parent = targetMeshes[0]!.parent;
        if (parent) {
          articulationPivot = new THREE.Group();
          articulationPivot.name = `navigation-articulation-pivot:${interaction.id}`;
          articulationPivot.position.set(...interaction.jointPivot);
          parent.add(articulationPivot);
          for (const mesh of targetMeshes) {
            if (mesh.parent !== parent) continue;
            parent.remove(mesh);
            mesh.position.sub(articulationPivot.position);
            articulationPivot.add(mesh);
          }
          articulationAxis = new THREE.Vector3(...interaction.jointAxis).normalize();
        }
      }
      const powerMaterials = [...new Set(targetMeshes.flatMap((mesh) => (
        Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      )).filter((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial))]
        .map((material) => ({
          emissive: material.emissive.clone(),
          emissiveIntensity: material.emissiveIntensity,
          material,
        }));
      const raycastMeshes: THREE.Mesh[] = interaction.kind === "door" ? [...targetMeshes] : [];
      if (interaction.kind !== "door" || raycastMeshes.length === 0) {
        groupObject.traverse((child) => {
          if (child instanceof THREE.Mesh) raycastMeshes.push(child);
        });
      }
      const jointInitialValue = interaction.jointInitialValue ?? 0;
      const jointClosedValue = interaction.jointClosedValue ?? 0;
      const jointOpenValue = interaction.jointOpenValue ?? jointInitialValue;
      const savedActive = savedInteractionState?.states.get(interaction.id);
      const active = savedActive ?? (interaction.kind === "articulation"
        ? Math.abs(jointInitialValue - jointOpenValue) <= Math.abs(jointInitialValue - jointClosedValue)
        : false);
      const articulationTargetValue = active ? jointOpenValue : jointClosedValue;
      const runtime: NavigationInteractionRuntime = {
        ...interaction,
        active,
        anchor: articulationPivot ?? doorPivot ?? groupObject,
        articulationAxis,
        articulationCurrentValue: interaction.kind === "articulation" ? articulationTargetValue : 0,
        articulationPivot,
        articulationTargetValue,
        doorPivot,
        dynamicBody: null,
        powerMaterials,
        raycastMeshes,
        targetMeshes,
      };
      if (runtime.kind === "door" && runtime.doorPivot) {
        runtime.doorPivot.rotation.y = runtime.active ? THREE.MathUtils.degToRad(runtime.openAngle ?? 90) : 0;
      }
      if (runtime.kind === "articulation" && runtime.articulationPivot && runtime.articulationAxis) {
        runtime.articulationPivot.setRotationFromAxisAngle(
          runtime.articulationAxis,
          THREE.MathUtils.degToRad(runtime.articulationCurrentValue - jointInitialValue),
        );
      }
      if (runtime.kind === "power") {
        for (const entry of runtime.powerMaterials) {
          entry.material.emissive.copy(runtime.active ? new THREE.Color(0x5adcf0) : entry.emissive);
          entry.material.emissiveIntensity = runtime.active ? 1.45 : entry.emissiveIntensity;
        }
      }
      return [runtime];
    });

    const navigationObstacles: NavigationObstacle[] = [];
    const navigationStaticObstacles: NavigationObstacle[] = [];
    const navigationStaticObstacleByMesh = new Map<THREE.Mesh, NavigationObstacle>();
    const navigationDynamicBodyRuntimes: NavigationDynamicBodyRuntime[] = [];
    const navigationDynamicGroupIds = new Set(navigationDynamicBodies.map((body) => body.groupId));
    let navigationAgent: THREE.Mesh | null = null;
    let navigationPathLine: THREE.Line | null = null;
    let navigationPath: NavigationPoint[] = [];
    let navigationPathIndex = 0;
    let navigationCameraPitch = 0;
    let navigationCameraYaw = 0;
    const navigationVelocity = new THREE.Vector3();
    const navigationResources: Array<{ dispose: () => void }> = [];
    const navigationGround = navigation
      ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -navigation.floorY)
      : null;
    const navigationHitPoint = new THREE.Vector3();
    const navigationAgentPoint = new THREE.Vector3();
    const navigationCandidatePoint = new THREE.Vector3();
    let activeNavigationInteractionId: string | null = null;
    let performNavigationInteraction = (_interactionId: string) => {};

    const replaceNavigationPathLine = () => {
      navigationPathLine?.geometry.dispose();
      (navigationPathLine?.material as THREE.Material | undefined)?.dispose();
      navigationPathLine?.removeFromParent();
      navigationPathLine = null;
      if (!navigation || navigationPath.length < 2) return;
      const geometry = new THREE.BufferGeometry().setFromPoints(navigationPath.map((point) => (
        new THREE.Vector3(point[0], navigation.floorY + 14, point[1])
      )));
      const material = new THREE.LineBasicMaterial({ color: 0x84a920, depthTest: false, transparent: true, opacity: 0.95 });
      navigationPathLine = new THREE.Line(geometry, material);
      navigationPathLine.renderOrder = 18;
      scene.add(navigationPathLine);
    };

    if (navigationMode && navigation?.enabled) {
      featureGroup.updateWorldMatrix(true, true);
      const obstacleBounds = new THREE.Box3();
      featureMeshById.forEach((mesh) => {
        const feature = mesh.userData.feature as ModelFeature | undefined;
        if (feature?.type === "mesh" && feature.parameters.source?.kind === "room-shell") return;
        const groupId = groupIdByFeatureId.get(String(mesh.userData.featureId ?? ""));
        if (groupId && navigationDynamicGroupIds.has(groupId)) return;
        obstacleBounds.setFromObject(mesh);
        if (obstacleBounds.max.y <= navigation.floorY + 60
          || obstacleBounds.min.y >= navigation.floorY + navigation.agentHeight) return;
        const obstacle = {
          minX: obstacleBounds.min.x,
          maxX: obstacleBounds.max.x,
          minZ: obstacleBounds.min.z,
          maxZ: obstacleBounds.max.z,
        };
        navigationObstacles.push(obstacle);
        navigationStaticObstacles.push(obstacle);
        navigationStaticObstacleByMesh.set(mesh, obstacle);
      });

      const savedDynamicBodyStates = navigationDynamicBodyStateRef.current?.modelId === modelId
        ? navigationDynamicBodyStateRef.current.states
        : null;
      for (const body of navigationDynamicBodies) {
        const object = featureGroupById.get(body.groupId);
        if (!object) continue;
        const savedState = savedDynamicBodyStates?.get(body.groupId);
        if (savedState) object.position.copy(savedState.position);
        object.updateWorldMatrix(true, true);
        obstacleBounds.setFromObject(object);
        const obstacle = {
          minX: obstacleBounds.min.x,
          maxX: obstacleBounds.max.x,
          minZ: obstacleBounds.min.z,
          maxZ: obstacleBounds.max.z,
        };
        navigationObstacles.push(obstacle);
        navigationDynamicBodyRuntimes.push({
          friction: body.friction,
          id: body.groupId,
          linearDamping: body.linearDamping,
          mass: body.mass,
          object,
          obstacle,
          velocity: savedState?.velocity.clone() ?? new THREE.Vector3(),
        });
      }
      for (const interaction of navigationInteractionRuntimes) {
        interaction.dynamicBody = navigationDynamicBodyRuntimes.find((body) => body.id === interaction.groupId) ?? null;
      }

      const [minX, maxX, minZ, maxZ] = navigation.bounds;
      const surfaceGeometry = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ);
      const surfaceMaterial = new THREE.MeshBasicMaterial({
        color: 0x98b64a,
        depthWrite: false,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.055,
      });
      const surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
      surfaceMesh.rotation.x = -Math.PI / 2;
      surfaceMesh.position.set((minX + maxX) / 2, navigation.floorY + 4, (minZ + maxZ) / 2);
      surfaceMesh.name = "navigation-surface";
      scene.add(surfaceMesh);
      navigationResources.push(surfaceGeometry, surfaceMaterial);

      const borderGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(minX, navigation.floorY + 8, minZ),
        new THREE.Vector3(maxX, navigation.floorY + 8, minZ),
        new THREE.Vector3(maxX, navigation.floorY + 8, maxZ),
        new THREE.Vector3(minX, navigation.floorY + 8, maxZ),
      ]);
      const borderMaterial = new THREE.LineBasicMaterial({ color: 0x84a920, transparent: true, opacity: 0.7 });
      const border = new THREE.LineLoop(borderGeometry, borderMaterial);
      scene.add(border);
      navigationResources.push(borderGeometry, borderMaterial);

      const capsuleHeight = Math.max(1, navigation.agentHeight - navigation.agentRadius * 2);
      const agentGeometry = new THREE.CapsuleGeometry(navigation.agentRadius, capsuleHeight, 6, 12);
      const agentMaterial = new THREE.MeshStandardMaterial({
        color: 0xa7cc35,
        emissive: 0x26370b,
        roughness: 0.55,
        metalness: 0.08,
        transparent: true,
        opacity: 0.88,
      });
      navigationAgent = new THREE.Mesh(agentGeometry, agentMaterial);
      const savedAgentState = navigationAgentStateRef.current?.modelId === modelId
        ? navigationAgentStateRef.current
        : null;
      navigationAgent.position.copy(savedAgentState?.position ?? new THREE.Vector3(
        navigation.start[0],
        navigation.floorY + navigation.agentHeight / 2,
        navigation.start[1],
      ));
      navigationAgent.rotation.y = savedAgentState?.rotationY
        ?? Math.atan2(-navigation.start[0], -navigation.start[1]);
      navigationVelocity.copy(savedAgentState?.velocity ?? new THREE.Vector3());
      navigationCameraPitch = savedAgentState?.cameraPitch ?? 0;
      navigationCameraYaw = savedAgentState?.cameraYaw ?? navigationAgent.rotation.y;
      navigationAgent.castShadow = true;
      navigationAgent.visible = navigationCameraMode !== "first-person";
      navigationAgent.userData.navigationAgent = true;
      scene.add(navigationAgent);
      navigationResources.push(agentGeometry, agentMaterial);
    }

    const roomCameraPosition = new THREE.Vector3();
    const roomInverseWorldMatrix = new THREE.Matrix4();
    const updateRoomSurfaceVisibility = () => {
      let visibilityChanged = false;
      camera.getWorldPosition(roomCameraPosition);
      for (const { mesh, source, materials } of roomSurfaceMeshes) {
        mesh.updateWorldMatrix(true, false);
        const localCameraPosition = roomCameraPosition
          .clone()
          .applyMatrix4(roomInverseWorldMatrix.copy(mesh.matrixWorld).invert());
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
          if (featureId.endsWith("cyber-room-window-glass")
            || featureId.endsWith("cyber-room-window-frame-left")
            || featureId.endsWith("cyber-room-window-frame-right")) {
            if (featureMesh.visible !== surfaceVisibility[3]) visibilityChanged = true;
            featureMesh.visible = surfaceVisibility[3];
          }
          if (featureId.endsWith("cyber-room-door") || featureId.endsWith("cyber-room-door-handle")) {
            if (featureMesh.visible !== surfaceVisibility[4]) visibilityChanged = true;
            featureMesh.visible = surfaceVisibility[4];
          }
        }
      }
      return visibilityChanged;
    };

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
      requestRender();
      clearSelectionDecorations();
      const selectedIds = new Set(featureIds);
      for (const [featureId, mesh] of featureMeshById) {
        const isSelected = selectedIds.has(featureId);
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (!(material instanceof THREE.MeshStandardMaterial) || material.wireframe) continue;
          material.emissive.setHex(isSelected ? 0x263016 : 0x000000);
          material.emissiveIntensity = isSelected ? 0.34 : 0;
        }
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
      requestRender();
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
      requestRender();
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
    infiniteGrid.mesh.scale.set(camera.far, camera.far, 1);

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
    const mouseLookShield = document.createElement("div");
    mouseLookShield.className = "mouse-look-shield";
    mouseLookShield.setAttribute("aria-hidden", "true");
    container.append(mouseLookShield);
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
    const setNavigationDestination = (event: { clientX: number; clientY: number }) => {
      if (!navigationMode || !navigation || !navigationAgent || !navigationGround) return false;
      const canvasBounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1,
        -((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(navigationGround, navigationHitPoint)) return false;
      const start: NavigationPoint = [navigationAgent.position.x, navigationAgent.position.z];
      const end: NavigationPoint = [navigationHitPoint.x, navigationHitPoint.z];
      navigationPath = findNavigationPath(navigation, navigationObstacles, start, end);
      navigationPathIndex = navigationPath.length > 1 ? 1 : 0;
      replaceNavigationPathLine();
      return true;
    };
    let viewportPointerGesture: {
      button: number;
      dragged: boolean;
      pointerId: number;
      startX: number;
      startY: number;
    } | null = null;
    let suppressNextContextMenu = false;
    let fallbackMouseLookActive = false;
    let fallbackMouseX = 0;
    let fallbackMouseY = 0;
    const deactivateMouseLook = () => {
      fallbackMouseLookActive = false;
      container.classList.remove("pointer-locked", "pointer-lock-fallback");
    };
    const activateFallbackMouseLook = (clientX: number, clientY: number) => {
      fallbackMouseLookActive = true;
      fallbackMouseX = clientX;
      fallbackMouseY = clientY;
      container.classList.add("pointer-locked", "pointer-lock-fallback");
    };
    const requestMouseLook = (event: MouseEvent) => {
      if (!navigationMode || navigationCameraMode === "god") return;
      fallbackMouseX = event.clientX;
      fallbackMouseY = event.clientY;
      const requestPointerLock = renderer.domElement.requestPointerLock;
      if (typeof requestPointerLock !== "function") {
        activateFallbackMouseLook(event.clientX, event.clientY);
        return;
      }
      try {
        void requestPointerLock.call(renderer.domElement).catch(() => {
          activateFallbackMouseLook(event.clientX, event.clientY);
        });
      } catch {
        activateFallbackMouseLook(event.clientX, event.clientY);
      }
    };
    const handleViewportPointerDown = (event: PointerEvent) => {
      if (transformGestureActive) return;
      if (event.button !== 0 && event.button !== 2) return;
      renderer.domElement.focus({ preventScroll: true });
      if (event.button === 0
        && navigationMode
        && navigationCameraMode !== "god") {
        return;
      }
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
        const gesture = viewportPointerGesture;
        gesture.dragged ||= Math.hypot(
          event.clientX - gesture.startX,
          event.clientY - gesture.startY,
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
        if (setNavigationDestination(event)) return;
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
    const handleMouseLookMouseMove = (event: MouseEvent) => {
      const nativePointerLocked = document.pointerLockElement === renderer.domElement;
      if ((!nativePointerLocked && !fallbackMouseLookActive)
        || !navigationMode
        || navigationCameraMode === "god") return;
      const fallbackMovementX = event.clientX - fallbackMouseX;
      const fallbackMovementY = event.clientY - fallbackMouseY;
      const movementX = nativePointerLocked || event.movementX !== 0 ? event.movementX : fallbackMovementX;
      const movementY = nativePointerLocked || event.movementY !== 0 ? event.movementY : fallbackMovementY;
      fallbackMouseX = event.clientX;
      fallbackMouseY = event.clientY;
      navigationCameraYaw -= THREE.MathUtils.clamp(movementX, -240, 240) * 0.0024;
      navigationCameraPitch = THREE.MathUtils.clamp(
        navigationCameraPitch - THREE.MathUtils.clamp(movementY, -240, 240) * 0.0021,
        THREE.MathUtils.degToRad(-65),
        THREE.MathUtils.degToRad(65),
      );
    };
    const handlePointerLockChange = () => {
      const nativePointerLocked = document.pointerLockElement === renderer.domElement;
      if (nativePointerLocked) {
        fallbackMouseLookActive = false;
        container.classList.add("pointer-locked");
        container.classList.remove("pointer-lock-fallback");
      } else if (!fallbackMouseLookActive) {
        container.classList.remove("pointer-locked");
      }
    };
    const handlePointerLockError = () => {
      if (navigationMode && navigationCameraMode !== "god") {
        activateFallbackMouseLook(fallbackMouseX, fallbackMouseY);
      }
    };
    const handleMouseLookKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (!fallbackMouseLookActive && document.pointerLockElement !== renderer.domElement)) return;
      event.preventDefault();
      event.stopPropagation();
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      deactivateMouseLook();
    };
    renderer.domElement.addEventListener("pointerdown", handleViewportPointerDown);
    renderer.domElement.addEventListener("click", requestMouseLook);
    renderer.domElement.addEventListener("pointermove", handleViewportPointerMove);
    renderer.domElement.addEventListener("pointerup", handleViewportPointerUp);
    renderer.domElement.addEventListener("pointerleave", handleViewportPointerLeave);
    renderer.domElement.addEventListener("pointercancel", handleViewportPointerCancel);
    renderer.domElement.addEventListener("contextmenu", handleViewportContextMenu);
    document.addEventListener("mousemove", handleMouseLookMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);
    document.addEventListener("keydown", handleMouseLookKeyDown, true);

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

    const frameBounds = (targetBounds: THREE.Box3) => {
      if (targetBounds.isEmpty()) return;
      const targetCenter = targetBounds.getCenter(new THREE.Vector3());
      const targetSphere = targetBounds.getBoundingSphere(new THREE.Sphere());
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const limitingFov = Math.min(verticalFov, horizontalFov);
      const distance = Math.max(
        targetSphere.radius / Math.max(0.01, Math.sin(limitingFov / 2)) * 1.18,
        maximumDimension * 0.08,
      );
      const direction = camera.position.clone().sub(controls.target);
      if (direction.lengthSq() < 0.0001) direction.copy(viewDirection);
      direction.normalize();
      viewTransition = null;
      controls.target.copy(targetCenter);
      camera.position.copy(targetCenter).addScaledVector(direction, distance);
      camera.lookAt(targetCenter);
      controls.update();
    };

    const frameSelection = () => {
      const selectionBounds = new THREE.Box3();
      const selectionObjects = selectedGroupId
        ? [featureGroupById.get(selectedGroupId)].filter((object): object is THREE.Group => Boolean(object))
        : selectedFeatureIds.map((id) => featureMeshById.get(id)).filter((object): object is THREE.Mesh => Boolean(object));
      if (selectionObjects.length === 0) {
        frameBounds(bounds);
        return;
      }
      selectionObjects.forEach((object) => selectionBounds.expandByObject(object));
      frameBounds(selectionBounds);
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

    const keyboardNavigationKeys = new Set<string>();
    const navigationCodes = new Set([
      "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "ShiftLeft", "ShiftRight", "AltLeft", "AltRight",
    ]);
    const handleViewportKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement !== renderer.domElement || event.metaKey || event.ctrlKey) return;
      if (event.code === "KeyS" && event.shiftKey) return;
      if (event.code === "KeyE" && navigationMode && activeNavigationInteractionId && !event.repeat) {
        event.preventDefault();
        performNavigationInteraction(activeNavigationInteractionId);
        return;
      }
      if (navigationCodes.has(event.code)) {
        event.preventDefault();
        viewTransition = null;
        keyboardNavigationKeys.add(event.code);
        return;
      }
      if (event.repeat) return;
      if (event.code === "KeyF") {
        event.preventDefault();
        frameSelection();
      } else if (event.code === "Home") {
        event.preventDefault();
        frameBounds(bounds);
      } else if (event.code === "Digit1") {
        event.preventDefault();
        switchToView(new THREE.Vector3(0, 0, 1));
      } else if (event.code === "Digit3") {
        event.preventDefault();
        switchToView(new THREE.Vector3(1, 0, 0));
      } else if (event.code === "Digit7") {
        event.preventDefault();
        switchToView(new THREE.Vector3(0, 1, 0));
      }
    };
    const handleViewportKeyUp = (event: KeyboardEvent) => {
      keyboardNavigationKeys.delete(event.code);
    };
    const clearViewportKeys = () => keyboardNavigationKeys.clear();
    window.addEventListener("keydown", handleViewportKeyDown);
    window.addEventListener("keyup", handleViewportKeyUp);
    window.addEventListener("blur", clearViewportKeys);

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
      renderer.domElement.focus({ preventScroll: true });
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
      requestRender();
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

    const keyboardForward = new THREE.Vector3();
    const keyboardRight = new THREE.Vector3();
    const keyboardMovement = new THREE.Vector3();
    const navigationDesiredVelocity = new THREE.Vector3();
    const navigationVelocityDelta = new THREE.Vector3();
    const navigationDisplacement = new THREE.Vector3();
    const navigationPushDirection = new THREE.Vector3();
    const navigationBodyBounds = new THREE.Box3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const navigationCameraForward = new THREE.Vector3();
    const navigationCameraPosition = new THREE.Vector3();
    const navigationCameraTarget = new THREE.Vector3();
    const navigationInteractionBounds = new THREE.Box3();
    const navigationInteractionColor = new THREE.Color(0x5adcf0);
    const navigationInteractionRaycaster = new THREE.Raycaster();
    const navigationInteractionRayPoint = new THREE.Vector2(0, 0);
    const navigationInteractionAimSphere = new THREE.Sphere();
    const navigationInteractionAimDirection = new THREE.Vector3();
    const navigationInteractionCameraDirection = new THREE.Vector3();
    let lastNavigationInteractionPromptKey = "";
    let lastNavigationAimTargetVisible = false;
    let previousFrameTime = performance.now();
    const smoothlyRotateNavigationAgent = (targetRotationY: number, deltaSeconds: number) => {
      if (!navigationAgent) return;
      const rotationDelta = Math.atan2(
        Math.sin(targetRotationY - navigationAgent.rotation.y),
        Math.cos(targetRotationY - navigationAgent.rotation.y),
      );
      navigationAgent.rotation.y += rotationDelta * (1 - Math.exp(-12 * deltaSeconds));
    };
    const moveNavigationVelocityToward = (target: THREE.Vector3, maxDelta: number) => {
      navigationVelocityDelta.copy(target).sub(navigationVelocity);
      const distance = navigationVelocityDelta.length();
      if (distance <= maxDelta || distance < 0.0001) {
        navigationVelocity.copy(target);
        return;
      }
      navigationVelocity.addScaledVector(navigationVelocityDelta, maxDelta / distance);
    };
    const updateDynamicBodyObstacle = (body: NavigationDynamicBodyRuntime) => {
      body.object.updateWorldMatrix(true, true);
      navigationBodyBounds.setFromObject(body.object);
      body.obstacle.minX = navigationBodyBounds.min.x;
      body.obstacle.maxX = navigationBodyBounds.max.x;
      body.obstacle.minZ = navigationBodyBounds.min.z;
      body.obstacle.maxZ = navigationBodyBounds.max.z;
    };
    const translateDynamicBody = (body: NavigationDynamicBodyRuntime, deltaX: number, deltaZ: number) => {
      body.object.position.x += deltaX;
      body.object.position.z += deltaZ;
      updateDynamicBodyObstacle(body);
    };
    const updateStaticObstacleForMesh = (mesh: THREE.Mesh) => {
      const obstacle = navigationStaticObstacleByMesh.get(mesh);
      if (!obstacle) return;
      mesh.updateWorldMatrix(true, false);
      navigationBodyBounds.setFromObject(mesh);
      obstacle.minX = navigationBodyBounds.min.x;
      obstacle.maxX = navigationBodyBounds.max.x;
      obstacle.minZ = navigationBodyBounds.min.z;
      obstacle.maxZ = navigationBodyBounds.max.z;
    };
    const interactionLabel = (interaction: NavigationInteractionRuntime) => {
      if (interaction.kind === "articulation") {
        return interaction.active
          ? navigationInteractionLabels.articulationClose
          : navigationInteractionLabels.articulationOpen;
      }
      if (interaction.kind === "power") {
        return interaction.active ? navigationInteractionLabels.powerOff : navigationInteractionLabels.powerOn;
      }
      if (interaction.kind === "door") {
        return interaction.active ? navigationInteractionLabels.doorClose : navigationInteractionLabels.doorOpen;
      }
      return seatedInteractionId === interaction.id
        ? navigationInteractionLabels.stand
        : navigationInteractionLabels.sit;
    };
    const saveNavigationInteractionState = () => {
      navigationInteractionStateRef.current = {
        modelId,
        seatedInteractionId,
        states: new Map(navigationInteractionRuntimes.map((interaction) => [interaction.id, interaction.active])),
      };
    };
    const applyNavigationInteractionVisualState = (interaction: NavigationInteractionRuntime) => {
      if (interaction.kind === "door" && interaction.doorPivot) {
        interaction.doorPivot.rotation.y = interaction.active
          ? THREE.MathUtils.degToRad(interaction.openAngle ?? 90)
          : 0;
        interaction.doorPivot.updateWorldMatrix(true, true);
        interaction.targetMeshes.forEach(updateStaticObstacleForMesh);
      }
      if (interaction.kind === "power") {
        for (const entry of interaction.powerMaterials) {
          entry.material.emissive.copy(interaction.active ? navigationInteractionColor : entry.emissive);
          entry.material.emissiveIntensity = interaction.active ? 1.45 : entry.emissiveIntensity;
          entry.material.needsUpdate = true;
        }
      }
      if (interaction.kind === "articulation") {
        interaction.articulationTargetValue = interaction.active
          ? interaction.jointOpenValue ?? interaction.jointInitialValue ?? 0
          : interaction.jointClosedValue ?? 0;
      }
    };
    const updateNavigationArticulations = (deltaSeconds: number) => {
      for (const interaction of navigationInteractionRuntimes) {
        if (interaction.kind !== "articulation" || !interaction.articulationPivot || !interaction.articulationAxis) continue;
        const previousValue = interaction.articulationCurrentValue;
        interaction.articulationCurrentValue = THREE.MathUtils.damp(
          previousValue,
          interaction.articulationTargetValue,
          11,
          deltaSeconds,
        );
        if (Math.abs(interaction.articulationCurrentValue - interaction.articulationTargetValue) < 0.05) {
          interaction.articulationCurrentValue = interaction.articulationTargetValue;
        }
        if (interaction.articulationCurrentValue === previousValue) continue;
        interaction.articulationPivot.setRotationFromAxisAngle(
          interaction.articulationAxis,
          THREE.MathUtils.degToRad(
            interaction.articulationCurrentValue - (interaction.jointInitialValue ?? 0),
          ),
        );
        interaction.articulationPivot.updateWorldMatrix(true, true);
        interaction.targetMeshes.forEach(updateStaticObstacleForMesh);
      }
    };
    const syncSeatedNavigationAgent = () => {
      if (!navigation || !navigationAgent || !seatedInteractionId) return;
      const seat = navigationInteractionRuntimes.find((interaction) => interaction.id === seatedInteractionId);
      const body = seat?.dynamicBody;
      if (!seat || !body) {
        seatedInteractionId = null;
        navigationAgent.scale.y = 1;
        navigationAgent.position.y = navigation.floorY + navigation.agentHeight / 2;
        saveNavigationInteractionState();
        return;
      }
      navigationAgent.position.set(
        (body.obstacle.minX + body.obstacle.maxX) / 2,
        navigation.floorY + navigation.agentHeight * 0.37,
        (body.obstacle.minZ + body.obstacle.maxZ) / 2,
      );
      navigationAgent.scale.y = 0.72;
    };
    const standFromNavigationSeat = (seat: NavigationInteractionRuntime) => {
      if (!navigation || !navigationAgent || !seat.dynamicBody) return false;
      const obstacle = seat.dynamicBody.obstacle;
      const clearance = navigation.agentRadius + 80;
      const centerX = (obstacle.minX + obstacle.maxX) / 2;
      const centerZ = (obstacle.minZ + obstacle.maxZ) / 2;
      const candidates: NavigationPoint[] = [
        [centerX, obstacle.maxZ + clearance],
        [centerX, obstacle.minZ - clearance],
        [obstacle.maxX + clearance, centerZ],
        [obstacle.minX - clearance, centerZ],
      ];
      const obstaclesWithoutSeat = navigationObstacles.filter((candidate) => candidate !== obstacle);
      const target = candidates.find((candidate) => isNavigationPointWalkable(
        navigation,
        obstaclesWithoutSeat,
        candidate,
      ));
      if (!target) return false;
      seatedInteractionId = null;
      seat.active = false;
      navigationAgent.scale.y = 1;
      navigationAgent.position.set(target[0], navigation.floorY + navigation.agentHeight / 2, target[1]);
      navigationVelocity.set(0, 0, 0);
      saveNavigationInteractionState();
      return true;
    };
    performNavigationInteraction = (interactionId: string) => {
      if (!navigationMode || !navigation || !navigationAgent) return;
      const interaction = navigationInteractionRuntimes.find((candidate) => candidate.id === interactionId);
      if (!interaction) return;
      if (interaction.kind === "seat") {
        if (seatedInteractionId === interaction.id) {
          if (!standFromNavigationSeat(interaction)) return;
        } else {
          if (!interaction.dynamicBody) return;
          const previousSeat = navigationInteractionRuntimes.find((candidate) => candidate.id === seatedInteractionId);
          if (previousSeat) previousSeat.active = false;
          seatedInteractionId = interaction.id;
          interaction.active = true;
          interaction.dynamicBody.velocity.set(0, 0, 0);
          navigationVelocity.set(0, 0, 0);
          navigationPath = [];
          navigationPathIndex = 0;
          replaceNavigationPathLine();
          syncSeatedNavigationAgent();
          saveNavigationInteractionState();
        }
      } else {
        interaction.active = !interaction.active;
        applyNavigationInteractionVisualState(interaction);
        saveNavigationInteractionState();
      }
      lastNavigationInteractionPromptKey = "";
    };
    performNavigationInteractionRef.current = performNavigationInteraction;
    const collectDynamicBodyPushChain = (
      initialBodies: NavigationDynamicBodyRuntime[],
      deltaX: number,
      deltaZ: number,
    ) => {
      if (!navigation || initialBodies.length === 0) return null;
      const runtimeById = new Map(navigationDynamicBodyRuntimes.map((body) => [body.id, body]));
      const chainIds = collectNavigationPushChain(
        navigation.bounds,
        navigationStaticObstacles,
        navigationDynamicBodyRuntimes,
        initialBodies.map((body) => body.id),
        [deltaX, deltaZ],
      );
      return chainIds?.map((id) => runtimeById.get(id)!).filter(Boolean) ?? null;
    };
    const tryPushDynamicBodies = (candidate: THREE.Vector3, displacement: THREE.Vector3) => {
      if (!navigation || displacement.lengthSq() < 0.0001) return false;
      if (!isNavigationPointWalkable(
        navigation,
        navigationStaticObstacles,
        [candidate.x, candidate.z],
      )) return false;
      const collidedBodies = navigationDynamicBodyRuntimes.filter((body) => (
        candidate.x >= body.obstacle.minX - navigation.agentRadius
        && candidate.x <= body.obstacle.maxX + navigation.agentRadius
        && candidate.z >= body.obstacle.minZ - navigation.agentRadius
        && candidate.z <= body.obstacle.maxZ + navigation.agentRadius
      ));
      if (collidedBodies.length === 0) return false;

      navigationPushDirection.copy(displacement).setY(0);
      if (navigationPushDirection.lengthSq() < 0.0001) return false;
      navigationPushDirection.normalize();
      const pushDistance = displacement.length() * 1.12 + 1.5;
      const deltaX = navigationPushDirection.x * pushDistance;
      const deltaZ = navigationPushDirection.z * pushDistance;
      const pushChain = collectDynamicBodyPushChain(collidedBodies, deltaX, deltaZ);
      if (!pushChain) return false;
      const totalMass = pushChain.reduce((sum, body) => sum + body.mass, 0);
      const impulseSpeed = Math.max(420, navigationVelocity.length()) * (72 / (72 + totalMass)) * 0.86;
      for (const body of pushChain) {
        translateDynamicBody(body, deltaX, deltaZ);
        body.velocity.addScaledVector(navigationPushDirection, impulseSpeed);
        if (body.velocity.length() > 1500) body.velocity.setLength(1500);
      }
      return true;
    };
    const updateNavigationDynamicBodies = (deltaSeconds: number) => {
      for (const body of navigationDynamicBodyRuntimes) {
        const speed = body.velocity.length();
        if (speed < 1) {
          body.velocity.set(0, 0, 0);
          continue;
        }
        const damping = Math.exp(-body.linearDamping * deltaSeconds);
        body.velocity.multiplyScalar(damping);
        const slowedSpeed = Math.max(0, body.velocity.length() - body.friction * 520 * deltaSeconds);
        if (slowedSpeed <= 0) {
          body.velocity.set(0, 0, 0);
          continue;
        }
        body.velocity.setLength(slowedSpeed);
      }

      const advancedBodies = new Set<NavigationDynamicBodyRuntime>();
      for (const body of navigationDynamicBodyRuntimes) {
        if (advancedBodies.has(body) || body.velocity.lengthSq() < 1) continue;
        navigationPushDirection.copy(body.velocity).setY(0);
        const speed = navigationPushDirection.length();
        if (speed < 1) continue;
        navigationPushDirection.normalize();
        const intendedDeltaX = body.velocity.x * deltaSeconds;
        const intendedDeltaZ = body.velocity.z * deltaSeconds;
        const pushChain = collectDynamicBodyPushChain([body], intendedDeltaX, intendedDeltaZ);
        if (!pushChain) {
          body.velocity.set(0, 0, 0);
          advancedBodies.add(body);
          continue;
        }
        const totalMass = pushChain.reduce((sum, member) => sum + member.mass, 0);
        const directionalMomentum = pushChain.reduce((sum, member) => (
          sum + Math.max(0, member.velocity.dot(navigationPushDirection)) * member.mass
        ), 0);
        const sharedSpeed = directionalMomentum / totalMass;
        const deltaX = navigationPushDirection.x * sharedSpeed * deltaSeconds;
        const deltaZ = navigationPushDirection.z * sharedSpeed * deltaSeconds;
        for (const member of pushChain) {
          translateDynamicBody(member, deltaX, deltaZ);
          member.velocity.copy(navigationPushDirection).multiplyScalar(sharedSpeed);
          advancedBodies.add(member);
        }
      }
    };
    const applyNavigationDisplacement = (displacement: THREE.Vector3) => {
      if (!navigation || !navigationAgent || displacement.lengthSq() < 0.0001) return false;
      navigationCandidatePoint.copy(navigationAgent.position).add(displacement);
      const canOccupyCandidate = () => isNavigationPointWalkable(
        navigation,
        navigationObstacles,
        [navigationCandidatePoint.x, navigationCandidatePoint.z],
      );
      if (canOccupyCandidate()
        || (tryPushDynamicBodies(navigationCandidatePoint, displacement) && canOccupyCandidate())) {
        navigationAgent.position.copy(navigationCandidatePoint);
        return true;
      }

      // Resolve each horizontal axis separately so the agent slides along a
      // desk or wall instead of stopping abruptly at a shallow collision.
      let moved = false;
      const moveXFirst = Math.abs(displacement.x) >= Math.abs(displacement.z);
      const tryAxis = (axis: "x" | "z") => {
        const distance = displacement[axis];
        if (Math.abs(distance) < 0.0001 || !navigationAgent) return;
        navigationCandidatePoint.copy(navigationAgent.position);
        navigationCandidatePoint[axis] += distance;
        const axisDisplacement = navigationPushDirection.set(
          axis === "x" ? distance : 0,
          0,
          axis === "z" ? distance : 0,
        );
        if (canOccupyCandidate()
          || (tryPushDynamicBodies(navigationCandidatePoint, axisDisplacement) && canOccupyCandidate())) {
          navigationAgent.position.copy(navigationCandidatePoint);
          moved = true;
        } else {
          navigationVelocity[axis] = 0;
        }
      };
      tryAxis(moveXFirst ? "x" : "z");
      tryAxis(moveXFirst ? "z" : "x");
      return moved;
    };
    const updateNavigationAgent = (deltaSeconds: number) => {
      if (!navigation || !navigationAgent || seatedInteractionId
        || navigationPathIndex <= 0 || navigationPathIndex >= navigationPath.length) return;
      navigationVelocity.set(0, 0, 0);
      const target = navigationPath[navigationPathIndex]!;
      navigationAgentPoint.set(target[0], navigationAgent.position.y, target[1]);
      navigationCandidatePoint.copy(navigationAgentPoint).sub(navigationAgent.position);
      const remainingDistance = navigationCandidatePoint.length();
      const movementDistance = Math.max(720, navigation.agentRadius * 3.2) * deltaSeconds;
      if (remainingDistance <= movementDistance) {
        navigationAgent.position.copy(navigationAgentPoint);
        navigationPathIndex += 1;
        if (navigationPathIndex >= navigationPath.length) {
          navigationPath = [];
          navigationPathIndex = 0;
          replaceNavigationPathLine();
        }
        return;
      }
      navigationCandidatePoint.normalize();
      navigationAgent.position.addScaledVector(navigationCandidatePoint, movementDistance);
      smoothlyRotateNavigationAgent(
        Math.atan2(navigationCandidatePoint.x, navigationCandidatePoint.z),
        deltaSeconds,
      );
      navigationCameraYaw = navigationAgent.rotation.y;
    };
    const updateKeyboardNavigation = (deltaSeconds: number) => {
      const forwardInput = Number(keyboardNavigationKeys.has("KeyW")) - Number(keyboardNavigationKeys.has("KeyS"));
      const rightInput = Number(keyboardNavigationKeys.has("KeyD")) - Number(keyboardNavigationKeys.has("KeyA"));
      const verticalInput = Number(keyboardNavigationKeys.has("KeyE")) - Number(keyboardNavigationKeys.has("KeyQ"));
      const hasHorizontalInput = forwardInput !== 0 || rightInput !== 0;
      const fast = keyboardNavigationKeys.has("ShiftLeft") || keyboardNavigationKeys.has("ShiftRight");
      const precise = keyboardNavigationKeys.has("AltLeft") || keyboardNavigationKeys.has("AltRight");

      if (navigationMode && navigation && navigationAgent) {
        const seatedInteraction = seatedInteractionId
          ? navigationInteractionRuntimes.find((interaction) => interaction.id === seatedInteractionId) ?? null
          : null;
        if (navigationCameraMode === "god") camera.getWorldDirection(keyboardForward);
        else keyboardForward.set(Math.sin(navigationCameraYaw), 0, Math.cos(navigationCameraYaw));
        keyboardForward.y = 0;
        if (keyboardForward.lengthSq() < 0.0001) {
          keyboardForward.copy(camera.up);
          keyboardForward.y = 0;
        }
        keyboardForward.normalize();
        keyboardRight.crossVectors(keyboardForward, worldUp).normalize();
        keyboardMovement
          .set(0, 0, 0)
          .addScaledVector(keyboardForward, forwardInput)
          .addScaledVector(keyboardRight, rightInput);
        if (keyboardMovement.lengthSq() > 1) keyboardMovement.normalize();

        const walkSpeed = seatedInteraction
          ? Math.max(560, navigation.agentRadius * 2.25)
          : Math.max(820, navigation.agentRadius * 3.2);
        const directionMultiplier = forwardInput < 0 ? 0.74 : 1;
        const speedMultiplier = (fast ? 1.75 : 1) * (precise ? 0.42 : 1) * directionMultiplier;
        navigationDesiredVelocity.copy(keyboardMovement).multiplyScalar(walkSpeed * speedMultiplier);
        const response = hasHorizontalInput ? walkSpeed * 7.5 : walkSpeed * 9.5;
        moveNavigationVelocityToward(navigationDesiredVelocity, response * deltaSeconds);

        if (hasHorizontalInput) {
          navigationPath = [];
          navigationPathIndex = 0;
          replaceNavigationPathLine();
        }
        navigationDisplacement.copy(navigationVelocity).multiplyScalar(deltaSeconds);
        let moved = false;
        if (seatedInteraction?.dynamicBody && navigationDisplacement.lengthSq() > 0.0001) {
          const pushChain = collectDynamicBodyPushChain(
            [seatedInteraction.dynamicBody],
            navigationDisplacement.x,
            navigationDisplacement.z,
          );
          if (pushChain) {
            const totalMass = pushChain.reduce((sum, body) => sum + body.mass, 0);
            const movementScale = Math.max(0.32, 72 / (72 + totalMass));
            const deltaX = navigationDisplacement.x * movementScale;
            const deltaZ = navigationDisplacement.z * movementScale;
            for (const body of pushChain) {
              translateDynamicBody(body, deltaX, deltaZ);
              body.velocity.copy(navigationVelocity).multiplyScalar(0.16 * movementScale);
            }
            syncSeatedNavigationAgent();
            moved = true;
          } else {
            navigationVelocity.set(0, 0, 0);
          }
        } else {
          moved = applyNavigationDisplacement(navigationDisplacement);
        }
        if (moved && navigationVelocity.lengthSq() > 400) {
          smoothlyRotateNavigationAgent(
            Math.atan2(navigationVelocity.x, navigationVelocity.z),
            deltaSeconds,
          );
        }
      } else if (forwardInput !== 0 || rightInput !== 0 || verticalInput !== 0) {
        camera.getWorldDirection(keyboardForward);
        keyboardForward.y = 0;
        if (keyboardForward.lengthSq() < 0.0001) {
          keyboardForward.copy(camera.up);
          keyboardForward.y = 0;
        }
        keyboardForward.normalize();
        keyboardRight.crossVectors(keyboardForward, worldUp).normalize();
        keyboardMovement
          .set(0, verticalInput, 0)
          .addScaledVector(keyboardForward, forwardInput)
          .addScaledVector(keyboardRight, rightInput);
        if (keyboardMovement.lengthSq() > 1) keyboardMovement.normalize();
        const speedMultiplier = (fast ? 4 : 1) * (precise ? 0.25 : 1);
        const movementSpeed = Math.max(maximumDimension * 0.32, camera.position.distanceTo(controls.target) * 0.12);
        keyboardMovement.multiplyScalar(movementSpeed * speedMultiplier * deltaSeconds);
        camera.position.add(keyboardMovement);
        controls.target.add(keyboardMovement);
      }

      const yawInput = Number(keyboardNavigationKeys.has("ArrowRight")) - Number(keyboardNavigationKeys.has("ArrowLeft"));
      const pitchInput = Number(keyboardNavigationKeys.has("ArrowDown")) - Number(keyboardNavigationKeys.has("ArrowUp"));
      if (yawInput !== 0 || pitchInput !== 0) {
        if (navigationMode && navigationCameraMode !== "god") {
          navigationCameraYaw -= yawInput * THREE.MathUtils.degToRad(132) * deltaSeconds;
          navigationCameraPitch = THREE.MathUtils.clamp(
            navigationCameraPitch - pitchInput * THREE.MathUtils.degToRad(90) * deltaSeconds,
            THREE.MathUtils.degToRad(-65),
            THREE.MathUtils.degToRad(65),
          );
        } else {
          rotateCameraFromWidget(yawInput * 132 * deltaSeconds, pitchInput * 132 * deltaSeconds);
        }
      }
    };
    const updateNavigationCamera = () => {
      if (!navigationMode || !navigation || !navigationAgent || navigationCameraMode === "god") return;
      const seated = Boolean(seatedInteractionId);
      navigationCameraForward.set(
        Math.sin(navigationCameraYaw),
        0,
        Math.cos(navigationCameraYaw),
      );
      if (navigationCameraMode === "first-person") {
        navigationCameraPosition.set(
          navigationAgent.position.x,
          navigation.floorY + navigation.agentHeight * (seated ? 0.58 : 0.86),
          navigationAgent.position.z,
        );
        const horizontalScale = Math.cos(navigationCameraPitch) * navigation.agentHeight;
        navigationCameraTarget.copy(navigationCameraPosition)
          .addScaledVector(navigationCameraForward, horizontalScale);
        navigationCameraTarget.y += Math.sin(navigationCameraPitch) * navigation.agentHeight;
      } else {
        navigationCameraTarget.set(
          navigationAgent.position.x,
          navigation.floorY + navigation.agentHeight * (seated ? 0.42 : 0.58),
          navigationAgent.position.z,
        );
        const followDistance = navigation.agentHeight * 3.14;
        const elevation = THREE.MathUtils.clamp(
          THREE.MathUtils.degToRad(17) + navigationCameraPitch,
          THREE.MathUtils.degToRad(4),
          THREE.MathUtils.degToRad(72),
        );
        navigationCameraPosition.copy(navigationCameraTarget)
          .addScaledVector(navigationCameraForward, -Math.cos(elevation) * followDistance);
        navigationCameraPosition.y += Math.sin(elevation) * followDistance;
      }
      camera.up.copy(worldUp);
      camera.position.copy(navigationCameraPosition);
      controls.target.copy(navigationCameraTarget);
      camera.lookAt(navigationCameraTarget);
    };
    const updateNavigationInteractionPrompt = () => {
      if (!navigationMode || !navigationAgent) {
        activeNavigationInteractionId = null;
        if (lastNavigationAimTargetVisible) {
          lastNavigationAimTargetVisible = false;
          setNavigationAimTargetVisible(false);
        }
        if (lastNavigationInteractionPromptKey !== "") {
          lastNavigationInteractionPromptKey = "";
          setNavigationInteractionPrompts([]);
        }
        return;
      }
      const nearbyInteractions: Array<{ distance: number; interaction: NavigationInteractionRuntime }> = [];
      for (const interaction of navigationInteractionRuntimes) {
        if (interaction.kind === "seat" && !interaction.dynamicBody) continue;
        if (interaction.id === seatedInteractionId) {
          nearbyInteractions.push({ distance: 0, interaction });
          continue;
        }
        navigationInteractionBounds.makeEmpty();
        if (interaction.targetMeshes.length > 0) {
          interaction.targetMeshes.forEach((mesh) => navigationInteractionBounds.expandByObject(mesh));
        } else {
          navigationInteractionBounds.setFromObject(interaction.anchor);
        }
        if (navigationInteractionBounds.isEmpty()) continue;
        const dx = Math.max(
          navigationInteractionBounds.min.x - navigationAgent.position.x,
          0,
          navigationAgent.position.x - navigationInteractionBounds.max.x,
        );
        const dz = Math.max(
          navigationInteractionBounds.min.z - navigationAgent.position.z,
          0,
          navigationAgent.position.z - navigationInteractionBounds.max.z,
        );
        const distance = Math.hypot(dx, dz);
        if (distance <= (interaction.range ?? 720)) nearbyInteractions.push({ distance, interaction });
      }
      const nearestByKind = new Map<NavigationInteractionRuntime["kind"], typeof nearbyInteractions[number]>();
      for (const candidate of nearbyInteractions) {
        const current = nearestByKind.get(candidate.interaction.kind);
        if (!current || candidate.distance < current.distance) nearestByKind.set(candidate.interaction.kind, candidate);
      }
      camera.updateMatrixWorld(true);
      navigationInteractionRaycaster.setFromCamera(navigationInteractionRayPoint, camera);
      let aimedInteraction: typeof nearbyInteractions[number] | null = null;
      let aimedHitDistance = Infinity;
      for (const candidate of nearbyInteractions) {
        if (candidate.interaction.id === seatedInteractionId) continue;
        candidate.interaction.anchor.updateWorldMatrix(true, true);
        const hit = navigationInteractionRaycaster.intersectObjects(candidate.interaction.raycastMeshes, false)[0];
        if (!hit || hit.distance >= aimedHitDistance) continue;
        aimedInteraction = candidate;
        aimedHitDistance = hit.distance;
      }
      if (!aimedInteraction) {
        // An articulated object such as an open laptop can have an empty gap
        // at its exact screen-space center. Use its angular bounds as a small
        // aim-assist fallback after precise mesh raycasting.
        camera.getWorldDirection(navigationInteractionCameraDirection);
        let smallestAngularMiss = Infinity;
        let angularTargetWorldDistance = Infinity;
        for (const candidate of nearbyInteractions) {
          if (candidate.interaction.id === seatedInteractionId) continue;
          navigationInteractionBounds.setFromObject(candidate.interaction.anchor);
          if (navigationInteractionBounds.isEmpty()) continue;
          navigationInteractionBounds.getBoundingSphere(navigationInteractionAimSphere);
          navigationInteractionAimDirection
            .subVectors(navigationInteractionAimSphere.center, camera.position);
          const worldDistance = navigationInteractionAimDirection.length();
          if (worldDistance < 0.0001) continue;
          navigationInteractionAimDirection.multiplyScalar(1 / worldDistance);
          if (navigationInteractionCameraDirection.dot(navigationInteractionAimDirection) <= 0) continue;
          const angularRadius = Math.asin(THREE.MathUtils.clamp(
            navigationInteractionAimSphere.radius / worldDistance,
            0,
            1,
          ));
          const angularMiss = navigationInteractionCameraDirection.angleTo(navigationInteractionAimDirection) - angularRadius;
          if (angularMiss > THREE.MathUtils.degToRad(3)) continue;
          if (angularMiss > smallestAngularMiss || (angularMiss === smallestAngularMiss && worldDistance >= angularTargetWorldDistance)) continue;
          aimedInteraction = candidate;
          smallestAngularMiss = angularMiss;
          angularTargetWorldDistance = worldDistance;
        }
      }
      const hasAimTarget = aimedInteraction !== null;
      if (lastNavigationAimTargetVisible !== hasAimTarget) {
        lastNavigationAimTargetVisible = hasAimTarget;
        setNavigationAimTargetVisible(hasAimTarget);
      }
      if (aimedInteraction) nearestByKind.set(aimedInteraction.interaction.kind, aimedInteraction);
      const orderedInteractions = [...nearestByKind.values()].sort((first, second) => {
        if (aimedInteraction) {
          if (first.interaction.id === aimedInteraction.interaction.id) return -1;
          if (second.interaction.id === aimedInteraction.interaction.id) return 1;
        }
        const firstPriority = first.interaction.kind === "seat" ? 1 : 0;
        const secondPriority = second.interaction.kind === "seat" ? 1 : 0;
        return firstPriority - secondPriority || first.distance - second.distance;
      });
      const prompts = orderedInteractions.slice(0, 3).map(({ interaction }) => ({
        id: interaction.id,
        label: interactionLabel(interaction),
      }));
      activeNavigationInteractionId = prompts[0]?.id ?? null;
      if (prompts.length === 0) {
        if (lastNavigationAimTargetVisible) {
          lastNavigationAimTargetVisible = false;
          setNavigationAimTargetVisible(false);
        }
        if (lastNavigationInteractionPromptKey !== "") {
          lastNavigationInteractionPromptKey = "";
          setNavigationInteractionPrompts([]);
        }
        return;
      }
      const promptKey = prompts.map((prompt) => `${prompt.id}:${prompt.label}`).join("|");
      if (lastNavigationInteractionPromptKey === promptKey) return;
      lastNavigationInteractionPromptKey = promptKey;
      setNavigationInteractionPrompts(prompts);
    };

    let animationFrame = 0;
    const render = () => {
      const frameTime = performance.now();
      const deltaSeconds = Math.min(0.05, Math.max(0, (frameTime - previousFrameTime) / 1000));
      const controlsChanged = !viewTransition && (!navigationMode || navigationCameraMode === "god")
        ? controls.update()
        : false;
      const continuousRendering = Boolean(
        navigationMode
        || viewTransition
        || activeJointAnimation
        || transformGestureActive
      );
      if (!renderRequested && !controlsChanged && !continuousRendering) {
        animationFrame = window.requestAnimationFrame(render);
        return;
      }
      renderRequested = false;
      previousFrameTime = frameTime;
      const jointAnimationRunning = Boolean(activeJointAnimation);
      if (activeJointAnimation) {
        const elapsedProgress = (frameTime - activeJointAnimation.startedAt) / activeJointAnimation.durationMs;
        const request = activeJointAnimation.request;
        const progress = request.loop
          ? ((elapsedProgress % 1) + 1) % 1
          : THREE.MathUtils.clamp(elapsedProgress, 0, 1);
        if (request.kind === "pose") {
          const easedProgress = easeInOutCubic(progress);
          for (const entry of activeJointAnimation.entries) {
            const target = request.jointValues?.[entry.jointId] ?? entry.from;
            entry.runtime.value = THREE.MathUtils.lerp(entry.from, target, easedProgress);
          }
        } else {
          const keyframes = request.keyframes ?? [];
          const transitionProgress = activeJointAnimation.transitionDurationMs > 0
            ? easeInOutCubic((frameTime - activeJointAnimation.transitionStartedAt) / activeJointAnimation.transitionDurationMs)
            : 1;
          for (const entry of activeJointAnimation.entries) {
            const target = sampleAnimationJointValue(keyframes, entry.jointId, progress, entry.from, request.loop);
            entry.runtime.value = THREE.MathUtils.lerp(entry.from, target, transitionProgress);
          }
        }
        for (const entry of activeJointAnimation.entries) {
          entry.runtime.content.setRotationFromAxisAngle(
            entry.runtime.axis,
            THREE.MathUtils.degToRad(entry.runtime.value - entry.runtime.restValue),
          );
        }
        if (!request.loop && elapsedProgress >= 1) {
          const completedAnimationId = request.id;
          activeJointAnimation = null;
          onJointAnimationCompleteRef.current(completedAnimationId);
        }
      }
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
        updateNavigationDynamicBodies(deltaSeconds);
        updateNavigationArticulations(deltaSeconds);
        syncSeatedNavigationAgent();
        updateKeyboardNavigation(deltaSeconds);
        updateNavigationAgent(deltaSeconds);
        syncSeatedNavigationAgent();
        updateNavigationCamera();
      }
      updateNavigationInteractionPrompt();
      infiniteGrid.mesh.position.set(camera.position.x, GRID_DISPLAY_OFFSET, camera.position.z);
      const roomVisibilityChanged = updateRoomSurfaceVisibility();
      if (jointAnimationRunning || navigationMode || transformGestureActive || roomVisibilityChanged) {
        renderer.shadowMap.needsUpdate = true;
      }
      updateAnnotationTargets();
      updateAxisWidget();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      if (updateSelectionRef.current === applySelection) updateSelectionRef.current = null;
      playJointAnimationRef.current = null;
      if (updateTransformRef.current === applyTransformMode) updateTransformRef.current = null;
      if (updateCutPlaneRef.current === applyCutPlane) updateCutPlaneRef.current = null;
      if (navigationAgent) {
        navigationAgentStateRef.current = {
          cameraPitch: navigationCameraPitch,
          cameraYaw: navigationCameraYaw,
          modelId,
          position: navigationAgent.position.clone(),
          rotationY: navigationAgent.rotation.y,
          velocity: navigationVelocity.clone(),
        };
      }
      if (navigationDynamicBodyRuntimes.length > 0) {
        navigationDynamicBodyStateRef.current = {
          modelId,
          states: new Map(navigationDynamicBodyRuntimes.map((body) => [
            body.id,
            { position: body.object.position.clone(), velocity: body.velocity.clone() },
          ])),
        };
      }
      saveNavigationInteractionState();
      if (performNavigationInteractionRef.current === performNavigationInteraction) {
        performNavigationInteractionRef.current = null;
      }
      if (!navigationMode || navigationCameraMode === "god") {
        savedViewRef.current = {
          modelId,
          position: camera.position.clone(),
          quaternion: camera.quaternion.clone(),
          target: controls.target.clone(),
        };
      }
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handleViewportPointerDown);
      renderer.domElement.removeEventListener("click", requestMouseLook);
      renderer.domElement.removeEventListener("pointermove", handleViewportPointerMove);
      renderer.domElement.removeEventListener("pointerup", handleViewportPointerUp);
      renderer.domElement.removeEventListener("pointerleave", handleViewportPointerLeave);
      renderer.domElement.removeEventListener("pointercancel", handleViewportPointerCancel);
      renderer.domElement.removeEventListener("contextmenu", handleViewportContextMenu);
      document.removeEventListener("mousemove", handleMouseLookMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      document.removeEventListener("keydown", handleMouseLookKeyDown, true);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      deactivateMouseLook();
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      axisWidget.removeEventListener("webglcontextlost", handleContextLost);
      axisWidget.removeEventListener("webglcontextrestored", handleContextRestored);
      window.removeEventListener("keydown", handleViewportKeyDown);
      window.removeEventListener("keyup", handleViewportKeyUp);
      window.removeEventListener("blur", clearViewportKeys);
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
      navigationPathLine?.geometry.dispose();
      (navigationPathLine?.material as THREE.Material | undefined)?.dispose();
      navigationPathLine?.removeFromParent();
      navigationAgent?.removeFromParent();
      for (const resource of navigationResources) resource.dispose();
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
            if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
            material.dispose();
            disposedFeatureMaterials.add(material);
          }
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      axisRenderer.dispose();
      viewCubeGeometry.dispose();
      cubeEdgesGeometry.dispose();
      cubeEdgesMaterial.dispose();
      gridCellGeometry.dispose();
      gridCellMaterial.dispose();
      gridCellHoverMaterial.dispose();
      infiniteGrid.geometry.dispose();
      infiniteGrid.material.dispose();
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
      mouseLookShield.remove();
    };
  }, [features, groups, joints, label, modelId, navigation, navigationCameraMode, navigationDynamicBodies, navigationInteractionLabels, navigationInteractions, navigationMode, theme, viewCubeLabel, viewLabels]);

  useEffect(() => {
    playJointAnimationRef.current?.(jointAnimation);
  }, [jointAnimation]);

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
    <div className={`viewport-3d${navigationMode ? " navigation-active" : ""}`} ref={containerRef}>
      <canvas className="axis-widget" ref={axisWidgetRef} aria-label={viewCubeLabel} />
      {navigationMode && navigation?.enabled && (
        <div className="navigation-mode-banner">
          <div className="navigation-camera-modes" role="group" aria-label={navigationModeLabel}>
            {(["god", "first-person", "third-person"] as const).map((mode) => (
              <button
                className={navigationCameraMode === mode ? "active" : ""}
                key={mode}
                type="button"
                aria-pressed={navigationCameraMode === mode}
                onClick={() => onNavigationCameraModeChange(mode)}
              >
                {navigationCameraLabels[mode]}
              </button>
            ))}
          </div>
        </div>
      )}
      {navigationMode && navigationInteractionPrompts.length > 0 && (
        <div className="navigation-interaction-prompts" aria-label={navigationModeLabel}>
          {navigationInteractionPrompts.map((prompt, index) => (
            <button
              className="navigation-interaction-prompt"
              key={prompt.id}
              type="button"
              onClick={() => {
                performNavigationInteractionRef.current?.(prompt.id);
                containerRef.current?.querySelector<HTMLCanvasElement>("canvas[data-testid='model-canvas']")?.focus({ preventScroll: true });
              }}
            >
              {index === 0 && <kbd>{navigationInteractionLabels.keyHint}</kbd>}
              <span>{prompt.label}</span>
            </button>
          ))}
        </div>
      )}
      {navigationMode && navigationAimTargetVisible && <span className="navigation-aim-target" aria-hidden="true" />}
      {rendererFailed && (
        <div className="viewport-renderer-fallback" role="alert">
          <span>{rendererFailureLabel}</span>
          <button type="button" onClick={() => window.location.reload()}>{rendererReloadLabel}</button>
        </div>
      )}
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
                  : feature.parameters.source?.kind === "room-shell"
                    ? annotationStrings.roomShell
                    : feature.parameters.source
                      ? annotationStrings.proceduralShell
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
