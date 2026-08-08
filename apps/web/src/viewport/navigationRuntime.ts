import type { ModelFeature, NavigationSurface } from "@solidloom/shared";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  collectNavigationPushChain,
  findNavigationPath,
  isNavigationPointWalkable,
  type NavigationObstacle,
  type NavigationPoint,
} from "../navigation";
import { createNavigationAvatar, type NavigationAvatar, type NavigationAvatarSkin } from "../navigationAvatar";
import {
  createNavigationInteractionRuntimes,
  type NavigationDynamicBodyRuntime,
  type NavigationInteractionRuntime,
} from "./navigationInteractionRuntime";
import { createNavigationSeatPoseResolver } from "./navigationSeat";
import {
  createNavigationOperationProgramRuntime,
  type SavedNavigationOperationProgramState,
} from "./navigationOperationProgramRuntime";
import {
  createContainerProductState,
  reconcileContainerInventory,
  type ContainerProductDefinition,
} from "./containerInventory";
import type {
  NavigationCameraMode,
  NavigationContainerOperation,
  NavigationContainerPanelState,
  NavigationDeviceOperation,
  NavigationDevicePanelState,
  NavigationInteractionDescriptor,
  NavigationPrompt,
  Viewport3DProps,
} from "./types";
import type { RuntimeDisposable } from "./runtimeLifecycle";

export interface SavedNavigationRuntimeState {
  agent: {
    cameraPitch: number;
    cameraYaw: number;
    modelId: string;
    position: THREE.Vector3;
    rotationY: number;
    velocity: THREE.Vector3;
  } | null;
  dynamicBodies: {
    modelId: string;
    states: Map<string, { position: THREE.Vector3; velocity: THREE.Vector3 }>;
  } | null;
  interactions: {
    containerConfigurations: Map<string, {
      capacity: number;
      currency: string | undefined;
      label: string | undefined;
      products: ContainerProductDefinition[];
    }>;
    containerItems: Map<string, Array<{ id: string; name: string; productId?: string }>>;
    deviceSelections: Map<string, Record<string, string>>;
    deviceProgramStates: Map<string, SavedNavigationOperationProgramState>;
    deviceStatuses: Map<string, string | null>;
    modelId: string;
    seatedInteractionId: string | null;
    states: Map<string, boolean>;
  } | null;
}

export interface NavigationFrameInput {
  deltaSeconds: number;
  keyboardNavigationKeys: ReadonlySet<string>;
  rotateCamera: (deltaX: number, deltaY: number) => void;
  viewTransitionActive: boolean;
}

export interface NavigationFrameResult {
  navigationObjectChanged: boolean;
}

interface NavigationSystemContext {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly domElement: HTMLCanvasElement;
  readonly featureGroup: THREE.Group;
  readonly featureGroupById: Map<string, THREE.Group>;
  readonly featureMeshById: Map<string, THREE.Mesh>;
  readonly groupIdByFeatureId: Map<string, string>;
  readonly maximumDimension: number;
  readonly requestRender: () => void;
  readonly scene: THREE.Scene;
}

interface CreateNavigationRuntimeOptions extends NavigationSystemContext {
  modelId: string;
  navigation: NavigationSurface | null;
  navigationAvatarSkin: NavigationAvatarSkin | null;
  navigationCameraMode: NavigationCameraMode;
  navigationCanConfigureInteractions: boolean;
  navigationDynamicBodies: Viewport3DProps["navigationDynamicBodies"];
  navigationInteractionLabels: Viewport3DProps["navigationInteractionLabels"];
  navigationInteractions: NavigationInteractionDescriptor[];
  navigationMode: boolean;
  onAimTargetVisibleChange: (visible: boolean) => void;
  onContainerPanelChange: (state: NavigationContainerPanelState | null) => void;
  onDevicePanelChange: (state: NavigationDevicePanelState | null) => void;
  onPromptsChange: (prompts: NavigationPrompt[]) => void;
  savedState: SavedNavigationRuntimeState | null;
}

