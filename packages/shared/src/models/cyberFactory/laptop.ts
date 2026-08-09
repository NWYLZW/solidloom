import type { CreateModelInput, Vector3Tuple } from "../../types.js";
import {
  box,
  group,
  model,
  offsetWithXRotation,
  origin,
  recessedLaptopDeck,
  recessedRoundedPanel,
  withAppearance,
} from "./factory.js";

export interface OfficeLaptopParameters {
  width: number;
  depth: number;
  openAngle: number;
}

export const officeLaptopParameterLimits = {
  width: { minimum: 300, maximum: 460, step: 10 },
  depth: { minimum: 200, maximum: 320, step: 10 },
  openAngle: { minimum: 0, maximum: 135, step: 1 },
} as const;

export const defaultOfficeLaptopParameters: OfficeLaptopParameters = {
  width: 380,
  depth: 260,
  openAngle: 102,
};

export const officeLaptopFeatureIds = {
  base: "cyber-laptop-base",
  keyboard: "cyber-laptop-keyboard",
  trackpad: "cyber-laptop-trackpad",
  screenShell: "cyber-laptop-screen-shell",
  screenPanel: "cyber-laptop-screen-panel",
  camera: "cyber-laptop-camera",
} as const;

export const officeLaptopGroupIds = {
  base: "cyber-laptop-base-group",
  screen: "cyber-laptop-screen-group",
} as const;

export const officeLaptopJointIds = {
  screenHinge: "cyber-laptop-screen-hinge",
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) throw new Error("笔记本参数必须是有限数值。");
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeOfficeLaptopParameters(
  input: Partial<OfficeLaptopParameters> = {},
): OfficeLaptopParameters {
  return {
    width: clamp(input.width ?? defaultOfficeLaptopParameters.width, 300, 460),
    depth: clamp(input.depth ?? defaultOfficeLaptopParameters.depth, 200, 320),
    openAngle: clamp(input.openAngle ?? defaultOfficeLaptopParameters.openAngle, 0, 135),
  };
}

export function createLaptop(input: Partial<OfficeLaptopParameters> = {}): CreateModelInput {
  const parameters = normalizeOfficeLaptopParameters(input);
  const baseHeight = 9;
  const baseCenterZ = 10;
  const screenHeight = parameters.width * 260 / 380;
  const screenDepth = 7;
  const hinge: Vector3Tuple = [0, baseHeight, -parameters.depth / 2 + 10];
  const screenRotation: Vector3Tuple = [90 - parameters.openAngle, 0, 0];
  const screenCenter = offsetWithXRotation(
    hinge,
    [0, screenHeight / 2, -screenDepth / 2],
    screenRotation[0],
  );
  const screenPosition = (offset: Vector3Tuple) => (
    offsetWithXRotation(screenCenter, offset, screenRotation[0])
  );
  const base = [
    withAppearance(
      recessedLaptopDeck(
        officeLaptopFeatureIds.base,
        "机身底座",
        [parameters.width, baseHeight, parameters.depth],
        [0, baseHeight / 2, baseCenterZ],
        [
          { center: [0, -parameters.depth * 0.135], size: [parameters.width - 54, parameters.depth * 0.469], depth: 2.2 },
          { center: [0, parameters.depth * 0.346], size: [parameters.width * 0.358, parameters.depth * 0.269], depth: 2.2 },
        ],
        10,
        3.6,
      ),
      "metal",
      "#97A2AA",
    ),
    withAppearance(
      box(officeLaptopFeatureIds.keyboard, "键盘面板", [parameters.width - 60, 1.2, parameters.depth * 0.446], [0, 7.7, -parameters.depth * 0.096], origin, { radius: 2, algorithm: "smooth" }),
      "plastic",
      "#30383D",
    ),
    withAppearance(
      box(officeLaptopFeatureIds.trackpad, "触控板", [parameters.width * 0.342, 1.2, parameters.depth * 0.246], [0, 7.7, parameters.depth * 0.385], origin, { radius: 2, algorithm: "smooth" }),
      "glass",
      "#5F7380",
    ),
  ];
  const screen = [
    withAppearance(
      recessedRoundedPanel(
        officeLaptopFeatureIds.screenShell,
        "屏幕外壳",
        [parameters.width, screenHeight, screenDepth],
        [parameters.width - 10, screenHeight - 10, 3],
        screenCenter,
        screenRotation,
        6,
        3,
        3,
      ),
      "metal",
      "#87949E",
    ),
    withAppearance(
      box(officeLaptopFeatureIds.screenPanel, "显示屏", [parameters.width - 12, screenHeight - 12, 1], screenPosition([0, 0, 1]), screenRotation, { radius: 0.5, algorithm: "smooth" }),
      "glass",
      "#102A38",
    ),
    withAppearance(
      box(officeLaptopFeatureIds.camera, "屏幕摄像头", [18, 3.5, 0.6], screenPosition([0, screenHeight / 2 - 2.75, 1.8]), screenRotation, { radius: 0.3, algorithm: "circular" }),
      "plastic",
      "#11171B",
    ),
  ];
  const features = [...base, ...screen];
  const laptop = model("笔记本", "带可调屏幕转轴的轻薄办公笔记本，包含内嵌键盘、前置触控板和窄边框显示屏。", features, [
    group(officeLaptopGroupIds.base, "键盘底座", base),
    group(officeLaptopGroupIds.screen, "屏幕组件", screen),
  ]);
  laptop.featureGraph!.joints = [{
    id: officeLaptopJointIds.screenHinge,
    name: "屏幕转轴",
    type: "revolute",
    groupId: officeLaptopGroupIds.screen,
    pivot: hinge,
    axis: [-1, 0, 0],
    value: parameters.openAngle,
    restValue: parameters.openAngle,
    min: 0,
    max: 135,
  }];
  return laptop;
}
