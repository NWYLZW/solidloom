import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ModelFeature } from "@solidloom/shared";
import { collectNavigationPushChain, findNavigationPath, isNavigationPointWalkable, type NavigationObstacle, type NavigationPoint } from "../navigation";
import { shouldRefreshShadowMap, shouldScheduleViewportFrame } from "../renderPerformance";
import type { JointAnimationRequest } from "../articulation/types";
import { createNavigationAvatar, type NavigationAvatar } from "../navigationAvatar";
import type {
  TransformMode,
  Viewport3DProps,
} from "./types";
import {
  AXIS_WIDGET_SIZE,
  GRID_DISPLAY_OFFSET,
  createInfiniteGrid,
} from "./scenePrimitives";
import { createViewCubeRuntime } from "./viewCubeRuntime";
import { createAnnotationProjector } from "./annotationProjection";
import { createModelSceneRuntime } from "./modelSceneRuntime";
import {
  createNavigationInteractionRuntimes,
  type NavigationDynamicBodyRuntime,
  type NavigationInteractionRuntime,
} from "./navigationInteractionRuntime";
import { createSelectionTransformRuntime } from "./selectionTransformRuntime";
import { createJointAnimationRuntime } from "./jointAnimationRuntime";
import { createViewportPointerRuntime } from "./viewportPointerRuntime";
import { createCameraControllerRuntime } from "./cameraControllerRuntime";
import { createRoomSurfaceVisibilityRuntime } from "./roomSurfaceVisibilityRuntime";
import { createNavigationSeatPoseResolver } from "./navigationSeat";
import { createFeatureLodRuntime } from "./featureLodRuntime";

