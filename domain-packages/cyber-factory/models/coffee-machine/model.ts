import type {
  BoxFeature,
  CreateModelInput,
  CylinderFeature,
  FeatureAppearance,
  FeatureGroup,
  ModelFeature,
  Vector3Tuple,
} from "@solidloom/shared";

export type CoffeeMachineFinish = "graphite" | "porcelain" | "cobalt";

export interface CoffeeMachineParameters {
  depth: number;
  finish: CoffeeMachineFinish;
  height: number;
  width: number;
}

export const defaultCoffeeMachineParameters: CoffeeMachineParameters = {
  depth: 440,
  finish: "graphite",
  height: 520,
  width: 380,
};

export const coffeeMachineFeatureIds = {
  body: "coffee-machine-body",
  topCap: "coffee-machine-top-cap",
  frontPanel: "coffee-machine-front-panel",
  display: "coffee-machine-display",
  statusLight: "coffee-machine-status-light",
  brewButton: "coffee-machine-brew-button",
  steamButton: "coffee-machine-steam-button",
  brewHead: "coffee-machine-brew-head",
  brewCollar: "coffee-machine-brew-collar",
  spout: "coffee-machine-spout",
  tray: "coffee-machine-drip-tray",
  cupRing: "coffee-machine-cup-ring",
  waterTank: "coffee-machine-water-tank",
  waterWindow: "coffee-machine-water-window",
  waterTankLid: "coffee-machine-water-tank-lid",
  leftFoot: "coffee-machine-left-foot",
  rightFoot: "coffee-machine-right-foot",
  centerGrate: "coffee-machine-grate-center",
  leftGrate: "coffee-machine-grate-left",
  rightGrate: "coffee-machine-grate-right",
} as const;

export const coffeeMachineGroupIds = {
  body: "coffee-machine-body-group",
  brew: "coffee-machine-brew-group",
  control: "coffee-machine-control-group",
  feet: "coffee-machine-feet-group",
  tray: "coffee-machine-tray-group",
  waterTank: "coffee-machine-water-tank-group",
  waterTankLid: "coffee-machine-water-tank-lid-group",
} as const;

export const coffeeMachineJointIds = {
  waterTankLid: "coffee-machine-water-tank-lid-joint",
} as const;

