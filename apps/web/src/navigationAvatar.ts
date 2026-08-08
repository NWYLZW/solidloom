import * as THREE from "three";
import type {
  BoxFeature,
  VoxelSkinAppearance,
  VoxelSkinPart,
  VoxelSkinSegment,
} from "@solidloom/shared";
import { disposeFeatureMaterial } from "./featureMaterials";
import { resolveNavigationMotionProfile } from "./navigationMotion";
import {
  BUILTIN_VOXEL_SKIN_URL,
  createVoxelSkinMaterialLayers,
  resolveVoxelSkinOverlayDimensions,
} from "./voxelSkin";

export interface NavigationAvatarDimensions {
  height: number;
  pixelSize: number;
  width: number;
}

export type NavigationAvatarSkin = Pick<VoxelSkinAppearance, "model" | "url">;

interface CreateNavigationAvatarOptions {
  agentHeight: number;
  onTextureReady?: () => void;
  skin?: NavigationAvatarSkin | null;
}

export interface NavigationAvatar {
  dispose: () => void;
  object: THREE.Group;
  setOpacity: (opacity: number, deltaSeconds: number) => boolean;
  update: (speed: number, seated: boolean, deltaSeconds: number) => boolean;
}

export function resolveNavigationAvatarDimensions(agentHeight: number): NavigationAvatarDimensions {
  const height = Math.max(1, agentHeight);
  const pixelSize = height / 32;
  return {
    height,
    pixelSize,
    width: pixelSize * 16,
  };
}

function skinnedFeature(
  id: string,
  name: string,
  part: VoxelSkinPart,
  size: [number, number, number],
  skin: NavigationAvatarSkin,
  segment: VoxelSkinSegment = "full",
): BoxFeature {
  return {
    id,
    name,
    type: "box",
    operation: "add",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    parameters: { width: size[0], height: size[1], depth: size[2] },
    appearance: {
      voxelSkin: {
        model: skin.model,
        part,
        segment,
        url: skin.url,
      },
    },
  };
}

