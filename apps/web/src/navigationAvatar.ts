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
import { FIRST_PERSON_RENDER_LAYER } from "./viewport/renderLayers";

export interface NavigationAvatarDimensions {
  height: number;
  pixelSize: number;
  width: number;
}

export type NavigationAvatarSkin = Pick<VoxelSkinAppearance, "model" | "url">;
export type NavigationFirstPersonAvatarMode = "automatic" | "hands" | "body" | "hidden";

export const NAVIGATION_FIRST_PERSON_AVATAR_MODES = [
  "automatic",
  "hands",
  "body",
  "hidden",
] as const satisfies readonly NavigationFirstPersonAvatarMode[];

export interface NavigationAvatarPresentation {
  bodyOpacity: number;
  handsOpacity: number;
}

const AUTOMATIC_BODY_FADE_START = THREE.MathUtils.degToRad(15);
const AUTOMATIC_BODY_FADE_END = THREE.MathUtils.degToRad(50);
const MINECRAFT_MODEL_PIXEL = 1 / 16;
const MINECRAFT_PLAYER_MODEL_HEIGHT = 2;

export interface MinecraftFirstPersonArmPose {
  equipProgress?: number;
  swingProgress?: number;
}

/**
 * Minecraft ItemRenderer 的空手矩阵，使用相机空间坐标。
 * 变换顺序与原版 OpenGL 矩阵栈一致：
 * https://di9.ru/git/Minecraft/mc-1.2.5/src/commit/73ed854abef73991782cdc99ff932c56f963d7ef/client/src/main/java/net/minecraft/src/ItemRenderer.java#L465-L490
 */
export function resolveMinecraftFirstPersonArmTransform(
  { equipProgress = 1, swingProgress = 0 }: MinecraftFirstPersonArmPose = {},
  target = new THREE.Matrix4(),
): THREE.Matrix4 {
  const equip = THREE.MathUtils.clamp(equipProgress, 0, 1);
  const swing = THREE.MathUtils.clamp(swingProgress, 0, 1);
  const sqrtSwing = Math.sqrt(swing);
  const swingSin = Math.sin(swing * Math.PI);
  const sqrtSwingSin = Math.sin(sqrtSwing * Math.PI);
  const squaredSwingSin = Math.sin(swing * swing * Math.PI);
  const operation = new THREE.Matrix4();
  const multiply = (matrix: THREE.Matrix4) => target.multiply(matrix);
  const rotate = (axis: "x" | "y" | "z", degrees: number) => {
    const radians = THREE.MathUtils.degToRad(degrees);
    operation.identity();
    if (axis === "x") operation.makeRotationX(radians);
    else if (axis === "y") operation.makeRotationY(radians);
    else operation.makeRotationZ(radians);
    multiply(operation);
  };
  const translate = (x: number, y: number, z: number) => {
    operation.makeTranslation(x, y, z);
    multiply(operation);
  };

  target.identity();
  translate(
    -sqrtSwingSin * 0.3,
    Math.sin(sqrtSwing * Math.PI * 2) * 0.4,
    -swingSin * 0.4,
  );
  translate(0.8 * 0.8, -0.75 * 0.8 - (1 - equip) * 0.6, -0.9 * 0.8);
  rotate("y", 45);
  rotate("y", sqrtSwingSin * 70);
  rotate("z", -squaredSwingSin * 20);
  translate(-1, 3.6, 3.5);
  rotate("z", 120);
  rotate("x", 200);
  rotate("y", -135);
  translate(5.6, 0, 0);
  return target;
}

export function resolveNavigationAvatarPresentation(
  mode: NavigationFirstPersonAvatarMode,
  cameraPitch: number,
): NavigationAvatarPresentation {
  if (mode === "body") return { bodyOpacity: 1, handsOpacity: 0 };
  if (mode === "hands") return { bodyOpacity: 0, handsOpacity: 1 };
  if (mode === "hidden") return { bodyOpacity: 0, handsOpacity: 0 };
  const bodyOpacity = THREE.MathUtils.smoothstep(
    -cameraPitch,
    AUTOMATIC_BODY_FADE_START,
    AUTOMATIC_BODY_FADE_END,
  );
  return { bodyOpacity, handsOpacity: 1 - bodyOpacity };
}