export function useViewport3DRuntime({ cutPlane, features, groups, jointAnimation, joints, label, modelId, navigation, navigationAvatarSkin, navigationCameraMode, navigationDynamicBodies, navigationInteractions, navigationInteractionLabels, navigationMode, onJointAnimationComplete, onSelectFeature, onSelectGroup, onOpenContextMenu, onTransformCommit, selectedFeatureIds, selectedGroupId, theme, transformMode, viewCubeLabel, viewLabels }: Viewport3DProps) {
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

    const viewCubeRuntime = createViewCubeRuntime(axisWidget, viewLabels);
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

    let renderRequested = true;
    let animationFrame = 0;
    let renderFrame: FrameRequestCallback = () => {};
    let rendererDisposed = false;
    const scheduleRender = () => {
      if (rendererDisposed || animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame((frameTime) => renderFrame(frameTime));
    };
    const requestRender = () => {
      renderRequested = true;
      scheduleRender();
    };
    const modelSceneRuntime = createModelSceneRuntime({
      features,
      groups,
      joints,
      requestRender,
      scene,
    });
    const {
      featureGroup,
      featureGroupById,
      featureLodById,
      featureLodEntries,
      featureMeshById,
      groupIdByFeatureId,
      jointRuntimeById,
      roomSurfaceMeshes,
    } = modelSceneRuntime;
    const jointAnimationRuntime = createJointAnimationRuntime(
      jointRuntimeById,
      (animationId) => onJointAnimationCompleteRef.current(animationId),
      requestRender,
    );
    playJointAnimationRef.current = jointAnimationRuntime.play;
    const savedInteractionState = navigationInteractionStateRef.current?.modelId === modelId
      ? navigationInteractionStateRef.current
      : null;
    let navigationShadowStateChanged = false;
    let seatedInteractionId = savedInteractionState?.seatedInteractionId ?? null;
    const navigationInteractionRuntimes = createNavigationInteractionRuntimes({
      featureGroupById,
      featureMeshById,
      interactions: navigationInteractions,
      savedStates: savedInteractionState?.states,
    });
    const navigationSeatPoseResolver = createNavigationSeatPoseResolver();

    const navigationObstacles: NavigationObstacle[] = [];
    const navigationStaticObstacles: NavigationObstacle[] = [];
    const navigationStaticObstacleByMesh = new Map<THREE.Mesh, NavigationObstacle>();
    const navigationDynamicBodyRuntimes: NavigationDynamicBodyRuntime[] = [];
    const navigationDynamicGroupIds = new Set(navigationDynamicBodies.map((body) => body.groupId));
    let navigationAgent: THREE.Group | null = null;
    let navigationAvatar: NavigationAvatar | null = null;
    let navigationAvatarAnimating = false;
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

      navigationAvatar = createNavigationAvatar({
        agentHeight: navigation.agentHeight,
        onTextureReady: requestRender,
        skin: navigationAvatarSkin,
      });
      navigationAgent = navigationAvatar.object;
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
    }

    const roomSurfaceVisibilityRuntime = createRoomSurfaceVisibilityRuntime({
      camera,
      featureMeshById,
      roomSurfaceMeshes,
    });

    const updateAnnotationTargets = createAnnotationProjector({
      camera,
      container,
      featureGroupById,
      featureMeshById,
      overlayRef: annotationOverlayRef,
    });
    const bounds = new THREE.Box3().setFromObject(featureGroup);
    const selectionTransformRuntime = createSelectionTransformRuntime({
      camera,
      controls,
      cornerBoxColor: computedStyle.getPropertyValue("--color-text").trim() || "#f7f8f3",
      cutPlane,
      domElement: renderer.domElement,
      featureGroupById,
      featureLodById,
      featureMeshById,
      onTransformCommit: (transforms) => onTransformCommitRef.current(transforms),
      requestRender,
      scene,
      selectedFeatureIds,
      selectedGroupId,
      transformMode,
    });
    updateSelectionRef.current = selectionTransformRuntime.applySelection;
    updateTransformRef.current = selectionTransformRuntime.applyTransformMode;
    updateCutPlaneRef.current = selectionTransformRuntime.applyCutPlane;

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


    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
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
      requestRender();
      return true;
    };
    const viewportPointerRuntime = createViewportPointerRuntime({
      adjustNavigationCamera: (yawDelta, pitchDelta) => {
        navigationCameraYaw += yawDelta;
        navigationCameraPitch = THREE.MathUtils.clamp(
          navigationCameraPitch + pitchDelta,
          THREE.MathUtils.degToRad(-65),
          THREE.MathUtils.degToRad(65),
        );
      },
      camera,
      cameraMode: navigationCameraMode,
      container,
      domElement: renderer.domElement,
      featureGroup,
      isTransformGestureActive: () => selectionTransformRuntime.transformGestureActive,
      navigationMode,
      onOpenContextMenu: (featureId, point) => onOpenContextMenuRef.current(featureId, point),
      onSelectFeature: (featureId, additive) => onSelectFeatureRef.current(featureId, additive),
      requestRender,
      setNavigationDestination,
    });

    const cameraControllerRuntime = createCameraControllerRuntime({
      axisRenderer,
      axisWidget,
      boundingSphere,
      bounds,
      camera,
      center,
      container,
      controls,
      featureGroupById,
      featureMeshById,
      getActiveNavigationInteractionId: () => activeNavigationInteractionId,
      maximumDimension,
      navigationMode,
      performNavigationInteraction,
      renderer,
      requestRender,
      savedView,
      selectedFeatureIds,
      selectedGroupId,
      viewCubeRuntime,
      viewDirection,
    });
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
    const navigationPreviousAgentPosition = new THREE.Vector3();
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
      if (Math.abs(deltaX) + Math.abs(deltaZ) < 0.0001) return;
      body.object.position.x += deltaX;
      body.object.position.z += deltaZ;
      updateDynamicBodyObstacle(body);
      navigationShadowStateChanged = true;
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
        navigationShadowStateChanged = true;
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
        navigationShadowStateChanged = true;
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
      const seatPose = navigationSeatPoseResolver.resolve({
        agentHeight: navigation.agentHeight,
        fallbackFloorY: navigation.floorY,
        object: body.object,
        obstacle: body.obstacle,
        targetMeshes: seat.targetMeshes,
      });
      navigationAgent.position.copy(seatPose.position);
      navigationAgent.rotation.y = seatPose.rotationY;
      navigationAgent.scale.y = 1;
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
      requestRender();
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
      const keyboardNavigationKeys = cameraControllerRuntime.keyboardNavigationKeys;
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
        if (!seatedInteraction && moved && navigationVelocity.lengthSq() > 400) {
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
          cameraControllerRuntime.rotateCamera(yawInput * 132 * deltaSeconds, pitchInput * 132 * deltaSeconds);
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

    const featureLodRuntime = createFeatureLodRuntime({
      camera,
      container,
      entries: featureLodEntries,
      isFeatureSelected: selectionTransformRuntime.isFeatureSelected,
    });
    const navigationNeedsContinuousRendering = () => Boolean(navigationMode && (
      navigationAvatarAnimating
      || cameraControllerRuntime.keyboardNavigationKeys.size > 0
      || navigationPathIndex > 0
      || navigationVelocity.lengthSq() > 1
      || navigationDynamicBodyRuntimes.some((body) => body.velocity.lengthSq() > 1)
      || navigationInteractionRuntimes.some((interaction) => (
        interaction.kind === "articulation"
        && Math.abs(interaction.articulationCurrentValue - interaction.articulationTargetValue) > 0.01
      ))
    ));
    renderFrame = (frameTime) => {
      animationFrame = 0;
      const deltaSeconds = Math.min(0.05, Math.max(0, (frameTime - previousFrameTime) / 1000));
      const controlsChanged = !cameraControllerRuntime.viewTransitionActive && (!navigationMode || navigationCameraMode === "god")
        ? controls.update()
        : false;
      const continuousRendering = Boolean(
        navigationNeedsContinuousRendering()
        || cameraControllerRuntime.viewTransitionActive
        || jointAnimationRuntime.active
        || selectionTransformRuntime.transformGestureActive
      );
      if (!renderRequested && !controlsChanged && !continuousRendering) {
        return;
      }
      renderRequested = false;
      previousFrameTime = frameTime;
      const jointAnimationRunning = jointAnimationRuntime.active;
      const pendingNavigationShadowChange = navigationShadowStateChanged;
      navigationShadowStateChanged = false;
      const previousAgentRotationY = navigationAgent?.rotation.y ?? 0;
      const previousAgentScaleY = navigationAgent?.scale.y ?? 1;
      if (navigationAgent) navigationPreviousAgentPosition.copy(navigationAgent.position);
      jointAnimationRuntime.update(frameTime);
      const viewTransitionRunning = cameraControllerRuntime.viewTransitionActive;
      cameraControllerRuntime.updateTransition(frameTime);
      if (!viewTransitionRunning) {
        updateNavigationDynamicBodies(deltaSeconds);
        updateNavigationArticulations(deltaSeconds);
        syncSeatedNavigationAgent();
        updateKeyboardNavigation(deltaSeconds);
        updateNavigationAgent(deltaSeconds);
        syncSeatedNavigationAgent();
        if (navigationAgent && navigationAvatar) {
          const horizontalDistance = Math.hypot(
            navigationAgent.position.x - navigationPreviousAgentPosition.x,
            navigationAgent.position.z - navigationPreviousAgentPosition.z,
          );
          const speed = deltaSeconds > 0 ? horizontalDistance / deltaSeconds : 0;
          navigationAvatarAnimating = navigationAvatar.update(speed, Boolean(seatedInteractionId), deltaSeconds);
        }
        updateNavigationCamera();
      }
      updateNavigationInteractionPrompt();
      infiniteGrid.mesh.position.set(camera.position.x, GRID_DISPLAY_OFFSET, camera.position.z);
      const roomVisibilityChanged = roomSurfaceVisibilityRuntime.update();
      const lodChanged = featureLodRuntime.update();
      const navigationAgentChanged = Boolean(navigationAgent && (
        navigationPreviousAgentPosition.distanceToSquared(navigationAgent.position) > 0.0001
        || Math.abs(previousAgentRotationY - navigationAgent.rotation.y) > 0.0001
        || Math.abs(previousAgentScaleY - navigationAgent.scale.y) > 0.0001
      ));
      if (shouldRefreshShadowMap({
        jointAnimationActive: jointAnimationRunning,
        navigationObjectChanged: pendingNavigationShadowChange
          || navigationShadowStateChanged
          || navigationAgentChanged
          || navigationAvatarAnimating
          || lodChanged,
        roomVisibilityChanged,
        transformActive: selectionTransformRuntime.transformGestureActive,
      })) {
        renderer.shadowMap.needsUpdate = true;
      }
      navigationShadowStateChanged = false;
      updateAnnotationTargets();
      cameraControllerRuntime.updateAxisWidget();
      renderer.render(scene, camera);
      if (shouldScheduleViewportFrame({
        controlsChanged,
        jointAnimationActive: jointAnimationRuntime.active,
        navigationActive: navigationNeedsContinuousRendering(),
        renderRequested,
        transformActive: selectionTransformRuntime.transformGestureActive,
        viewTransitionActive: cameraControllerRuntime.viewTransitionActive,
      })) scheduleRender();
    };
    scheduleRender();

    return () => {
      if (updateSelectionRef.current === selectionTransformRuntime.applySelection) updateSelectionRef.current = null;
      playJointAnimationRef.current = null;
      if (updateTransformRef.current === selectionTransformRuntime.applyTransformMode) updateTransformRef.current = null;
      if (updateCutPlaneRef.current === selectionTransformRuntime.applyCutPlane) updateCutPlaneRef.current = null;
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
      rendererDisposed = true;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      viewportPointerRuntime.dispose();
      cameraControllerRuntime.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      axisWidget.removeEventListener("webglcontextlost", handleContextLost);
      axisWidget.removeEventListener("webglcontextrestored", handleContextRestored);
      selectionTransformRuntime.dispose();
      controls.dispose();
      navigationPathLine?.geometry.dispose();
      (navigationPathLine?.material as THREE.Material | undefined)?.dispose();
      navigationPathLine?.removeFromParent();
      navigationAgent?.removeFromParent();
      navigationAvatar?.dispose();
      for (const resource of navigationResources) resource.dispose();
      modelSceneRuntime.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      axisRenderer.dispose();
      viewCubeRuntime.dispose();
      infiniteGrid.geometry.dispose();
      infiniteGrid.material.dispose();
      renderer.domElement.remove();
    };
  }, [features, groups, joints, label, modelId, navigation, navigationAvatarSkin, navigationCameraMode, navigationDynamicBodies, navigationInteractionLabels, navigationInteractions, navigationMode, theme, viewCubeLabel, viewLabels]);

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

  const performNavigationInteraction = (interactionId: string) => {
    performNavigationInteractionRef.current?.(interactionId);
    containerRef.current
      ?.querySelector<HTMLCanvasElement>("canvas[data-testid='model-canvas']")
      ?.focus({ preventScroll: true });
  };

  return {
    annotationOverlayRef,
    axisWidgetRef,
    containerRef,
    navigationAimTargetVisible,
    navigationInteractionPrompts,
    performNavigationInteraction,
    rendererFailed,
  };
}
