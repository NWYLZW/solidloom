import type {
  BoxFeature,
  CreateModelInput,
  ModelFeature,
  ModelVariable,
  RoomShellSource,
  Vector3Tuple,
} from "../../types.js";
import {
  box,
  cylinder,
  ellipsoid,
  group,
  model,
  offsetWithXRotation,
  origin,
  proceduralRoomShell,
  recessedLaptopDeck,
  recessedRoundedPanel,
  sphere,
  withAppearance,
  withFeatureAppearances,
  withParameterExpressions,
  type AppearanceDefinition,
} from "./factory.js";

export function createBlockAvatar(): CreateModelInput {
  const pixel = 56.25;
  const skinUrl = "builtin:solidloom-block-avatar";
  const skinnedBox = (
    id: string,
    name: string,
    size: Vector3Tuple,
    position: Vector3Tuple,
    part: NonNullable<NonNullable<ModelFeature["appearance"]>["voxelSkin"]>["part"],
    segment?: NonNullable<NonNullable<ModelFeature["appearance"]>["voxelSkin"]>["segment"],
  ): BoxFeature => {
    const fallbackAppearance: Record<typeof part, AppearanceDefinition> = {
      head: { color: "#C98F68", material: "plastic" },
      torso: { color: "#2E8D9D", material: "fabric" },
      leftArm: { color: "#2E8D9D", material: "fabric" },
      rightArm: { color: "#2E8D9D", material: "fabric" },
      leftLeg: { color: "#273A68", material: "fabric" },
      rightLeg: { color: "#273A68", material: "fabric" },
    };
    return {
      ...box(id, name, size, position),
      appearance: {
        ...fallbackAppearance[part],
        voxelSkin: {
          model: "classic",
          part,
          ...(segment ? { segment } : {}),
          url: skinUrl,
        },
      },
    };
  };

  const head = [skinnedBox(
    "block-avatar-head",
    "头部",
    [8 * pixel, 8 * pixel, 8 * pixel],
    [0, 28 * pixel, 0],
    "head",
  )];
  const torso = [skinnedBox(
    "block-avatar-torso",
    "躯干",
    [8 * pixel, 12 * pixel, 4 * pixel],
    [0, 18 * pixel, 0],
    "torso",
  )];
  const leftArm = [skinnedBox(
    "block-avatar-left-arm",
    "左臂",
    [4 * pixel, 12 * pixel, 4 * pixel],
    [-6 * pixel, 18 * pixel, 0],
    "leftArm",
  )];
  const rightArm = [skinnedBox(
    "block-avatar-right-arm",
    "右臂",
    [4 * pixel, 12 * pixel, 4 * pixel],
    [6 * pixel, 18 * pixel, 0],
    "rightArm",
  )];
  const leftUpperLeg = [skinnedBox(
    "block-avatar-left-upper-leg",
    "左大腿",
    [4 * pixel, 6 * pixel, 4 * pixel],
    [-2 * pixel, 9 * pixel, 0],
    "leftLeg",
    "upper",
  )];
  const leftLowerLeg = [skinnedBox(
    "block-avatar-left-lower-leg",
    "左小腿",
    [4 * pixel, 6 * pixel, 4 * pixel],
    [-2 * pixel, 3 * pixel, 0],
    "leftLeg",
    "lower",
  )];
  const rightUpperLeg = [skinnedBox(
    "block-avatar-right-upper-leg",
    "右大腿",
    [4 * pixel, 6 * pixel, 4 * pixel],
    [2 * pixel, 9 * pixel, 0],
    "rightLeg",
    "upper",
  )];
  const rightLowerLeg = [skinnedBox(
    "block-avatar-right-lower-leg",
    "右小腿",
    [4 * pixel, 6 * pixel, 4 * pixel],
    [2 * pixel, 3 * pixel, 0],
    "rightLeg",
    "lower",
  )];
  const features = [
    ...head,
    ...torso,
    ...leftArm,
    ...rightArm,
    ...leftUpperLeg,
    ...leftLowerLeg,
    ...rightUpperLeg,
    ...rightLowerLeg,
  ];
  const avatar = model(
    "原创方块角色",
    "兼容通用 64×64 像素皮肤布局的原创方块角色，支持 Classic、Slim 手臂、用户本地 PNG 皮肤和关节动画。",
    features,
    [
      group("block-avatar-head-group", "头部", head),
      group("block-avatar-torso-group", "躯干", torso),
      group("block-avatar-left-arm-group", "左臂", leftArm),
      group("block-avatar-right-arm-group", "右臂", rightArm),
      group("block-avatar-left-upper-leg-group", "左大腿", leftUpperLeg),
      group("block-avatar-left-lower-leg-group", "左小腿", leftLowerLeg),
      group("block-avatar-right-upper-leg-group", "右大腿", rightUpperLeg),
      group("block-avatar-right-lower-leg-group", "右小腿", rightLowerLeg),
    ],
  );
  avatar.featureGraph!.joints = [
    { id: "block-avatar-torso-joint", name: "躯干", type: "revolute", groupId: "block-avatar-torso-group", pivot: [0, 12 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -35, max: 35 },
    { id: "block-avatar-head-joint", name: "颈部", type: "revolute", groupId: "block-avatar-head-group", parentJointId: "block-avatar-torso-joint", pivot: [0, 24 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -45, max: 45 },
    { id: "block-avatar-left-arm-joint", name: "左肩", type: "revolute", groupId: "block-avatar-left-arm-group", parentJointId: "block-avatar-torso-joint", pivot: [-4 * pixel, 24 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -160, max: 160 },
    { id: "block-avatar-right-arm-joint", name: "右肩", type: "revolute", groupId: "block-avatar-right-arm-group", parentJointId: "block-avatar-torso-joint", pivot: [4 * pixel, 24 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -160, max: 160 },
    { id: "block-avatar-left-leg-joint", name: "左髋", type: "revolute", groupId: "block-avatar-left-upper-leg-group", pivot: [-2 * pixel, 12 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -120, max: 120 },
    { id: "block-avatar-left-knee-joint", name: "左膝", type: "revolute", groupId: "block-avatar-left-lower-leg-group", parentJointId: "block-avatar-left-leg-joint", pivot: [-2 * pixel, 6 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: 0, max: 120 },
    { id: "block-avatar-right-leg-joint", name: "右髋", type: "revolute", groupId: "block-avatar-right-upper-leg-group", pivot: [2 * pixel, 12 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -120, max: 120 },
    { id: "block-avatar-right-knee-joint", name: "右膝", type: "revolute", groupId: "block-avatar-right-lower-leg-group", parentJointId: "block-avatar-right-leg-joint", pivot: [2 * pixel, 6 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: 0, max: 120 },
  ];
  avatar.featureGraph!.poses = [
    { id: "block-avatar-pose-stand", name: "站立", durationMs: 420, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 0, "block-avatar-right-arm-joint": 0, "block-avatar-left-leg-joint": 0, "block-avatar-left-knee-joint": 0, "block-avatar-right-leg-joint": 0, "block-avatar-right-knee-joint": 0 } },
    { id: "block-avatar-pose-wave", name: "招手", durationMs: 520, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": -8, "block-avatar-left-arm-joint": -145, "block-avatar-right-arm-joint": 0, "block-avatar-left-leg-joint": 0, "block-avatar-left-knee-joint": 0, "block-avatar-right-leg-joint": 0, "block-avatar-right-knee-joint": 0 } },
    { id: "block-avatar-pose-sneak", name: "潜行", durationMs: 460, jointValues: { "block-avatar-torso-joint": 24, "block-avatar-head-joint": -18, "block-avatar-left-arm-joint": 12, "block-avatar-right-arm-joint": -12, "block-avatar-left-leg-joint": -30, "block-avatar-left-knee-joint": 48, "block-avatar-right-leg-joint": -30, "block-avatar-right-knee-joint": 48 } },
    { id: "block-avatar-pose-sit", name: "坐下", durationMs: 620, jointValues: { "block-avatar-torso-joint": 4, "block-avatar-head-joint": -4, "block-avatar-left-arm-joint": -8, "block-avatar-right-arm-joint": -8, "block-avatar-left-leg-joint": -90, "block-avatar-left-knee-joint": 90, "block-avatar-right-leg-joint": -90, "block-avatar-right-knee-joint": 90 } },
  ];
  avatar.featureGraph!.animations = [
    {
      id: "block-avatar-animation-walk",
      name: "走路",
      durationMs: 920,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 32, "block-avatar-right-arm-joint": -32, "block-avatar-left-leg-joint": -34, "block-avatar-left-knee-joint": 10, "block-avatar-right-leg-joint": 34, "block-avatar-right-knee-joint": 38 } },
        { offset: 0.5, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": -32, "block-avatar-right-arm-joint": 32, "block-avatar-left-leg-joint": 34, "block-avatar-left-knee-joint": 38, "block-avatar-right-leg-joint": -34, "block-avatar-right-knee-joint": 10 } },
        { offset: 1, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 32, "block-avatar-right-arm-joint": -32, "block-avatar-left-leg-joint": -34, "block-avatar-left-knee-joint": 10, "block-avatar-right-leg-joint": 34, "block-avatar-right-knee-joint": 38 } },
      ],
    },
    {
      id: "block-avatar-animation-run",
      name: "奔跑",
      durationMs: 560,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 55, "block-avatar-right-arm-joint": -55, "block-avatar-left-leg-joint": -58, "block-avatar-left-knee-joint": 18, "block-avatar-right-leg-joint": 58, "block-avatar-right-knee-joint": 66 } },
        { offset: 0.5, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": -55, "block-avatar-right-arm-joint": 55, "block-avatar-left-leg-joint": 58, "block-avatar-left-knee-joint": 66, "block-avatar-right-leg-joint": -58, "block-avatar-right-knee-joint": 18 } },
        { offset: 1, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 55, "block-avatar-right-arm-joint": -55, "block-avatar-left-leg-joint": -58, "block-avatar-left-knee-joint": 18, "block-avatar-right-leg-joint": 58, "block-avatar-right-knee-joint": 66 } },
      ],
    },
    {
      id: "block-avatar-animation-sneak",
      name: "潜行移动",
      durationMs: 1_180,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "block-avatar-torso-joint": 24, "block-avatar-head-joint": -18, "block-avatar-left-arm-joint": 12, "block-avatar-right-arm-joint": -12, "block-avatar-left-leg-joint": -36, "block-avatar-left-knee-joint": 54, "block-avatar-right-leg-joint": -26, "block-avatar-right-knee-joint": 42 } },
        { offset: 0.5, jointValues: { "block-avatar-torso-joint": 24, "block-avatar-head-joint": -18, "block-avatar-left-arm-joint": -12, "block-avatar-right-arm-joint": 12, "block-avatar-left-leg-joint": -26, "block-avatar-left-knee-joint": 42, "block-avatar-right-leg-joint": -36, "block-avatar-right-knee-joint": 54 } },
        { offset: 1, jointValues: { "block-avatar-torso-joint": 24, "block-avatar-head-joint": -18, "block-avatar-left-arm-joint": 12, "block-avatar-right-arm-joint": -12, "block-avatar-left-leg-joint": -36, "block-avatar-left-knee-joint": 54, "block-avatar-right-leg-joint": -26, "block-avatar-right-knee-joint": 42 } },
      ],
    },
  ];
  avatar.featureGraph!.locomotion = {
    id: "block-avatar-locomotion",
    name: "移动速度",
    walkAnimationId: "block-avatar-animation-walk",
    runAnimationId: "block-avatar-animation-run",
    defaultSpeed: 0,
    minimumSpeed: 0,
    maximumSpeed: 5,
    walkReferenceSpeed: 1.4,
    runReferenceSpeed: 3.6,
    transitionStartSpeed: 1.7,
    transitionEndSpeed: 2.7,
    transitionDurationMs: 420,
  };
  return avatar;
}