export interface NavigationRuntime extends RuntimeDisposable {
  adjustCamera: (yawDelta: number, pitchDelta: number) => void;
  captureState: () => SavedNavigationRuntimeState;
  getActiveInteractionId: () => string | null;
  needsContinuousRendering: (keyboardNavigationKeys: ReadonlySet<string>) => boolean;
  performContainerOperation: (interactionId: string, operation: NavigationContainerOperation) => void;
  performDeviceOperation: (interactionId: string, operation: NavigationDeviceOperation) => void;
  performInteraction: (interactionId: string) => boolean;
  setDestination: (event: { clientX: number; clientY: number }) => boolean;
  update: (input: NavigationFrameInput) => NavigationFrameResult;
}

export function createNavigationRuntime({
  camera,
  controls,
  domElement,
  featureGroup,
  featureGroupById,
  featureMeshById,
  groupIdByFeatureId,
  maximumDimension,
  modelId,
  navigation,
  navigationAvatarSkin,
  navigationCameraMode,
  navigationCanConfigureInteractions,
  navigationDynamicBodies,
  navigationInteractionLabels,
  navigationInteractions,
  navigationMode,
  onAimTargetVisibleChange,
  onContainerPanelChange,
  onDevicePanelChange,
  onPromptsChange,
  requestRender,
  savedState,
  scene,
}: CreateNavigationRuntimeOptions): NavigationRuntime {
  const savedInteractionState = savedState?.interactions?.modelId === modelId
    ? savedState.interactions
    : null;
  let navigationShadowStateChanged = false;
  let seatedInteractionId = savedInteractionState?.seatedInteractionId ?? null;
  const navigationInteractionRuntimes = createNavigationInteractionRuntimes({
    featureGroupById,
    featureMeshById,
    interactions: navigationInteractions,
    savedContainerConfigurations: savedInteractionState?.containerConfigurations,
    savedContainerItems: savedInteractionState?.containerItems,
    savedDeviceSelections: savedInteractionState?.deviceSelections,
    savedDeviceStatuses: savedInteractionState?.deviceStatuses,
    savedStates: savedInteractionState?.states,
  });
  let navigationOperationProgramRuntime: ReturnType<typeof createNavigationOperationProgramRuntime> | null = null;
  const navigationSeatPoseResolver = createNavigationSeatPoseResolver();
  const navigationObstacles: NavigationObstacle[] = [];
  const navigationStaticObstacles: NavigationObstacle[] = [];
  const navigationStaticObstacleByMesh = new Map<THREE.Mesh, NavigationObstacle>();
  const navigationDynamicBodyRuntimes: NavigationDynamicBodyRuntime[] = [];
  const navigationDynamicGroupIds = new Set(navigationDynamicBodies.map((body) => body.groupId));
  const navigationResources: Array<{ dispose: () => void }> = [];
  const navigationSceneObjects: THREE.Object3D[] = [];
  let navigationAgent: THREE.Group | null = null;
  let navigationAvatar: NavigationAvatar | null = null;
  let navigationAvatarAnimating = false;
  let navigationPathLine: THREE.Line | null = null;
  let navigationPath: NavigationPoint[] = [];
  let navigationPathIndex = 0;
  let navigationCameraPitch = 0;
  let navigationCameraYaw = 0;
  const navigationVelocity = new THREE.Vector3();
  const navigationGround = navigation
    ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -navigation.floorY)
    : null;
  const navigationHitPoint = new THREE.Vector3();
  const navigationAgentPoint = new THREE.Vector3();
  const navigationCandidatePoint = new THREE.Vector3();
  let activeNavigationInteractionId: string | null = null;

  const replaceNavigationPathLine = () => {
    navigationPathLine?.geometry.dispose();
    (navigationPathLine?.material as THREE.Material | undefined)?.dispose();
    navigationPathLine?.removeFromParent();
    navigationPathLine = null;
    if (!navigation || navigationPath.length < 2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(navigationPath.map((point) => (
      new THREE.Vector3(point[0], navigation.floorY + 14, point[1])
    )));
    const material = new THREE.LineBasicMaterial({
      color: 0x84a920,
      depthTest: false,
      opacity: 0.95,
      transparent: true,
    });
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

    const savedDynamicBodyStates = savedState?.dynamicBodies?.modelId === modelId
      ? savedState.dynamicBodies.states
      : null;
    for (const body of navigationDynamicBodies) {
      const object = featureGroupById.get(body.groupId);
      if (!object) continue;
      const savedBodyState = savedDynamicBodyStates?.get(body.groupId);
      if (savedBodyState) object.position.copy(savedBodyState.position);
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
        velocity: savedBodyState?.velocity.clone() ?? new THREE.Vector3(),
      });
    }
    for (const interaction of navigationInteractionRuntimes) {
      interaction.dynamicBody = navigationDynamicBodyRuntimes.find((body) => body.id === interaction.groupId) ?? null;
      if (interaction.kind !== "seat") continue;
      if (interaction.dynamicBody) {
        interaction.seatObject = interaction.dynamicBody.object;
        interaction.seatObstacle = interaction.dynamicBody.obstacle;
        continue;
      }
      const seatObject = featureGroupById.get(interaction.groupId);
      if (!seatObject) continue;
      obstacleBounds.makeEmpty();
      for (const mesh of interaction.targetMeshes) obstacleBounds.expandByObject(mesh);
      if (obstacleBounds.isEmpty()) obstacleBounds.setFromObject(seatObject);
      interaction.seatObject = seatObject;
      interaction.seatObstacle = {
        minX: obstacleBounds.min.x,
        maxX: obstacleBounds.max.x,
        minZ: obstacleBounds.min.z,
        maxZ: obstacleBounds.max.z,
      };
    }

    const [minX, maxX, minZ, maxZ] = navigation.bounds;
    const surfaceGeometry = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ);
    const surfaceMaterial = new THREE.MeshBasicMaterial({
      color: 0x98b64a,
      depthWrite: false,
      opacity: 0.055,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
    surfaceMesh.rotation.x = -Math.PI / 2;
    surfaceMesh.position.set((minX + maxX) / 2, navigation.floorY + 4, (minZ + maxZ) / 2);
    surfaceMesh.name = "navigation-surface";
    scene.add(surfaceMesh);
    navigationResources.push(surfaceGeometry, surfaceMaterial);
    navigationSceneObjects.push(surfaceMesh);

    const borderGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(minX, navigation.floorY + 8, minZ),
      new THREE.Vector3(maxX, navigation.floorY + 8, minZ),
      new THREE.Vector3(maxX, navigation.floorY + 8, maxZ),
      new THREE.Vector3(minX, navigation.floorY + 8, maxZ),
    ]);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0x84a920, opacity: 0.7, transparent: true });
    const border = new THREE.LineLoop(borderGeometry, borderMaterial);
    scene.add(border);
    navigationResources.push(borderGeometry, borderMaterial);
    navigationSceneObjects.push(border);

    navigationAvatar = createNavigationAvatar({
      agentHeight: navigation.agentHeight,
      onTextureReady: requestRender,
      skin: navigationAvatarSkin,
    });
    navigationAgent = navigationAvatar.object;
    const savedAgentState = savedState?.agent?.modelId === modelId ? savedState.agent : null;
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

  const destinationRaycaster = new THREE.Raycaster();
  const destinationPointer = new THREE.Vector2();
  const setDestination = (event: { clientX: number; clientY: number }) => {
    if (!navigationMode || !navigation || !navigationAgent || !navigationGround) return false;
    const canvasBounds = domElement.getBoundingClientRect();
    destinationPointer.set(
      ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1,
      -((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1,
    );
    destinationRaycaster.setFromCamera(destinationPointer, camera);
    if (!destinationRaycaster.ray.intersectPlane(navigationGround, navigationHitPoint)) return false;
    const start: NavigationPoint = [navigationAgent.position.x, navigationAgent.position.z];
    const end: NavigationPoint = [navigationHitPoint.x, navigationHitPoint.z];
    navigationPath = findNavigationPath(navigation, navigationObstacles, start, end);
    navigationPathIndex = navigationPath.length > 1 ? 1 : 0;
    replaceNavigationPathLine();
    requestRender();
    return true;
  };

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
  const navigationInteractionAnchorPoint = new THREE.Vector3();
  let lastNavigationInteractionPromptKey = "";
  let lastNavigationAimTargetVisible = false;

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
    const customLabel = interaction.active ? interaction.deactivateLabel : interaction.activateLabel;
    if (customLabel) return customLabel;
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
    if (interaction.kind === "container") {
      return interaction.active ? navigationInteractionLabels.containerClose : navigationInteractionLabels.containerOpen;
    }
    if (interaction.kind === "device") {
      return interaction.active ? navigationInteractionLabels.deviceClose : navigationInteractionLabels.deviceOpen;
    }
    return seatedInteractionId === interaction.id
      ? navigationInteractionLabels.stand
      : navigationInteractionLabels.sit;
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
  const captureInteractionState = () => ({
    containerConfigurations: new Map(navigationInteractionRuntimes
      .filter((interaction) => interaction.kind === "container")
      .map((interaction) => [interaction.id, {
        capacity: interaction.containerCapacity ?? 8,
        currency: interaction.containerCurrency,
        label: interaction.label,
        products: interaction.containerProducts.map((product) => ({ ...product })),
      }])),
    containerItems: new Map(navigationInteractionRuntimes
      .filter((interaction) => interaction.kind === "container")
      .map((interaction) => [interaction.id, interaction.containerItems.map((item) => ({ ...item }))])),
    deviceSelections: new Map(navigationInteractionRuntimes
      .filter((interaction) => interaction.kind === "device")
      .map((interaction) => [interaction.id, { ...interaction.deviceSelections }])),
    deviceProgramStates: navigationOperationProgramRuntime?.captureStates() ?? new Map(),
    deviceStatuses: new Map(navigationInteractionRuntimes
      .filter((interaction) => interaction.kind === "device")
      .map((interaction) => [interaction.id, interaction.deviceStatus])),
    modelId,
    seatedInteractionId,
    states: new Map(navigationInteractionRuntimes.map((interaction) => [interaction.id, interaction.active])),
  });
  const publishContainerPanel = (interaction: NavigationInteractionRuntime | null) => {
    if (!interaction || interaction.kind !== "container" || !interaction.active) {
      onContainerPanelChange(null);
      return;
    }
    onContainerPanelChange({
      canConfigure: navigationCanConfigureInteractions
        && (interaction.containerCanConfigure ?? false),
      capacity: interaction.containerCapacity ?? 8,
      currency: interaction.containerCurrency ?? "CNY",
      interactionId: interaction.id,
      items: interaction.containerItems.map((item) => ({ ...item })),
      products: createContainerProductState(
        interaction.containerProducts,
        interaction.containerItems,
      ),
      title: interaction.label ?? interaction.entityLabel,
    });
  };
  const publishDevicePanel = (interaction: NavigationInteractionRuntime | null) => {
    if (!interaction || interaction.kind !== "device" || !interaction.active) {
      onDevicePanelChange(null);
      return;
    }
    onDevicePanelChange({
      busy: navigationOperationProgramRuntime?.isBusy(interaction) ?? false,
      executeDisabled: navigationOperationProgramRuntime?.executeDisabled(interaction) ?? false,
      executeLabel: navigationOperationProgramRuntime?.executeLabel(interaction)
        ?? interaction.operationExecuteLabel
        ?? navigationInteractionLabels.deviceExecute,
      groups: (interaction.operationGroups ?? []).map((group) => ({
        ...group,
        options: group.options.map((option) => ({
          ...(option.description ? { description: option.description } : {}),
          disabled: navigationOperationProgramRuntime?.isOptionDisabled(interaction, option.id) ?? false,
          id: option.id,
          label: option.label,
        })),
        selectedOptionId: interaction.deviceSelections[group.id] ?? group.options[0]?.id ?? "",
      })),
      interactionId: interaction.id,
      status: interaction.deviceStatus,
      title: interaction.label ?? interaction.entityLabel,
    });
  };
  navigationOperationProgramRuntime = createNavigationOperationProgramRuntime({
    featureGroupById,
    featureMeshById,
    interactions: navigationInteractionRuntimes,
    onChange: (interaction) => {
      navigationShadowStateChanged = true;
      if (interaction.active) publishDevicePanel(interaction);
      requestRender();
    },
    ...(savedInteractionState?.deviceProgramStates
      ? { savedStates: savedInteractionState.deviceProgramStates }
      : {}),
  });
  const syncSeatedNavigationAgent = () => {
    if (!navigation || !navigationAgent || !seatedInteractionId) return;
    const seat = navigationInteractionRuntimes.find((interaction) => interaction.id === seatedInteractionId);
    const seatObject = seat?.seatObject;
    const seatObstacle = seat?.seatObstacle;
    if (!seat || !seatObject || !seatObstacle) {
      seatedInteractionId = null;
      navigationAgent.scale.y = 1;
      navigationAgent.position.y = navigation.floorY + navigation.agentHeight / 2;
      return;
    }
    const seatPose = navigationSeatPoseResolver.resolve({
      agentHeight: navigation.agentHeight,
      fallbackFloorY: navigation.floorY,
      object: seatObject,
      obstacle: seatObstacle,
      targetMeshes: seat.targetMeshes,
    });
    navigationAgent.position.copy(seatPose.position);
    navigationAgent.rotation.y = seatPose.rotationY;
    navigationAgent.scale.y = 1;
  };
  const standFromNavigationSeat = (seat: NavigationInteractionRuntime) => {
    if (!navigation || !navigationAgent || !seat.seatObstacle) return false;
    const obstacle = seat.seatObstacle;
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
    return true;
  };
  const performInteraction = (interactionId: string) => {
    if (!navigationMode || !navigation || !navigationAgent) return false;
    const interaction = navigationInteractionRuntimes.find((candidate) => candidate.id === interactionId);
    if (!interaction) return false;
    if (interaction.kind === "seat") {
      if (seatedInteractionId === interaction.id) {
        if (!standFromNavigationSeat(interaction)) return false;
      } else {
        if (!interaction.seatObject || !interaction.seatObstacle) return false;
        const previousSeat = navigationInteractionRuntimes.find((candidate) => candidate.id === seatedInteractionId);
        if (previousSeat) previousSeat.active = false;
        seatedInteractionId = interaction.id;
        interaction.active = true;
        interaction.dynamicBody?.velocity.set(0, 0, 0);
        navigationVelocity.set(0, 0, 0);
        navigationPath = [];
        navigationPathIndex = 0;
        replaceNavigationPathLine();
        syncSeatedNavigationAgent();
      }
    } else if (interaction.kind === "container" || interaction.kind === "device") {
      for (const candidate of navigationInteractionRuntimes) {
        if (
          (candidate.kind === "container" || candidate.kind === "device")
          && candidate.id !== interaction.id
        ) candidate.active = false;
      }
      publishContainerPanel(null);
      publishDevicePanel(null);
      interaction.active = !interaction.active;
      if (interaction.kind === "container") {
        publishContainerPanel(interaction.active ? interaction : null);
      } else {
        publishDevicePanel(interaction.active ? interaction : null);
      }
    } else {
      interaction.active = !interaction.active;
      applyNavigationInteractionVisualState(interaction);
    }
    lastNavigationInteractionPromptKey = "";
    requestRender();
    return (interaction.kind === "container" || interaction.kind === "device") && interaction.active;
  };
  const performContainerOperation = (
    interactionId: string,
    operation: NavigationContainerOperation,
  ) => {
    const interaction = navigationInteractionRuntimes.find((candidate) => (
      candidate.id === interactionId && candidate.kind === "container"
    ));
    if (!interaction) return;
    if (operation.type === "close") {
      interaction.active = false;
      publishContainerPanel(null);
    } else if (operation.type === "take") {
      const itemIndex = interaction.containerItems.findIndex((item) => (
        item.productId === operation.productId
        || (!item.productId && `legacy-${item.name}` === operation.productId)
      ));
      if (itemIndex >= 0) interaction.containerItems.splice(itemIndex, 1);
      publishContainerPanel(interaction);
    } else if (operation.type === "configure") {
      if (!navigationCanConfigureInteractions || !interaction.containerCanConfigure) return;
      const title = operation.configuration.title.trim();
      if (title) interaction.label = title;
      const capacity = interaction.containerCapacity ?? 8;
      const reconciled = reconcileContainerInventory({
        capacity,
        currentItems: interaction.containerItems,
        requestedProducts: operation.configuration.products,
      });
      interaction.containerItems = reconciled.items;
      interaction.containerProducts = reconciled.products;
      publishContainerPanel(interaction);
    }
    lastNavigationInteractionPromptKey = "";
    requestRender();
  };
  const performDeviceOperation = (
    interactionId: string,
    operation: NavigationDeviceOperation,
  ) => {
    const interaction = navigationInteractionRuntimes.find((candidate) => (
      candidate.id === interactionId && candidate.kind === "device"
    ));
    if (!interaction) return;
    if (operation.type === "close") {
      interaction.active = false;
      publishDevicePanel(null);
    } else if (operation.type === "select") {
      if (navigationOperationProgramRuntime?.isBusy(interaction)) return;
      const group = interaction.operationGroups?.find((candidate) => candidate.id === operation.groupId);
      if (!group?.options.some((option) => option.id === operation.optionId)) return;
      if (navigationOperationProgramRuntime?.isOptionDisabled(interaction, operation.optionId)) return;
      interaction.deviceSelections = {
        ...interaction.deviceSelections,
        [operation.groupId]: operation.optionId,
      };
      interaction.deviceStatus = null;
      publishDevicePanel(interaction);
    } else if (operation.type === "execute") {
      const handled = navigationOperationProgramRuntime?.execute(interaction) ?? false;
      if (!handled) {
        const selection = (interaction.operationGroups ?? []).map((group) => (
          group.options.find((option) => option.id === interaction.deviceSelections[group.id])?.label
        )).filter((label): label is string => Boolean(label)).join(" · ");
        const completion = interaction.operationCompleteLabel ?? navigationInteractionLabels.deviceReady;
        interaction.deviceStatus = completion.replace("{selection}", selection);
        publishDevicePanel(interaction);
      }
    }
    lastNavigationInteractionPromptKey = "";
    requestRender();
  };
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
  const updateKeyboardNavigation = ({
    deltaSeconds,
    keyboardNavigationKeys,
    rotateCamera,
  }: NavigationFrameInput) => {
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
        rotateCamera(yawInput * 132 * deltaSeconds, pitchInput * 132 * deltaSeconds);
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
        onAimTargetVisibleChange(false);
      }
      if (lastNavigationInteractionPromptKey !== "") {
        lastNavigationInteractionPromptKey = "";
        onPromptsChange([]);
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
      if (interaction.proximityAnchor) {
        interaction.proximityAnchor.getWorldPosition(navigationInteractionAnchorPoint);
        navigationInteractionBounds.set(
          navigationInteractionAnchorPoint,
          navigationInteractionAnchorPoint,
        );
      } else if (interaction.targetMeshes.length > 0) {
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
      camera.getWorldDirection(navigationInteractionCameraDirection);
      let smallestAngularMiss = Infinity;
      let angularTargetWorldDistance = Infinity;
      for (const candidate of nearbyInteractions) {
        if (candidate.interaction.id === seatedInteractionId) continue;
        if (candidate.interaction.proximityAnchor) {
          candidate.interaction.proximityAnchor.getWorldPosition(navigationInteractionAnchorPoint);
          navigationInteractionBounds.set(
            navigationInteractionAnchorPoint,
            navigationInteractionAnchorPoint,
          );
        } else {
          navigationInteractionBounds.setFromObject(candidate.interaction.anchor);
        }
        if (navigationInteractionBounds.isEmpty()) continue;
        navigationInteractionBounds.getBoundingSphere(navigationInteractionAimSphere);
        navigationInteractionAimDirection.subVectors(navigationInteractionAimSphere.center, camera.position);
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
        if (angularMiss > smallestAngularMiss
          || (angularMiss === smallestAngularMiss && worldDistance >= angularTargetWorldDistance)) continue;
        aimedInteraction = candidate;
        smallestAngularMiss = angularMiss;
        angularTargetWorldDistance = worldDistance;
      }
    }
    const hasAimTarget = aimedInteraction !== null;
    if (lastNavigationAimTargetVisible !== hasAimTarget) {
      lastNavigationAimTargetVisible = hasAimTarget;
      onAimTargetVisibleChange(hasAimTarget);
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
        onAimTargetVisibleChange(false);
      }
      if (lastNavigationInteractionPromptKey !== "") {
        lastNavigationInteractionPromptKey = "";
        onPromptsChange([]);
      }
      return;
    }
    const promptKey = prompts.map((prompt) => `${prompt.id}:${prompt.label}`).join("|");
    if (lastNavigationInteractionPromptKey === promptKey) return;
    lastNavigationInteractionPromptKey = promptKey;
    onPromptsChange(prompts);
  };

  const needsContinuousRendering = (keyboardNavigationKeys: ReadonlySet<string>) => Boolean(navigationMode && (
    navigationAvatarAnimating
    || keyboardNavigationKeys.size > 0
    || navigationPathIndex > 0
    || navigationVelocity.lengthSq() > 1
    || navigationDynamicBodyRuntimes.some((body) => body.velocity.lengthSq() > 1)
    || navigationInteractionRuntimes.some((interaction) => interaction.deviceProgramPhase === "running")
    || navigationInteractionRuntimes.some((interaction) => (
      interaction.kind === "articulation"
      && Math.abs(interaction.articulationCurrentValue - interaction.articulationTargetValue) > 0.01
    ))
  ));
  const update = (input: NavigationFrameInput): NavigationFrameResult => {
    const previousShadowStateChanged = navigationShadowStateChanged;
    navigationShadowStateChanged = false;
    const previousAgentRotationY = navigationAgent?.rotation.y ?? 0;
    const previousAgentScaleY = navigationAgent?.scale.y ?? 1;
    let operationProgramChanged = false;
    if (navigationAgent) navigationPreviousAgentPosition.copy(navigationAgent.position);
    if (!input.viewTransitionActive) {
      updateNavigationDynamicBodies(input.deltaSeconds);
      updateNavigationArticulations(input.deltaSeconds);
      operationProgramChanged = navigationOperationProgramRuntime?.update(input.deltaSeconds) ?? false;
      syncSeatedNavigationAgent();
      updateKeyboardNavigation(input);
      updateNavigationAgent(input.deltaSeconds);
      syncSeatedNavigationAgent();
      if (navigationAgent && navigationAvatar) {
        const horizontalDistance = Math.hypot(
          navigationAgent.position.x - navigationPreviousAgentPosition.x,
          navigationAgent.position.z - navigationPreviousAgentPosition.z,
        );
        const speed = input.deltaSeconds > 0 ? horizontalDistance / input.deltaSeconds : 0;
        navigationAvatarAnimating = navigationAvatar.update(
          speed,
          Boolean(seatedInteractionId),
          input.deltaSeconds,
        );
      }
      updateNavigationCamera();
    }
    updateNavigationInteractionPrompt();
    const navigationAgentChanged = Boolean(navigationAgent && (
      navigationPreviousAgentPosition.distanceToSquared(navigationAgent.position) > 0.0001
      || Math.abs(previousAgentRotationY - navigationAgent.rotation.y) > 0.0001
      || Math.abs(previousAgentScaleY - navigationAgent.scale.y) > 0.0001
    ));
    const navigationObjectChanged = previousShadowStateChanged
      || navigationShadowStateChanged
      || navigationAgentChanged
      || navigationAvatarAnimating
      || operationProgramChanged;
    navigationShadowStateChanged = false;
    return { navigationObjectChanged };
  };
  const captureState = (): SavedNavigationRuntimeState => ({
    agent: !navigationAgent ? null : {
      cameraPitch: navigationCameraPitch,
      cameraYaw: navigationCameraYaw,
      modelId,
      position: navigationAgent.position.clone(),
      rotationY: navigationAgent.rotation.y,
      velocity: navigationVelocity.clone(),
    },
    dynamicBodies: navigationDynamicBodyRuntimes.length === 0 ? null : {
      modelId,
      states: new Map(navigationDynamicBodyRuntimes.map((body) => [
        body.id,
        { position: body.object.position.clone(), velocity: body.velocity.clone() },
      ])),
    },
    interactions: captureInteractionState(),
  });

  let disposed = false;
  return {
    adjustCamera: (yawDelta, pitchDelta) => {
      navigationCameraYaw += yawDelta;
      navigationCameraPitch = THREE.MathUtils.clamp(
        navigationCameraPitch + pitchDelta,
        THREE.MathUtils.degToRad(-65),
        THREE.MathUtils.degToRad(65),
      );
    },
    captureState,
    getActiveInteractionId: () => activeNavigationInteractionId,
    needsContinuousRendering,
    performContainerOperation,
    performDeviceOperation,
    performInteraction,
    setDestination,
    update,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      onContainerPanelChange(null);
      onDevicePanelChange(null);
      navigationPathLine?.geometry.dispose();
      (navigationPathLine?.material as THREE.Material | undefined)?.dispose();
      navigationPathLine?.removeFromParent();
      navigationAgent?.removeFromParent();
      navigationAvatar?.dispose();
      for (const object of navigationSceneObjects) object.removeFromParent();
      for (const resource of navigationResources) resource.dispose();
    },
  };
}
