import type {
  BoxFeature,
  CreateModelInput,
  CylinderFeature,
  FeatureAppearance,
  ModelVariable,
  Vector3Tuple,
} from "../../types.js";
import type { WaterDispenserParameters } from "./waterDispenserTypes.js";

export const WATER_DISPENSER_ASSET_ID = "water-dispenser";
export const WATER_DISPENSER_DISPLAY_NAME = "参数化下置桶饮水机";

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

export const waterDispenserDoorFeatureIds = [
  "cabinet-door",
] as const;

export const waterDispenserTankFeatureIds = [
  "water-tank",
  "tank-shoulder",
  "tank-neck",
  "tank-cap",
  "tank-connector",
] as const;

export const waterDispenserCoreFeatureIds = [
  "body-shell",
  "base",
  "cabinet-back",
  "cabinet-left-wall",
  "cabinet-right-wall",
  "cabinet-floor",
  "cabinet-ceiling",
  "cabinet-interior",
  ...waterDispenserDoorFeatureIds,
  "upper-left-frame",
  "upper-right-frame",
  "upper-top-frame",
  "upper-bottom-frame",
  "front-panel",
  "power-indicator",
  "heating-indicator",
  "cooling-indicator",
  "dispense-alcove",
  "drip-tray",
  "hot-button",
  "ambient-button",
  "cold-button",
  "hot-nozzle",
  "ambient-nozzle",
  "cold-nozzle",
  ...waterDispenserTankFeatureIds,
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
const interiorAppearance: FeatureAppearance = { material: "plastic", color: "#101A22" };
const metalAppearance: FeatureAppearance = { material: "metal", color: "#AFC0CA" };
const tankAppearance: FeatureAppearance = { material: "glass", color: "#71D1EF" };
const hotAppearance: FeatureAppearance = { material: "plastic", color: "#DF5A52" };
const ambientAppearance: FeatureAppearance = { material: "plastic", color: "#64BE94" };
const coldAppearance: FeatureAppearance = { material: "plastic", color: "#3F8FE8" };
const powerAppearance: FeatureAppearance = { material: "plastic", color: "#26C985" };
const heatingAppearance: FeatureAppearance = { material: "plastic", color: "#FF9C4A" };
const coolingAppearance: FeatureAppearance = { material: "plastic", color: "#45A9F8" };
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
  if (parameters.tankRadius * 2 > parameters.width - 84) {
    throw new RangeError("tankRadius does not fit inside the lower cabinet");
  }
  if (parameters.tankHeight + 86 > parameters.bodyHeight * 0.52) {
    throw new RangeError("tankHeight does not fit below the cabinet ceiling");
  }
  if (parameters.nozzleSpacing + 52 > parameters.width - 116) {
    throw new RangeError("nozzleSpacing does not fit three controls across the upper panel");
  }
  return parameters;
}

function createVariables(parameters: WaterDispenserParameters): ModelVariable[] {
  return [
    { id: "--width", label: "机身宽度", type: "number", value: parameters.width, unit: "mm" },
    { id: "--depth", label: "机身深度", type: "number", value: parameters.depth, unit: "mm" },
    { id: "--body-height", label: "机身高度", type: "number", value: parameters.bodyHeight, unit: "mm" },
    { id: "--tank-radius", label: "水桶半径", type: "number", value: parameters.tankRadius, unit: "mm" },
    { id: "--tank-height", label: "水桶高度", type: "number", value: parameters.tankHeight, unit: "mm" },
    { id: "--nozzle-spacing", label: "出水口间距", type: "number", value: parameters.nozzleSpacing, unit: "mm" },
  ];
}

