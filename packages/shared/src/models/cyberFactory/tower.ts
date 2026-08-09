import type { CreateModelInput, ModelFeature } from "../../types.js";
import {
  box,
  cylinder,
  group,
  model,
  withFeatureAppearances,
} from "./factory.js";

export interface OfficeTowerParameters {
  width: number;
  depth: number;
  height: number;
}

export const officeTowerParameterLimits = {
  width: { minimum: 220, maximum: 360, step: 10 },
  depth: { minimum: 420, maximum: 620, step: 10 },
  height: { minimum: 460, maximum: 680, step: 10 },
} as const;

export const defaultOfficeTowerParameters: OfficeTowerParameters = {
  width: 260,
  depth: 500,
  height: 540,
};

export const officeTowerFeatureIds = {
  chassis: "cyber-tower-chassis",
  bottomFrame: "cyber-tower-bottom-frame",
  topFrame: "cyber-tower-top-frame",
  leftPanel: "cyber-tower-left-panel",
  sidePanel: "cyber-tower-side-panel",
  frontPanel: "cyber-tower-front-panel",
  rearFan: "cyber-tower-rear-fan",
  power: "cyber-tower-power",
} as const;

export const officeTowerFanFeatureId = (index: number) => `cyber-tower-fan-${index + 1}`;

export const officeTowerGroupIds = {
  chassis: "cyber-tower-chassis-group",
  cooling: "cyber-tower-cooling",
  controls: "cyber-tower-controls",
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) throw new Error("主机箱尺寸必须是有限数值。");
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeOfficeTowerParameters(
  input: Partial<OfficeTowerParameters> = {},
): OfficeTowerParameters {
  return {
    width: clamp(input.width ?? defaultOfficeTowerParameters.width, 220, 360),
    depth: clamp(input.depth ?? defaultOfficeTowerParameters.depth, 420, 620),
    height: clamp(input.height ?? defaultOfficeTowerParameters.height, 460, 680),
  };
}

export function createTower(input: Partial<OfficeTowerParameters> = {}): CreateModelInput {
  const parameters = normalizeOfficeTowerParameters(input);
  const frameThickness = 18;
  const panelHeight = parameters.height - 36;
  const panelDepth = parameters.depth - 58;
  const chassis = withFeatureAppearances([
    box(officeTowerFeatureIds.chassis, "机箱背板", [parameters.width, panelHeight, 14], [0, parameters.height / 2, -parameters.depth / 2 + 22]),
    box(officeTowerFeatureIds.bottomFrame, "底部框架", [parameters.width, frameThickness, parameters.depth - 30], [0, frameThickness / 2, 0]),
    box(officeTowerFeatureIds.topFrame, "顶部框架", [parameters.width, frameThickness, parameters.depth - 30], [0, parameters.height - frameThickness / 2, 0]),
    box(officeTowerFeatureIds.leftPanel, "左侧板", [14, panelHeight, panelDepth], [-parameters.width / 2 + 7, parameters.height / 2, 0]),
    box(officeTowerFeatureIds.sidePanel, "右侧玻璃面板", [8, parameters.height - 44, parameters.depth - 62], [parameters.width / 2 - 4, parameters.height / 2, 0]),
    box(officeTowerFeatureIds.frontPanel, "前置面板", [parameters.width - 40, parameters.height - 70, 18], [0, parameters.height / 2 + 22, parameters.depth / 2 - 6]),
  ], { material: "metal", color: "#354047" }, {
    [officeTowerFeatureIds.sidePanel]: { material: "glass", color: "#5B8FA1" },
    [officeTowerFeatureIds.frontPanel]: { material: "plastic", color: "#20282D" },
  });
  const fanRadius = Math.min(62, (parameters.width - 70) / 3);
  const fanSpacing = (parameters.height - 250) / 2;
  const rawCooling: ModelFeature[] = [-fanSpacing, 0, fanSpacing].map((offset, index) => (
    cylinder(officeTowerFanFeatureId(index), `前置风扇 ${index + 1}`, fanRadius, 12, [0, parameters.height / 2 + 22 + offset, parameters.depth / 2 + 8], [90, 0, 0])
  ));
  rawCooling.push(
    cylinder(officeTowerFeatureIds.rearFan, "后置风扇", Math.min(54, fanRadius), 12, [0, parameters.height - 150, -parameters.depth / 2 + 9], [90, 0, 0]),
  );
  const cooling = withFeatureAppearances(rawCooling, { material: "plastic", color: "#34434B" });
  const controls = withFeatureAppearances([
    cylinder(officeTowerFeatureIds.power, "电源按钮", 18, 14, [parameters.width / 2 - 52, parameters.height - 30, parameters.depth / 2 - 25], [90, 0, 0]),
  ], { material: "plastic", color: "#252E33" }, {
    [officeTowerFeatureIds.power]: { material: "plastic", color: "#C8E94B" },
  });
  const features = [...chassis, ...cooling, ...controls];
  return model("主机箱", "采用空心金属框架、右侧玻璃面板和三风扇散热的参数化办公主机箱。", features, [
    group(officeTowerGroupIds.chassis, "机箱结构", chassis),
    group(officeTowerGroupIds.cooling, "散热系统", cooling),
    group(officeTowerGroupIds.controls, "控制组件", controls),
  ]);
}
