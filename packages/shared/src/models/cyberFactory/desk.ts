import type { CreateModelInput } from "../../types.js";
import {
  box,
  cylinder,
  group,
  model,
  withFeatureAppearances,
} from "./factory.js";

export interface OfficeDeskParameters {
  width: number;
  depth: number;
  height: number;
}

export const officeDeskParameterLimits = {
  width: { minimum: 1_200, maximum: 2_200, step: 20 },
  depth: { minimum: 650, maximum: 900, step: 10 },
  height: { minimum: 680, maximum: 820, step: 10 },
} as const;

export const defaultOfficeDeskParameters: OfficeDeskParameters = {
  width: 1_600,
  depth: 760,
  height: 760,
};

export const officeDeskFeatureIds = {
  top: "cyber-desk-top",
  grommetLeft: "cyber-desk-grommet-left",
  grommetRight: "cyber-desk-grommet-right",
  legFrontLeft: "cyber-desk-leg-fl",
  legFrontRight: "cyber-desk-leg-fr",
  legBackLeft: "cyber-desk-leg-bl",
  legBackRight: "cyber-desk-leg-br",
  crossbar: "cyber-desk-crossbar",
  modestyPanel: "cyber-desk-modesty",
  cableTray: "cyber-desk-cable-tray",
  controlRail: "cyber-desk-control-rail",
  heightButton: "cyber-desk-height-button",
} as const;

export const officeDeskGroupIds = {
  surface: "cyber-desk-surface",
  frame: "cyber-desk-frame",
  accessories: "cyber-desk-accessories",
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) throw new Error("办公桌尺寸必须是有限数值。");
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeOfficeDeskParameters(
  input: Partial<OfficeDeskParameters> = {},
): OfficeDeskParameters {
  return {
    width: clamp(input.width ?? defaultOfficeDeskParameters.width, 1_200, 2_200),
    depth: clamp(input.depth ?? defaultOfficeDeskParameters.depth, 650, 900),
    height: clamp(input.height ?? defaultOfficeDeskParameters.height, 680, 820),
  };
}

export function createDesk(input: Partial<OfficeDeskParameters> = {}): CreateModelInput {
  const parameters = normalizeOfficeDeskParameters(input);
  const topThickness = 34;
  const legSize = 54;
  const legInsetX = Math.min(90, parameters.width * 0.08);
  const legInsetZ = Math.min(80, parameters.depth * 0.12);
  const legHeight = parameters.height - 40;
  const surface = withFeatureAppearances([
    box(
      officeDeskFeatureIds.top,
      "桌面",
      [parameters.width, topThickness, parameters.depth],
      [0, parameters.height - topThickness / 2, 0],
    ),
    cylinder(
      officeDeskFeatureIds.grommetLeft,
      "左穿线孔",
      34,
      10,
      [-parameters.width * 0.325, parameters.height + 5, parameters.depth / 2 - 125],
    ),
    cylinder(
      officeDeskFeatureIds.grommetRight,
      "右穿线孔",
      34,
      10,
      [parameters.width * 0.325, parameters.height + 5, parameters.depth / 2 - 125],
    ),
  ], { material: "wood", color: "#76513B" }, {
    [officeDeskFeatureIds.grommetLeft]: { material: "metal", color: "#273137" },
    [officeDeskFeatureIds.grommetRight]: { material: "metal", color: "#273137" },
  });
  const frame = withFeatureAppearances([
    box(officeDeskFeatureIds.legFrontLeft, "左前桌腿", [legSize, legHeight, legSize], [-parameters.width / 2 + legInsetX, legHeight / 2, -parameters.depth / 2 + legInsetZ]),
    box(officeDeskFeatureIds.legFrontRight, "右前桌腿", [legSize, legHeight, legSize], [parameters.width / 2 - legInsetX, legHeight / 2, -parameters.depth / 2 + legInsetZ]),
    box(officeDeskFeatureIds.legBackLeft, "左后桌腿", [legSize, legHeight, legSize], [-parameters.width / 2 + legInsetX, legHeight / 2, parameters.depth / 2 - legInsetZ]),
    box(officeDeskFeatureIds.legBackRight, "右后桌腿", [legSize, legHeight, legSize], [parameters.width / 2 - legInsetX, legHeight / 2, parameters.depth / 2 - legInsetZ]),
    box(officeDeskFeatureIds.crossbar, "后横梁", [parameters.width - legInsetX * 2, 70, 42], [0, parameters.height - 170, parameters.depth / 2 - legInsetZ]),
    box(officeDeskFeatureIds.modestyPanel, "挡板", [parameters.width * 0.7, Math.min(300, parameters.height * 0.42), 20], [0, parameters.height * 0.586, parameters.depth / 2 - legInsetZ + 15]),
  ], { material: "metal", color: "#4B5960" }, {
    [officeDeskFeatureIds.modestyPanel]: { material: "metal", color: "#5C686E" },
  });
  const accessories = withFeatureAppearances([
    box(officeDeskFeatureIds.cableTray, "线缆托盘", [parameters.width * 0.675, 70, 120], [0, parameters.height - 125, parameters.depth / 2 - 140]),
    box(officeDeskFeatureIds.controlRail, "控制导轨", [360, 42, 54], [parameters.width * 0.2625, parameters.height - 55, -parameters.depth / 2 + 30]),
    cylinder(officeDeskFeatureIds.heightButton, "升降按钮", 18, 22, [parameters.width * 0.3375, parameters.height - 56, -parameters.depth / 2 - 6], [90, 0, 0]),
  ], { material: "metal", color: "#38464D" }, {
    [officeDeskFeatureIds.heightButton]: { material: "plastic", color: "#B7D83A" },
  });
  const features = [...surface, ...frame, ...accessories];
  return model("办公桌", "赛博工厂工作站使用的真实毫米尺度办公桌，包含穿线孔、线缆托盘和升降控制导轨。", features, [
    group(officeDeskGroupIds.surface, "桌面组件", surface),
    group(officeDeskGroupIds.frame, "支撑框架", frame),
    group(officeDeskGroupIds.accessories, "线缆管理", accessories),
  ]);
}
