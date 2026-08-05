import type {
  BoxFeature,
  CreateModelInput,
  CylinderFeature,
  FeatureAppearance,
  ModelVariable,
  Vector3Tuple,
} from "@solidloom/shared";
import type { WaterDispenserParameters } from "./types.js";

export const WATER_DISPENSER_ASSET_ID = "water-dispenser";
export const WATER_DISPENSER_DISPLAY_NAME = "参数化饮水机";

export const defaultWaterDispenserParameters: Readonly<WaterDispenserParameters> = {
  width: 360,
  depth: 380,
  bodyHeight: 1_020,
  tankRadius: 138,
  tankHeight: 420,
  nozzleSpacing: 118,
};

export const waterDispenserParameterLimits = {
  width: { minimum: 300, maximum: 460, step: 10 },
  depth: { minimum: 320, maximum: 480, step: 10 },
  bodyHeight: { minimum: 900, maximum: 1_180, step: 10 },
  tankRadius: { minimum: 105, maximum: 180, step: 5 },
  tankHeight: { minimum: 320, maximum: 520, step: 10 },
  nozzleSpacing: { minimum: 90, maximum: 150, step: 2 },
} as const;

export const waterDispenserCoreFeatureIds = [
  "body-shell",
  "base",
  "front-panel",
  "dispense-alcove",
  "drip-tray",
  "hot-button",
  "cold-button",
  "hot-nozzle",
  "cold-nozzle",
  "tank-connector",
  "water-tank",
  "tank-cap",
] as const;

export const waterDispenserDetailFeatureIds = [
  "tray-grate-left",
  "tray-grate-right",
  "brand-strip",
] as const;

export const waterDispenserAllFeatureIds = [
  ...waterDispenserCoreFeatureIds,
  ...waterDispenserDetailFeatureIds,
] as const;

const zeroRotation: Vector3Tuple = [0, 0, 0];
const bodyAppearance: FeatureAppearance = { material: "plastic", color: "#E8EDF2" };
const darkAppearance: FeatureAppearance = { material: "plastic", color: "#18232D" };
const metalAppearance: FeatureAppearance = { material: "metal", color: "#AFC0CA" };
const tankAppearance: FeatureAppearance = { material: "glass", color: "#71D1EF" };
const hotAppearance: FeatureAppearance = { material: "plastic", color: "#DF5A52" };
const coldAppearance: FeatureAppearance = { material: "plastic", color: "#3F8FE8" };
const rubberAppearance: FeatureAppearance = { material: "rubber", color: "#263139" };

function box(
  id: string,
  name: string,
  size: Vector3Tuple,
  position: Vector3Tuple,
  appearance: FeatureAppearance,
  cornerRadius: number,
  parameterExpressions: Record<string, string> = {},
): BoxFeature {
  return {
    id,
    name,
    type: "box",
    operation: "add",
    position,
    rotation: zeroRotation,
    appearance,
    ...(Object.keys(parameterExpressions).length > 0 ? { parameterExpressions } : {}),
    parameters: {
      width: size[0],
      height: size[1],
      depth: size[2],
      cornerRadius,
      cornerAlgorithm: "smooth",
    },
  };
}

function cylinder(
  id: string,
  name: string,
  radius: number,
  height: number,
  position: Vector3Tuple,
  appearance: FeatureAppearance,
  rotation: Vector3Tuple = zeroRotation,
  parameterExpressions: Record<string, string> = {},
): CylinderFeature {
  return {
    id,
    name,
    type: "cylinder",
    operation: "add",
    position,
    rotation,
    appearance,
    ...(Object.keys(parameterExpressions).length > 0 ? { parameterExpressions } : {}),
    parameters: { radius, height },
  };
}

export function resolveWaterDispenserParameters(
  partialParameters: Partial<WaterDispenserParameters> = {},
): WaterDispenserParameters {
  const parameters: WaterDispenserParameters = {
    ...defaultWaterDispenserParameters,
    ...partialParameters,
  };
  for (const key of Object.keys(waterDispenserParameterLimits) as Array<keyof WaterDispenserParameters>) {
    const value = parameters[key];
    const limit = waterDispenserParameterLimits[key];
    if (!Number.isFinite(value) || value < limit.minimum || value > limit.maximum) {
      throw new RangeError(`${key} must be between ${limit.minimum} and ${limit.maximum}`);
    }
  }
  if (parameters.tankRadius * 2 > parameters.width - 24) {
    throw new RangeError("tankRadius must leave at least 12 mm clearance on each side");
  }
  return parameters;
}