const finishPalette: Record<CoffeeMachineFinish, {
  accent: string;
  body: string;
  panel: string;
}> = {
  graphite: { body: "#303941", panel: "#171D22", accent: "#58D7C5" },
  porcelain: { body: "#D8D5CC", panel: "#393D3F", accent: "#C9854B" },
  cobalt: { body: "#244F73", panel: "#142638", accent: "#78DBE8" },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function box(
  id: string,
  name: string,
  size: Vector3Tuple,
  position: Vector3Tuple,
  appearance: FeatureAppearance,
  cornerRadius = 0,
): BoxFeature {
  return {
    id,
    name,
    type: "box",
    operation: "add",
    position,
    rotation: [0, 0, 0],
    appearance,
    parameters: {
      width: size[0],
      height: size[1],
      depth: size[2],
      ...(cornerRadius > 0 ? { cornerRadius, cornerAlgorithm: "smooth" as const } : {}),
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
  rotation: Vector3Tuple = [0, 0, 0],
): CylinderFeature {
  return {
    id,
    name,
    type: "cylinder",
    operation: "add",
    position,
    rotation,
    appearance,
    parameters: { radius, height },
  };
}

function group(id: string, name: string, features: ModelFeature[]): FeatureGroup {
  return {
    id,
    name,
    featureIds: features.map((feature) => feature.id),
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  };
}

export function normalizeCoffeeMachineParameters(
  parameters: Partial<CoffeeMachineParameters> = {},
): CoffeeMachineParameters {
  return {
    width: clamp(parameters.width ?? defaultCoffeeMachineParameters.width, 320, 520),
    height: clamp(parameters.height ?? defaultCoffeeMachineParameters.height, 460, 680),
    depth: clamp(parameters.depth ?? defaultCoffeeMachineParameters.depth, 360, 560),
    finish: parameters.finish && parameters.finish in finishPalette
      ? parameters.finish
      : defaultCoffeeMachineParameters.finish,
  };
}

export function createCoffeeMachine(
  input: Partial<CoffeeMachineParameters> = {},
): CreateModelInput {
  const parameters = normalizeCoffeeMachineParameters(input);
  const { width, height, depth } = parameters;
  const colors = finishPalette[parameters.finish];
  const bodyAppearance = { material: "plastic" as const, color: colors.body };
  const panelAppearance = { material: "plastic" as const, color: colors.panel };
  const accentAppearance = { material: "plastic" as const, color: colors.accent };
  const metalAppearance = { material: "metal" as const, color: "#AAB4B9" };
  const darkMetalAppearance = { material: "metal" as const, color: "#4B565C" };
  const glassAppearance = { material: "glass" as const, color: "#79BFD2" };
  const rubberAppearance = { material: "rubber" as const, color: "#151A1D" };

  const footHeight = 24;
  const bodyHeight = height - footHeight;
  const frontZ = depth / 2;
  const panelWidth = width * 0.78;
  const trayWidth = width * 0.78;
  const trayDepth = depth * 0.38;
  const trayCenterZ = frontZ + trayDepth / 2 - 26;
  const trayY = footHeight + 40;
  const brewHeadY = height * 0.47;
  const controlY = height * 0.72;

  const body = [
    box(
      coffeeMachineFeatureIds.body,
      "咖啡机机身",
      [width, bodyHeight, depth],
      [0, footHeight + bodyHeight / 2, 0],
      bodyAppearance,
      Math.min(34, width * 0.08),
    ),
    box(
      coffeeMachineFeatureIds.topCap,
      "顶部饰盖",
      [width * 0.92, 22, depth * 0.88],
      [0, height - 15, 0],
      panelAppearance,
      10,
    ),
    box(
      coffeeMachineFeatureIds.frontPanel,
      "前控制面板",
      [panelWidth, height * 0.25, 18],
      [0, controlY, frontZ + 7],
      panelAppearance,
      12,
    ),
  ];

  const controls = [
    box(
      coffeeMachineFeatureIds.display,
      "状态显示屏",
      [panelWidth * 0.48, height * 0.075, 8],
      [0, controlY + height * 0.035, frontZ + 20],
      { material: "glass", color: "#123947" },
      5,
    ),
    cylinder(
      coffeeMachineFeatureIds.statusLight,
      "工作状态灯",
      8,
      7,
      [0, controlY + height * 0.086, frontZ + 24],
      accentAppearance,
      [90, 0, 0],
    ),
    cylinder(
      coffeeMachineFeatureIds.brewButton,
      "制作按钮",
      17,
      9,
      [-panelWidth * 0.31, controlY - height * 0.045, frontZ + 24],
      accentAppearance,
      [90, 0, 0],
    ),
    cylinder(
      coffeeMachineFeatureIds.steamButton,
      "蒸汽按钮",
      17,
      9,
      [panelWidth * 0.31, controlY - height * 0.045, frontZ + 24],
      metalAppearance,
      [90, 0, 0],
    ),
  ];

  const brew = [
    box(
      coffeeMachineFeatureIds.brewHead,
      "萃取头外壳",
      [width * 0.5, height * 0.115, depth * 0.22],
      [0, brewHeadY, frontZ + depth * 0.06],
      panelAppearance,
      16,
    ),
    cylinder(
      coffeeMachineFeatureIds.brewCollar,
      "萃取头金属环",
      width * 0.105,
      24,
      [0, brewHeadY - height * 0.065, frontZ + depth * 0.11],
      metalAppearance,
    ),
    cylinder(
      coffeeMachineFeatureIds.spout,
      "咖啡出液口",
      11,
      height * 0.09,
      [0, brewHeadY - height * 0.13, frontZ + depth * 0.11],
      darkMetalAppearance,
    ),
  ];

  const tray = [
    box(
      coffeeMachineFeatureIds.tray,
      "可拆卸滴水托盘",
      [trayWidth, 32, trayDepth],
      [0, trayY, trayCenterZ],
      darkMetalAppearance,
      12,
    ),
    cylinder(
      coffeeMachineFeatureIds.cupRing,
      "杯位定位环",
      Math.min(66, trayWidth * 0.2),
      5,
      [0, trayY + 19, trayCenterZ + trayDepth * 0.04],
      metalAppearance,
    ),
    box(
      coffeeMachineFeatureIds.centerGrate,
      "中央排水格栅",
      [18, 5, trayDepth * 0.72],
      [0, trayY + 18, trayCenterZ],
      rubberAppearance,
      2,
    ),
    box(
      coffeeMachineFeatureIds.leftGrate,
      "左侧排水格栅",
      [18, 5, trayDepth * 0.72],
      [-trayWidth * 0.22, trayY + 18, trayCenterZ],
      rubberAppearance,
      2,
    ),
    box(
      coffeeMachineFeatureIds.rightGrate,
      "右侧排水格栅",
      [18, 5, trayDepth * 0.72],
      [trayWidth * 0.22, trayY + 18, trayCenterZ],
      rubberAppearance,
      2,
    ),
  ];

  const tankWidth = width * 0.68;
  const tankDepth = depth * 0.27;
  const tankCenterZ = -depth / 2 + tankDepth / 2 + 18;
  const waterTank = [
    box(
      coffeeMachineFeatureIds.waterTank,
      "后置水箱",
      [tankWidth, height * 0.54, tankDepth],
      [0, footHeight + height * 0.36, tankCenterZ],
      glassAppearance,
      14,
    ),
    box(
      coffeeMachineFeatureIds.waterWindow,
      "水位观察窗",
      [tankWidth * 0.52, height * 0.32, 6],
      [0, footHeight + height * 0.38, -depth / 2 - 3],
      { material: "glass", color: "#9BE1ED" },
      6,
    ),
  ];
  const waterTankLid = [
    box(
      coffeeMachineFeatureIds.waterTankLid,
      "水箱翻盖",
      [tankWidth + 16, 18, tankDepth + 16],
      [0, height - 28, tankCenterZ],
      bodyAppearance,
      8,
    ),
  ];

  const feet = [
    box(
      coffeeMachineFeatureIds.leftFoot,
      "左防滑脚垫",
      [width * 0.28, footHeight, depth * 0.58],
      [-width * 0.27, footHeight / 2, -depth * 0.06],
      rubberAppearance,
      7,
    ),
    box(
      coffeeMachineFeatureIds.rightFoot,
      "右防滑脚垫",
      [width * 0.28, footHeight, depth * 0.58],
      [width * 0.27, footHeight / 2, -depth * 0.06],
      rubberAppearance,
      7,
    ),
  ];

  const features = [...body, ...controls, ...brew, ...tray, ...waterTank, ...waterTankLid, ...feet];
  const groups = [
    group(coffeeMachineGroupIds.body, "机身", body),
    group(coffeeMachineGroupIds.control, "控制区", controls),
    group(coffeeMachineGroupIds.brew, "萃取组件", brew),
    group(coffeeMachineGroupIds.tray, "托盘组件", tray),
    group(coffeeMachineGroupIds.waterTank, "水箱", waterTank),
    group(coffeeMachineGroupIds.waterTankLid, "水箱翻盖", waterTankLid),
    group(coffeeMachineGroupIds.feet, "防滑脚垫", feet),
  ];

  return {
    name: "参数化咖啡机",
    description: "带后置透明水箱、独立控制区、萃取头和滴水托盘的紧凑咖啡机。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups,
      joints: [{
        id: coffeeMachineJointIds.waterTankLid,
        name: "水箱翻盖铰链",
        type: "revolute",
        groupId: coffeeMachineGroupIds.waterTankLid,
        pivot: [0, height - 35, tankCenterZ - tankDepth / 2],
        axis: [1, 0, 0],
        value: 0,
        restValue: 0,
        min: 0,
        max: 78,
      }],
      variables: [
        { id: "coffee-machine-width", label: "宽度", value: width, unit: "mm" },
        { id: "coffee-machine-height", label: "高度", value: height, unit: "mm" },
        { id: "coffee-machine-depth", label: "深度", value: depth, unit: "mm" },
      ],
    },
  };
}