export function createWaterDispenserModel(
  partialParameters: Partial<WaterDispenserParameters> = {},
): CreateModelInput {
  const parameters = resolveWaterDispenserParameters(partialParameters);
  const { width, depth, bodyHeight, tankRadius, tankHeight, nozzleSpacing } = parameters;
  const front = depth / 2;
  const cabinetTop = bodyHeight * 0.52;
  const cabinetFloorTop = 30;
  const cabinetHeight = cabinetTop - cabinetFloorTop;
  const cabinetCenterY = cabinetFloorTop + cabinetHeight / 2;
  const upperBodyHeight = bodyHeight - cabinetTop;
  const upperBodyCenterY = cabinetTop + upperBodyHeight / 2;
  const upperFrontDepth = 76;
  const upperFrameWidth = 46;
  const doorWidth = width - 44;
  const doorHeight = cabinetHeight - 36;
  const tankBodyHeight = tankHeight - 90;
  const doorHingeX = -doorWidth / 2;
  const doorZ = front + 10;

  const features = [
    box(
      "body-shell",
      "上部机身后壳",
      [width, upperBodyHeight, depth - upperFrontDepth],
      [0, upperBodyCenterY, -upperFrontDepth / 2],
      bodyAppearance,
      26,
      {
        "parameters.width": "var(--width)",
        "parameters.height": "var(--body-height) * 0.48",
        "parameters.depth": "var(--depth) - 76",
        "position.1": "var(--body-height) * 0.76",
        "position.2": "-38",
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
      "cabinet-back",
      "储水柜背板",
      [width - 34, cabinetHeight, 26],
      [0, cabinetCenterY, -front + 13],
      bodyAppearance,
      5,
      {
        "parameters.width": "var(--width) - 34",
        "parameters.height": "var(--body-height) * 0.52 - 30",
        "position.1": "var(--body-height) * 0.26 + 15",
        "position.2": "var(--depth) / -2 + 13",
      },
    ),
    box(
      "cabinet-left-wall",
      "储水柜左侧板",
      [34, cabinetHeight, depth],
      [-width / 2 + 17, cabinetCenterY, 0],
      bodyAppearance,
      8,
      {
        "parameters.height": "var(--body-height) * 0.52 - 30",
        "parameters.depth": "var(--depth)",
        "position.0": "var(--width) / -2 + 17",
        "position.1": "var(--body-height) * 0.26 + 15",
      },
    ),
    box(
      "cabinet-right-wall",
      "储水柜右侧板",
      [34, cabinetHeight, depth],
      [width / 2 - 17, cabinetCenterY, 0],
      bodyAppearance,
      8,
      {
        "parameters.height": "var(--body-height) * 0.52 - 30",
        "parameters.depth": "var(--depth)",
        "position.0": "var(--width) / 2 - 17",
        "position.1": "var(--body-height) * 0.26 + 15",
      },
    ),
    box(
      "cabinet-floor",
      "储水柜底板",
      [width, 30, depth],
      [0, 15, 0],
      bodyAppearance,
      8,
      {
        "parameters.width": "var(--width)",
        "parameters.depth": "var(--depth)",
      },
    ),
    box(
      "cabinet-ceiling",
      "储水柜顶板",
      [width, 30, depth],
      [0, cabinetTop - 15, 0],
      bodyAppearance,
      8,
      {
        "parameters.width": "var(--width)",
        "parameters.depth": "var(--depth)",
        "position.1": "var(--body-height) * 0.52 - 15",
      },
    ),
    box(
      "cabinet-interior",
      "储水柜内腔",
      [width - 80, cabinetHeight - 40, 14],
      [0, cabinetCenterY, -front + 32],
      interiorAppearance,
      10,
      {
        "parameters.width": "var(--width) - 80",
        "parameters.height": "var(--body-height) * 0.52 - 70",
        "position.1": "var(--body-height) * 0.26 + 15",
        "position.2": "var(--depth) / -2 + 32",
      },
    ),
    box(
      "cabinet-door",
      "储水柜门",
      [doorWidth, doorHeight, 20],
      [0, cabinetCenterY, doorZ],
      bodyAppearance,
      14,
      {
        "parameters.width": "var(--width) - 44",
        "parameters.height": "var(--body-height) * 0.52 - 66",
        "position.1": "var(--body-height) * 0.26 + 15",
        "position.2": "var(--depth) / 2 + 10",
      },
    ),
    box(
      "upper-left-frame",
      "内嵌接水区左框",
      [upperFrameWidth, upperBodyHeight, upperFrontDepth],
      [-width / 2 + upperFrameWidth / 2, upperBodyCenterY, front - upperFrontDepth / 2],
      bodyAppearance,
      10,
      {
        "parameters.height": "var(--body-height) * 0.48",
        "position.0": "var(--width) / -2 + 23",
        "position.1": "var(--body-height) * 0.76",
        "position.2": "var(--depth) / 2 - 38",
      },
    ),
    box(
      "upper-right-frame",
      "内嵌接水区右框",
      [upperFrameWidth, upperBodyHeight, upperFrontDepth],
      [width / 2 - upperFrameWidth / 2, upperBodyCenterY, front - upperFrontDepth / 2],
      bodyAppearance,
      10,
      {
        "parameters.height": "var(--body-height) * 0.48",
        "position.0": "var(--width) / 2 - 23",
        "position.1": "var(--body-height) * 0.76",
        "position.2": "var(--depth) / 2 - 38",
      },
    ),
    box(
      "upper-top-frame",
      "顶部控制区机身",
      [width - upperFrameWidth * 2, 188, upperFrontDepth],
      [0, bodyHeight - 94, front - upperFrontDepth / 2],
      bodyAppearance,
      14,
      {
        "parameters.width": "var(--width) - 92",
        "position.1": "var(--body-height) - 94",
        "position.2": "var(--depth) / 2 - 38",
      },
    ),
    box(
      "upper-bottom-frame",
      "内嵌接水区下框",
      [width - upperFrameWidth * 2, 68, upperFrontDepth],
      [0, cabinetTop + 34, front - upperFrontDepth / 2],
      bodyAppearance,
      10,
      {
        "parameters.width": "var(--width) - 92",
        "position.1": "var(--body-height) * 0.52 + 34",
        "position.2": "var(--depth) / 2 - 38",
      },
    ),
    box(
      "front-panel",
      "顶部状态控制面板",
      [width - 116, 142, 14],
      [0, bodyHeight - 85, front + 7],
      darkAppearance,
      13,
      {
        "parameters.width": "var(--width) - 116",
        "position.1": "var(--body-height) - 85",
        "position.2": "var(--depth) / 2 + 7",
      },
    ),
    box(
      "power-indicator",
      "电源状态灯",
      [18, 18, 10],
      [-56, bodyHeight * 0.89, front + 19],
      powerAppearance,
      9,
      { "position.1": "var(--body-height) * 0.89", "position.2": "var(--depth) / 2 + 19" },
    ),
    box(
      "heating-indicator",
      "制热状态灯",
      [18, 18, 10],
      [0, bodyHeight * 0.89, front + 19],
      heatingAppearance,
      9,
      { "position.1": "var(--body-height) * 0.89", "position.2": "var(--depth) / 2 + 19" },
    ),
    box(
      "cooling-indicator",
      "制冷状态灯",
      [18, 18, 10],
      [56, bodyHeight * 0.89, front + 19],
      coolingAppearance,
      9,
      { "position.1": "var(--body-height) * 0.89", "position.2": "var(--depth) / 2 + 19" },
    ),
    box(
      "dispense-alcove",
      "内嵌接水区背板",
      [width - 110, bodyHeight * 0.21, 12],
      [0, bodyHeight * 0.7, front - 70],
      darkAppearance,
      8,
      {
        "parameters.width": "var(--width) - 110",
        "parameters.height": "var(--body-height) * 0.21",
        "position.1": "var(--body-height) * 0.7",
        "position.2": "var(--depth) / 2 - 70",
      },
    ),
    box(
      "drip-tray",
      "接水盘",
      [width - 116, 18, depth * 0.24],
      [0, bodyHeight * 0.6, front - 60],
      metalAppearance,
      8,
      {
        "parameters.width": "var(--width) - 116",
        "parameters.depth": "var(--depth) * 0.24",
        "position.1": "var(--body-height) * 0.6",
        "position.2": "var(--depth) / 2 - 60",
      },
    ),
    box(
      "hot-button",
      "热水按钮",
      [52, 28, 18],
      [-nozzleSpacing / 2, bodyHeight * 0.952, front + 19],
      hotAppearance,
      9,
      {
        "position.0": "var(--nozzle-spacing) / -2",
        "position.1": "var(--body-height) * 0.952",
        "position.2": "var(--depth) / 2 + 19",
      },
    ),
    box(
      "ambient-button",
      "常温水按钮",
      [52, 28, 18],
      [0, bodyHeight * 0.952, front + 19],
      ambientAppearance,
      9,
      {
        "position.1": "var(--body-height) * 0.952",
        "position.2": "var(--depth) / 2 + 19",
      },
    ),
    box(
      "cold-button",
      "冷水按钮",
      [52, 28, 18],
      [nozzleSpacing / 2, bodyHeight * 0.952, front + 19],
      coldAppearance,
      9,
      {
        "position.0": "var(--nozzle-spacing) / 2",
        "position.1": "var(--body-height) * 0.952",
        "position.2": "var(--depth) / 2 + 19",
      },
    ),
    cylinder(
      "hot-nozzle",
      "热水出水口",
      13,
      36,
      [-nozzleSpacing / 2, bodyHeight * 0.755, front - 48],
      metalAppearance,
      [90, 0, 0],
      {
        "position.0": "var(--nozzle-spacing) / -2",
        "position.1": "var(--body-height) * 0.755",
        "position.2": "var(--depth) / 2 - 48",
      },
    ),
    cylinder(
      "ambient-nozzle",
      "常温水出水口",
      13,
      36,
      [0, bodyHeight * 0.755, front - 48],
      metalAppearance,
      [90, 0, 0],
      {
        "position.1": "var(--body-height) * 0.755",
        "position.2": "var(--depth) / 2 - 48",
      },
    ),
    cylinder(
      "cold-nozzle",
      "冷水出水口",
      13,
      36,
      [nozzleSpacing / 2, bodyHeight * 0.755, front - 48],
      metalAppearance,
      [90, 0, 0],
      {
        "position.0": "var(--nozzle-spacing) / 2",
        "position.1": "var(--body-height) * 0.755",
        "position.2": "var(--depth) / 2 - 48",
      },
    ),
    cylinder(
      "water-tank",
      "下置透明水桶",
      tankRadius,
      tankBodyHeight,
      [0, cabinetFloorTop + tankBodyHeight / 2, -12],
      tankAppearance,
      zeroRotation,
      {
        "parameters.radius": "var(--tank-radius)",
        "parameters.height": "var(--tank-height) - 90",
        "position.1": "30 + (var(--tank-height) - 90) / 2",
      },
    ),
    cylinder(
      "tank-shoulder",
      "水桶肩部",
      tankRadius * 0.78,
      70,
      [0, cabinetFloorTop + tankHeight - 55, -12],
      tankAppearance,
      zeroRotation,
      {
        "parameters.radius": "var(--tank-radius) * 0.78",
        "position.1": "30 + var(--tank-height) - 55",
      },
    ),
    cylinder(
      "tank-neck",
      "水桶颈部",
      tankRadius * 0.44,
      42,
      [0, cabinetFloorTop + tankHeight - 5, -12],
      tankAppearance,
      zeroRotation,
      {
        "parameters.radius": "var(--tank-radius) * 0.44",
        "position.1": "30 + var(--tank-height) - 5",
      },
    ),
    cylinder(
      "tank-cap",
      "水桶聪明盖",
      tankRadius * 0.34,
      26,
      [0, cabinetFloorTop + tankHeight + 15, -12],
      coldAppearance,
      zeroRotation,
      {
        "parameters.radius": "var(--tank-radius) * 0.34",
        "position.1": "30 + var(--tank-height) + 15",
      },
    ),
    cylinder(
      "tank-connector",
      "抽水泵接头",
      tankRadius * 0.25,
      18,
      [0, cabinetFloorTop + tankHeight + 32, -12],
      darkAppearance,
      zeroRotation,
      {
        "parameters.radius": "var(--tank-radius) * 0.25",
        "position.1": "30 + var(--tank-height) + 32",
      },
    ),
    box(
      "tray-grate-left",
      "接水盘左格栅",
      [width * 0.22, 7, depth * 0.18],
      [-width * 0.13, bodyHeight * 0.6 + 12, front - 60],
      darkAppearance,
      3,
      {
        "parameters.width": "var(--width) * 0.22",
        "parameters.depth": "var(--depth) * 0.18",
        "position.0": "var(--width) * -0.13",
        "position.1": "var(--body-height) * 0.6 + 12",
        "position.2": "var(--depth) / 2 - 60",
      },
    ),
    box(
      "tray-grate-right",
      "接水盘右格栅",
      [width * 0.22, 7, depth * 0.18],
      [width * 0.13, bodyHeight * 0.6 + 12, front - 60],
      darkAppearance,
      3,
      {
        "parameters.width": "var(--width) * 0.22",
        "parameters.depth": "var(--depth) * 0.18",
        "position.0": "var(--width) * 0.13",
        "position.1": "var(--body-height) * 0.6 + 12",
        "position.2": "var(--depth) / 2 - 60",
      },
    ),
    box(
      "brand-strip",
      "品牌饰条",
      [width * 0.42, 14, 8],
      [0, bodyHeight * 0.985, front + 12],
      metalAppearance,
      4,
      {
        "parameters.width": "var(--width) * 0.42",
        "position.1": "var(--body-height) * 0.985",
        "position.2": "var(--depth) / 2 + 12",
      },
    ),
  ];

  const doorIds = new Set<string>(waterDispenserDoorFeatureIds);
  const tankIds = new Set<string>(waterDispenserTankFeatureIds);
  return {
    name: WATER_DISPENSER_DISPLAY_NAME,
    description: "下半部提供可开合储水柜与内置水桶，上部控制区显示运行状态并提供热水、常温水和冷水，接水区内嵌于机身。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [
        {
          id: "dispenser-body",
          name: "饮水机机身",
          featureIds: waterDispenserCoreFeatureIds.filter((id) => !doorIds.has(id) && !tankIds.has(id)),
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
        {
          id: "dispenser-door",
          name: "储水柜门",
          featureIds: [...waterDispenserDoorFeatureIds],
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
        {
          id: "dispenser-tank",
          name: "下置水桶组件",
          featureIds: [...waterDispenserTankFeatureIds],
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
      joints: [
        {
          id: "cabinet-door-hinge",
          name: "储水柜门铰链",
          type: "revolute",
          groupId: "dispenser-door",
          pivot: [doorHingeX, cabinetCenterY, doorZ],
          axis: [0, 1, 0],
          value: 0,
          restValue: 0,
          min: -105,
          max: 0,
        },
      ],
      poses: [
        { id: "cabinet-door-closed", name: "柜门关闭", durationMs: 420, jointValues: { "cabinet-door-hinge": 0 } },
        { id: "cabinet-door-open", name: "柜门打开", durationMs: 520, jointValues: { "cabinet-door-hinge": -72 } },
      ],
      variables: createVariables(parameters),
    },
  };
}