function createVariables(parameters: WaterDispenserParameters): ModelVariable[] {
  return [
    { id: "--width", label: "机身宽度", value: parameters.width, unit: "mm" },
    { id: "--depth", label: "机身深度", value: parameters.depth, unit: "mm" },
    { id: "--body-height", label: "机身高度", value: parameters.bodyHeight, unit: "mm" },
    { id: "--tank-radius", label: "水桶半径", value: parameters.tankRadius, unit: "mm" },
    { id: "--tank-height", label: "水桶高度", value: parameters.tankHeight, unit: "mm" },
    { id: "--nozzle-spacing", label: "出水口间距", value: parameters.nozzleSpacing, unit: "mm" },
  ];
}

export function createWaterDispenserModel(
  partialParameters: Partial<WaterDispenserParameters> = {},
): CreateModelInput {
  const parameters = resolveWaterDispenserParameters(partialParameters);
  const { width, depth, bodyHeight, tankRadius, tankHeight, nozzleSpacing } = parameters;
  const front = depth / 2;
  const features = [
    box(
      "body-shell",
      "机身",
      [width, bodyHeight, depth],
      [0, bodyHeight / 2, 0],
      bodyAppearance,
      26,
      {
        "parameters.width": "var(--width)",
        "parameters.height": "var(--body-height)",
        "parameters.depth": "var(--depth)",
        "position.1": "var(--body-height) / 2",
      },
    ),
    box(
      "base",
      "防滑底座",
      [width - 22, 22, depth - 20],
      [0, 11, 0],
      rubberAppearance,
      8,
      {
        "parameters.width": "var(--width) - 22",
        "parameters.depth": "var(--depth) - 20",
      },
    ),
    box(
      "front-panel",
      "前面板",
      [width * 0.72, bodyHeight * 0.34, 18],
      [0, bodyHeight * 0.63, front + 9],
      darkAppearance,
      18,
      {
        "parameters.width": "var(--width) * 0.72",
        "parameters.height": "var(--body-height) * 0.34",
        "position.1": "var(--body-height) * 0.63",
        "position.2": "var(--depth) / 2 + 9",
      },
    ),
    box(
      "dispense-alcove",
      "接水区",
      [width * 0.58, bodyHeight * 0.22, 24],
      [0, bodyHeight * 0.56, front + 24],
      darkAppearance,
      14,
      {
        "parameters.width": "var(--width) * 0.58",
        "parameters.height": "var(--body-height) * 0.22",
        "position.1": "var(--body-height) * 0.56",
        "position.2": "var(--depth) / 2 + 24",
      },
    ),
    box(
      "drip-tray",
      "接水盘",
      [width * 0.62, 18, depth * 0.42],
      [0, bodyHeight * 0.39, front + depth * 0.12],
      metalAppearance,
      8,
      {
        "parameters.width": "var(--width) * 0.62",
        "parameters.depth": "var(--depth) * 0.42",
        "position.1": "var(--body-height) * 0.39",
        "position.2": "var(--depth) * 0.62",
      },
    ),
    box(
      "hot-button",
      "热水按钮",
      [52, 28, 18],
      [-nozzleSpacing / 2, bodyHeight * 0.79, front + 25],
      hotAppearance,
      9,
      {
        "position.0": "var(--nozzle-spacing) / -2",
        "position.1": "var(--body-height) * 0.79",
        "position.2": "var(--depth) / 2 + 25",
      },
    ),
    box(
      "cold-button",
      "冷水按钮",
      [52, 28, 18],
      [nozzleSpacing / 2, bodyHeight * 0.79, front + 25],
      coldAppearance,
      9,
      {
        "position.0": "var(--nozzle-spacing) / 2",
        "position.1": "var(--body-height) * 0.79",
        "position.2": "var(--depth) / 2 + 25",
      },
    ),
    cylinder(
      "hot-nozzle",
      "热水出水口",
      13,
      56,
      [-nozzleSpacing / 2, bodyHeight * 0.63, front + 48],
      metalAppearance,
      [90, 0, 0],
      {
        "position.0": "var(--nozzle-spacing) / -2",
        "position.1": "var(--body-height) * 0.63",
        "position.2": "var(--depth) / 2 + 48",
      },
    ),
    cylinder(
      "cold-nozzle",
      "冷水出水口",
      13,
      56,
      [nozzleSpacing / 2, bodyHeight * 0.63, front + 48],
      metalAppearance,
      [90, 0, 0],
      {
        "position.0": "var(--nozzle-spacing) / 2",
        "position.1": "var(--body-height) * 0.63",
        "position.2": "var(--depth) / 2 + 48",
      },
    ),
    cylinder(
      "tank-connector",
      "水桶接口",
      Math.min(82, tankRadius * 0.62),
      56,
      [0, bodyHeight + 28, 0],
      darkAppearance,
      zeroRotation,
      { "position.1": "var(--body-height) + 28" },
    ),
    cylinder(
      "water-tank",
      "透明水桶",
      tankRadius,
      tankHeight,
      [0, bodyHeight + 56 + tankHeight / 2, 0],
      tankAppearance,
      zeroRotation,
      {
        "parameters.radius": "var(--tank-radius)",
        "parameters.height": "var(--tank-height)",
        "position.1": "var(--body-height) + 56 + var(--tank-height) / 2",
      },
    ),
    cylinder(
      "tank-cap",
      "水桶顶盖",
      tankRadius * 0.48,
      34,
      [0, bodyHeight + 56 + tankHeight + 17, 0],
      coldAppearance,
      zeroRotation,
      {
        "parameters.radius": "var(--tank-radius) * 0.48",
        "position.1": "var(--body-height) + 56 + var(--tank-height) + 17",
      },
    ),
    box(
      "tray-grate-left",
      "接水盘左格栅",
      [width * 0.22, 7, depth * 0.3],
      [-width * 0.16, bodyHeight * 0.39 + 12, front + depth * 0.12],
      darkAppearance,
      3,
      {
        "parameters.width": "var(--width) * 0.22",
        "parameters.depth": "var(--depth) * 0.3",
        "position.0": "var(--width) * -0.16",
        "position.1": "var(--body-height) * 0.39 + 12",
        "position.2": "var(--depth) * 0.62",
      },
    ),
    box(
      "tray-grate-right",
      "接水盘右格栅",
      [width * 0.22, 7, depth * 0.3],
      [width * 0.16, bodyHeight * 0.39 + 12, front + depth * 0.12],
      darkAppearance,
      3,
      {
        "parameters.width": "var(--width) * 0.22",
        "parameters.depth": "var(--depth) * 0.3",
        "position.0": "var(--width) * 0.16",
        "position.1": "var(--body-height) * 0.39 + 12",
        "position.2": "var(--depth) * 0.62",
      },
    ),
    box(
      "brand-strip",
      "品牌饰条",
      [width * 0.42, 14, 8],
      [0, bodyHeight * 0.9, front + 14],
      metalAppearance,
      4,
      {
        "parameters.width": "var(--width) * 0.42",
        "position.1": "var(--body-height) * 0.9",
        "position.2": "var(--depth) / 2 + 14",
      },
    ),
  ];

  return {
    name: WATER_DISPENSER_DISPLAY_NAME,
    description: "可调整机身、水桶和出水口尺寸，并提供接水站位、碰撞体与移动 LOD 的落地式饮水机。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [
        {
          id: "dispenser-body",
          name: "饮水机机身",
          featureIds: waterDispenserCoreFeatureIds.filter((id) => !id.startsWith("tank-") && id !== "water-tank"),
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
        {
          id: "dispenser-tank",
          name: "水桶组件",
          featureIds: ["tank-connector", "water-tank", "tank-cap"],
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
        {
          id: "dispenser-detail",
          name: "桌面细节",
          featureIds: [...waterDispenserDetailFeatureIds],
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
      ],
      variables: createVariables(parameters),
    },
  };
}