export function createNavigationAvatar({
  agentHeight,
  onTextureReady,
  skin = null,
}: CreateNavigationAvatarOptions): NavigationAvatar {
  const dimensions = resolveNavigationAvatarDimensions(agentHeight);
  const pixel = dimensions.pixelSize;
  const motionProfile = resolveNavigationMotionProfile(agentHeight);
  const avatarSkin = skin ?? { model: "classic", url: BUILTIN_VOXEL_SKIN_URL };
  const root = new THREE.Group();
  root.name = "漫游角色";
  root.userData.navigationAgent = true;

  const visual = new THREE.Group();
  visual.name = "方块角色外观";
  root.add(visual);

  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  const fadeMaterials = new Map<THREE.Material, {
    depthWrite: boolean;
    opacity: number;
    transparent: boolean;
  }>();
  const trackFadeMaterial = (material: THREE.Material) => {
    if (fadeMaterials.has(material)) return;
    fadeMaterials.set(material, {
      depthWrite: material.depthWrite,
      opacity: material.opacity,
      transparent: material.transparent,
    });
  };
  const addPart = (
    parent: THREE.Object3D,
    id: string,
    name: string,
    part: VoxelSkinPart,
    size: [number, number, number],
    position: [number, number, number],
    segment: VoxelSkinSegment = "full",
  ) => {
    const feature = skinnedFeature(id, name, part, size, avatarSkin, segment);
    const layers = createVoxelSkinMaterialLayers(feature, onTextureReady);
    const geometry = new THREE.BoxGeometry(...size);
    const fallbackMaterial = layers
      ? null
      : new THREE.MeshStandardMaterial({ color: 0x7d9d55, roughness: 0.8 });
    const material = layers?.base ?? fallbackMaterial!;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    resources.add(geometry);
    if (layers) {
      layers.base.forEach((entry) => {
        resources.add(entry);
        trackFadeMaterial(entry);
      });
      layers.overlay.forEach((entry) => {
        resources.add(entry);
        trackFadeMaterial(entry);
      });
      const overlayDimensions = resolveVoxelSkinOverlayDimensions(feature);
      if (overlayDimensions) {
        const overlayGeometry = new THREE.BoxGeometry(...overlayDimensions);
        const overlayMesh = new THREE.Mesh(overlayGeometry, layers.overlay);
        overlayMesh.name = `${name}外层`;
        overlayMesh.receiveShadow = true;
        mesh.add(overlayMesh);
        resources.add(overlayGeometry);
      }
    } else {
      resources.add(fallbackMaterial!);
      trackFadeMaterial(fallbackMaterial!);
    }
    return mesh;
  };

  addPart(visual, "navigation-avatar-torso", "躯干", "torso", [8 * pixel, 12 * pixel, 4 * pixel], [0, 2 * pixel, 0]);
  addPart(visual, "navigation-avatar-head", "头部", "head", [8 * pixel, 8 * pixel, 8 * pixel], [0, 12 * pixel, 0]);

  const leftShoulder = new THREE.Group();
  const rightShoulder = new THREE.Group();
  leftShoulder.position.set(-6 * pixel, 8 * pixel, 0);
  rightShoulder.position.set(6 * pixel, 8 * pixel, 0);
  visual.add(leftShoulder, rightShoulder);
  const armWidth = avatarSkin.model === "slim" ? 3 * pixel : 4 * pixel;
  addPart(leftShoulder, "navigation-avatar-left-arm", "左臂", "leftArm", [armWidth, 12 * pixel, 4 * pixel], [0, -6 * pixel, 0]);
  addPart(rightShoulder, "navigation-avatar-right-arm", "右臂", "rightArm", [armWidth, 12 * pixel, 4 * pixel], [0, -6 * pixel, 0]);

  const leftHip = new THREE.Group();
  const rightHip = new THREE.Group();
  leftHip.name = "左髋关节";
  rightHip.name = "右髋关节";
  leftHip.position.set(-2 * pixel, -4 * pixel, 0);
  rightHip.position.set(2 * pixel, -4 * pixel, 0);
  visual.add(leftHip, rightHip);
  addPart(leftHip, "navigation-avatar-left-upper-leg", "左大腿", "leftLeg", [4 * pixel, 6 * pixel, 4 * pixel], [0, -3 * pixel, 0], "upper");
  addPart(rightHip, "navigation-avatar-right-upper-leg", "右大腿", "rightLeg", [4 * pixel, 6 * pixel, 4 * pixel], [0, -3 * pixel, 0], "upper");

  const leftKnee = new THREE.Group();
  const rightKnee = new THREE.Group();
  leftKnee.name = "左膝关节";
  rightKnee.name = "右膝关节";
  leftKnee.position.set(0, -6 * pixel, 0);
  rightKnee.position.set(0, -6 * pixel, 0);
  leftHip.add(leftKnee);
  rightHip.add(rightKnee);
  addPart(leftKnee, "navigation-avatar-left-lower-leg", "左小腿", "leftLeg", [4 * pixel, 6 * pixel, 4 * pixel], [0, -3 * pixel, 0], "lower");
  addPart(rightKnee, "navigation-avatar-right-lower-leg", "右小腿", "rightLeg", [4 * pixel, 6 * pixel, 4 * pixel], [0, -3 * pixel, 0], "lower");

  let phase = 0;
  let movementWeight = 0;
  let seatedWeight = 0;
  let currentOpacity = 1;
  const setOpacity = (opacity: number, deltaSeconds: number) => {
    const targetOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
    const previousOpacity = currentOpacity;
    currentOpacity = deltaSeconds > 0
      ? THREE.MathUtils.damp(currentOpacity, targetOpacity, 14, deltaSeconds)
      : targetOpacity;
    if (Math.abs(currentOpacity - targetOpacity) < 0.002) currentOpacity = targetOpacity;
    if (Math.abs(previousOpacity - currentOpacity) < 0.0001) return false;
    for (const [material, original] of fadeMaterials) {
      const faded = currentOpacity < 0.999;
      const transparent = original.transparent || faded;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.depthWrite = faded ? false : original.depthWrite;
      material.opacity = original.opacity * currentOpacity;
    }
    return true;
  };
  const update = (speed: number, seated: boolean, deltaSeconds: number) => {
    const targetMovementWeight = seated
      ? 0
      : THREE.MathUtils.smoothstep(speed, 24, motionProfile.walkSpeed * 0.55);
    const targetSeatedWeight = seated ? 1 : 0;
    const previousMovementWeight = movementWeight;
    const previousSeatedWeight = seatedWeight;
    movementWeight = THREE.MathUtils.damp(movementWeight, targetMovementWeight, 10, deltaSeconds);
    seatedWeight = THREE.MathUtils.damp(seatedWeight, targetSeatedWeight, 12, deltaSeconds);

    const runBlend = THREE.MathUtils.smoothstep(speed, motionProfile.walkSpeed, motionProfile.runSpeed);
    const cadence = THREE.MathUtils.lerp(4.7, 8.6, runBlend) * movementWeight;
    phase += cadence * deltaSeconds;
    const stride = Math.sin(phase) * THREE.MathUtils.lerp(0.46, 0.82, runBlend) * movementWeight;
    const armSwing = stride * (1 - seatedWeight);
    const legSwing = stride * (1 - seatedWeight);
    leftShoulder.rotation.x = THREE.MathUtils.lerp(armSwing, -0.18, seatedWeight);
    rightShoulder.rotation.x = THREE.MathUtils.lerp(-armSwing, -0.18, seatedWeight);
    leftHip.rotation.x = THREE.MathUtils.lerp(-legSwing, -Math.PI / 2, seatedWeight);
    rightHip.rotation.x = THREE.MathUtils.lerp(legSwing, -Math.PI / 2, seatedWeight);
    leftKnee.rotation.x = THREE.MathUtils.lerp(0, Math.PI / 2, seatedWeight);
    rightKnee.rotation.x = THREE.MathUtils.lerp(0, Math.PI / 2, seatedWeight);
    visual.position.y = Math.abs(Math.sin(phase * 2)) * pixel * 0.14 * movementWeight;

    return movementWeight > 0.002
      || Math.abs(previousMovementWeight - movementWeight) > 0.0001
      || Math.abs(previousSeatedWeight - seatedWeight) > 0.0001;
  };

  return {
    dispose: () => {
      for (const resource of resources) {
        if (resource instanceof THREE.Material) disposeFeatureMaterial(resource);
        else resource.dispose();
      }
    },
    object: root,
    setOpacity,
    update,
  };
}