interface CreateNavigationAvatarOptions {
  agentHeight: number;
  onTextureReady?: () => void;
  skin?: NavigationAvatarSkin | null;
}

export interface NavigationAvatar {
  dispose: () => void;
  firstPersonObject: THREE.Group;
  getEyePosition: (target: THREE.Vector3) => THREE.Vector3;
  object: THREE.Group;
  setPresentation: (
    firstPerson: boolean,
    mode: NavigationFirstPersonAvatarMode,
    cameraPitch: number,
  ) => boolean;
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

  const eyeAnchor = new THREE.Object3D();
  eyeAnchor.name = "眼睛锚点";
  eyeAnchor.position.set(0, dimensions.height * 0.36, 4.2 * pixel);
  root.add(eyeAnchor);

  const firstPersonObject = new THREE.Group();
  firstPersonObject.name = "第一人称手部层";
  firstPersonObject.visible = false;
  firstPersonObject.scale.setScalar(dimensions.height / MINECRAFT_PLAYER_MODEL_HEIGHT);

  const firstPersonPose = new THREE.Group();
  firstPersonPose.name = "Minecraft 第一人称手臂变换";
  firstPersonPose.matrix.copy(resolveMinecraftFirstPersonArmTransform());
  firstPersonPose.matrixAutoUpdate = false;
  firstPersonObject.add(firstPersonPose);

  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  const bodyMaterials = new Set<THREE.Material>();
  const headMaterials = new Set<THREE.Material>();
  const handMaterials = new Set<THREE.Material>();
  const materialDefaults = new Map<THREE.Material, {
    depthWrite: boolean;
    opacity: number;
    transparent: boolean;
  }>();
  const trackPresentationMaterial = (
    material: THREE.Material,
    target: Set<THREE.Material>,
  ) => {
    target.add(material);
    materialDefaults.set(material, {
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
    options: {
      castShadow?: boolean;
      frustumCulled?: boolean;
      materials?: Set<THREE.Material>;
      renderOrder?: number;
    } = {},
  ) => {
    const castShadow = options.castShadow ?? true;
    const presentationMaterials = options.materials ?? bodyMaterials;
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
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    mesh.renderOrder = options.renderOrder ?? 0;
    mesh.frustumCulled = options.frustumCulled ?? true;
    parent.add(mesh);
    resources.add(geometry);
    if (layers) {
      layers.base.forEach((entry) => {
        resources.add(entry);
        trackPresentationMaterial(entry, presentationMaterials);
      });
      layers.overlay.forEach((entry) => {
        resources.add(entry);
        trackPresentationMaterial(entry, presentationMaterials);
      });
      const overlayDimensions = resolveVoxelSkinOverlayDimensions(feature);
      if (overlayDimensions) {
        const overlayGeometry = new THREE.BoxGeometry(...overlayDimensions);
        const overlayMesh = new THREE.Mesh(overlayGeometry, layers.overlay);
        overlayMesh.name = `${name}外层`;
        overlayMesh.receiveShadow = castShadow;
        overlayMesh.renderOrder = (options.renderOrder ?? 0) + 1;
        overlayMesh.frustumCulled = options.frustumCulled ?? true;
        mesh.add(overlayMesh);
        resources.add(overlayGeometry);
      }
    } else {
      resources.add(fallbackMaterial!);
      trackPresentationMaterial(fallbackMaterial!, presentationMaterials);
    }
    return mesh;
  };

  addPart(visual, "navigation-avatar-torso", "躯干", "torso", [8 * pixel, 12 * pixel, 4 * pixel], [0, 2 * pixel, 0]);
  addPart(
    visual,
    "navigation-avatar-head",
    "头部",
    "head",
    [8 * pixel, 8 * pixel, 8 * pixel],
    [0, 12 * pixel, 0],
    "full",
    { materials: headMaterials },
  );

  const leftShoulder = new THREE.Group();
  const rightShoulder = new THREE.Group();
  leftShoulder.position.set(-6 * pixel, 8 * pixel, 0);
  rightShoulder.position.set(6 * pixel, 8 * pixel, 0);
  visual.add(leftShoulder, rightShoulder);
  const armPixelWidth = avatarSkin.model === "slim" ? 3 : 4;
  const armWidth = armPixelWidth * pixel;
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

  const firstPersonRightArm = addPart(
    firstPersonPose,
    "navigation-avatar-first-person-right-arm",
    "第一人称主手",
    "rightArm",
    [armPixelWidth * MINECRAFT_MODEL_PIXEL, 12 * MINECRAFT_MODEL_PIXEL, 4 * MINECRAFT_MODEL_PIXEL],
    [
      (avatarSkin.model === "slim" ? -5.5 : -6) * MINECRAFT_MODEL_PIXEL,
      6 * MINECRAFT_MODEL_PIXEL,
      0,
    ],
    "full",
    { castShadow: false, frustumCulled: false, materials: handMaterials },
  );
  // BoxGeometry 的面 UV 与 Minecraft 模型 Y 轴相反。
  // 盒子以原点为中心，因此镜像只修正贴图方向，不改变轮廓。
  firstPersonRightArm.scale.y = -1;
  firstPersonObject.traverse((object) => object.layers.set(FIRST_PERSON_RENDER_LAYER));

  const applyMaterialOpacity = (materials: Set<THREE.Material>, opacity: number) => {
    const clampedOpacity = THREE.MathUtils.clamp(opacity, 0, 1);
    for (const material of materials) {
      const defaults = materialDefaults.get(material);
      if (!defaults) continue;
      const faded = clampedOpacity < 0.999;
      const transparent = defaults.transparent || faded;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.depthWrite = faded ? false : defaults.depthWrite;
      material.opacity = defaults.opacity * clampedOpacity;
    }
  };

  let currentBodyOpacity = 1;
  let currentHeadOpacity = 1;
  let currentHandsOpacity = 0;
  const setPresentation: NavigationAvatar["setPresentation"] = (firstPerson, mode, cameraPitch) => {
    const presentation = firstPerson
      ? resolveNavigationAvatarPresentation(mode, cameraPitch)
      : { bodyOpacity: 1, handsOpacity: 0 };
    const headOpacity = firstPerson ? 0 : 1;
    const changed = Math.abs(currentBodyOpacity - presentation.bodyOpacity) > 0.001
      || Math.abs(currentHeadOpacity - headOpacity) > 0.001
      || Math.abs(currentHandsOpacity - presentation.handsOpacity) > 0.001;
    if (!changed) return false;
    currentBodyOpacity = presentation.bodyOpacity;
    currentHeadOpacity = headOpacity;
    currentHandsOpacity = presentation.handsOpacity;
    applyMaterialOpacity(bodyMaterials, currentBodyOpacity);
    applyMaterialOpacity(headMaterials, currentHeadOpacity);
    applyMaterialOpacity(handMaterials, currentHandsOpacity);
    firstPersonObject.visible = currentHandsOpacity > 0.001;
    return true;
  };

  let phase = 0;
  let movementWeight = 0;
  let seatedWeight = 0;
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
    firstPersonObject.position.y = Math.abs(Math.sin(phase * 2)) * pixel * 0.1 * movementWeight;

    return movementWeight > 0.002
      || Math.abs(previousMovementWeight - movementWeight) > 0.0001
      || Math.abs(previousSeatedWeight - seatedWeight) > 0.0001;
  };

  return {
    dispose: () => {
      firstPersonObject.removeFromParent();
      root.removeFromParent();
      for (const resource of resources) {
        if (resource instanceof THREE.Material) disposeFeatureMaterial(resource);
        else resource.dispose();
      }
    },
    firstPersonObject,
    getEyePosition: (target) => eyeAnchor.getWorldPosition(target),
    object: root,
    setPresentation,
    update,
  };
}
