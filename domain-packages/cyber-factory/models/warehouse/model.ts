import type {
  BoxFeature,
  CreateModelInput,
  CylinderFeature,
  FeatureAppearance,
  FeatureGroup,
  ModelFeature,
  ModelVariable,
  Vector3Tuple,
} from "@solidloom/shared";

export interface WarehouseRackParameters {
  bayCount: number;
  levelCount: number;
  bayWidth: number;
  height: number;
  depth: number;
}

export interface WarehousePalletParameters {
  width: number;
  depth: number;
  height: number;
}

export interface WarehouseToteParameters {
  width: number;
  depth: number;
  height: number;
}

export interface WarehouseCartParameters {
  width: number;
  depth: number;
  deckHeight: number;
  handleHeight: number;
}

export interface WarehouseStackerCraneParameters {
  railLength: number;
  mastHeight: number;
  carriageWidth: number;
  carriageDepth: number;
  forkReach: number;
}

export interface WarehouseStackerCranePose {
  travelX: number;
  liftY: number;
  forkExtension: number;
}

export interface WarehouseRetrievalStep {
  id: "reserve" | "travel" | "lift" | "extend" | "capture" | "retract" | "lower" | "deliver" | "release";
  label: string;
  durationMs: number;
  pose: WarehouseStackerCranePose;
  plannedActions?: WarehousePlannedAction[];
}

export type WarehousePlannedAction = (
  "reserve-slot"
  | "attach-cargo"
  | "detach-cargo"
  | "release-slot"
  | "occupy-slot"
);

export interface WarehouseRestockStep {
  id: "reserve" | "attach" | "travel" | "lift" | "extend" | "place" | "release" | "retract" | "lower" | "return";
  label: string;
  durationMs: number;
  pose: WarehouseStackerCranePose;
  plannedActions?: WarehousePlannedAction[];
}

export type WarehouseRetrievalPlan = {
  valid: true;
  slotId: string;
  bayIndex: number;
  levelIndex: number;
  targetPose: WarehouseStackerCranePose;
  steps: WarehouseRetrievalStep[];
} | {
  valid: false;
  slotId: string;
  code: "invalid-slot-id" | "slot-out-of-range" | "insufficient-rail-travel" | "insufficient-fork-reach";
  message: string;
};

export type WarehouseRestockPlan = {
  valid: true;
  slotId: string;
  bayIndex: number;
  levelIndex: number;
  targetPose: WarehouseStackerCranePose;
  steps: WarehouseRestockStep[];
} | {
  valid: false;
  slotId: string;
  code: "invalid-slot-id" | "slot-out-of-range" | "insufficient-rail-travel" | "insufficient-fork-reach";
  message: string;
};

const warehouseStackerTravelBaseDepthScale = 1.18;
const warehouseStackerTravelEndClearance = 180;
const warehouseStackerForkBackClearance = 30;
const warehouseStackerForkCargoOvertravel = 30;

export const defaultWarehouseRackParameters: WarehouseRackParameters = {
  bayCount: 3,
  levelCount: 4,
  bayWidth: 1_100,
  height: 2_600,
  depth: 900,
};

export const defaultWarehousePalletParameters: WarehousePalletParameters = {
  width: 1_000,
  depth: 800,
  height: 144,
};

export const defaultWarehouseToteParameters: WarehouseToteParameters = {
  width: 600,
  depth: 420,
  height: 360,
};

export const defaultWarehouseCartParameters: WarehouseCartParameters = {
  width: 850,
  depth: 1_180,
  deckHeight: 310,
  handleHeight: 1_080,
};

export const defaultWarehouseStackerCraneParameters: WarehouseStackerCraneParameters = {
  railLength: defaultWarehouseRackParameters.bayCount * defaultWarehouseRackParameters.bayWidth + 500,
  mastHeight: defaultWarehouseRackParameters.height,
  carriageWidth: 1_160,
  carriageDepth: 900,
  forkReach: 1_000,
};

export const defaultWarehouseStackerCranePose: WarehouseStackerCranePose = {
  travelX: -(
    defaultWarehouseStackerCraneParameters.railLength / 2
    - defaultWarehouseStackerCraneParameters.carriageWidth / 2
    - warehouseStackerTravelEndClearance
  ),
  liftY: 320,
  forkExtension: 0,
};

export const warehouseGroupIds = {
  rackStructure: "warehouse-rack-structure-group",
  rackStorage: "warehouse-rack-storage-group",
  rackDetail: "warehouse-rack-detail-group",
  pallet: "warehouse-pallet-group",
  tote: "warehouse-tote-group",
  cartFrame: "warehouse-cart-frame-group",
  cartWheels: "warehouse-cart-wheels-group",
  stackerRails: "warehouse-stacker-rails-group",
  stackerTravelFrame: "warehouse-stacker-travel-frame-group",
  stackerCarriage: "warehouse-stacker-carriage-group",
  stackerForks: "warehouse-stacker-forks-group",
} as const;

const metalAppearance: FeatureAppearance = { material: "metal", color: "#71858E" };
const shelfAppearance: FeatureAppearance = { material: "metal", color: "#B9C7CC" };
const woodAppearance: FeatureAppearance = { material: "wood", color: "#C99861" };
const plasticAppearance: FeatureAppearance = { material: "plastic", color: "#45A8BF" };
const toteRimAppearance: FeatureAppearance = { material: "plastic", color: "#236A7C" };
const cartAppearance: FeatureAppearance = { material: "metal", color: "#82959C" };
const cartDeckAppearance: FeatureAppearance = { material: "metal", color: "#C4D0D3" };
const rubberAppearance: FeatureAppearance = { material: "rubber", color: "#20282C" };
const stackerFrameAppearance: FeatureAppearance = { material: "metal", color: "#E3A62F" };
const stackerCarriageAppearance: FeatureAppearance = { material: "metal", color: "#D6E0E2" };
const stackerForkAppearance: FeatureAppearance = { material: "metal", color: "#5BC6B5" };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function integerAtLeast(value: number, minimum: number) {
  return Math.max(minimum, Math.round(Number.isFinite(value) ? value : minimum));
}

function box(
  id: string,
  name: string,
  size: Vector3Tuple,
  position: Vector3Tuple,
  appearance: FeatureAppearance,
  cornerRadius = 0,
  rotation: Vector3Tuple = [0, 0, 0],
): BoxFeature {
  return {
    id,
    name,
    type: "box",
    operation: "add",
    position,
    rotation,
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

function variables(values: Array<[string, string, number]>): ModelVariable[] {
  return values.map(([id, label, value]) => ({ id, label, value, unit: "mm" }));
}

export function normalizeWarehouseRackParameters(
  input: Partial<WarehouseRackParameters> = {},
): WarehouseRackParameters {
  return {
    bayCount: integerAtLeast(input.bayCount ?? defaultWarehouseRackParameters.bayCount, 1),
    levelCount: integerAtLeast(input.levelCount ?? defaultWarehouseRackParameters.levelCount, 2),
    bayWidth: clamp(input.bayWidth ?? defaultWarehouseRackParameters.bayWidth, 800, 1_400),
    height: clamp(input.height ?? defaultWarehouseRackParameters.height, 1_800, 3_600),
    depth: clamp(input.depth ?? defaultWarehouseRackParameters.depth, 600, 1_200),
  };
}

export function warehouseRackShelfY(parameters: WarehouseRackParameters, levelIndex: number) {
  const bottom = 220;
  const top = parameters.height - 180;
  if (parameters.levelCount === 1) return bottom;
  return bottom + (top - bottom) * (levelIndex / (parameters.levelCount - 1));
}

export function warehouseRackBayX(parameters: WarehouseRackParameters, bayIndex: number) {
  return -parameters.bayCount * parameters.bayWidth / 2 + parameters.bayWidth * (bayIndex + 0.5);
}

export function createWarehouseRack(
  input: Partial<WarehouseRackParameters> = {},
): CreateModelInput {
  const parameters = normalizeWarehouseRackParameters(input);
  const totalWidth = parameters.bayCount * parameters.bayWidth;
  const postSize = 72;
  const structure: ModelFeature[] = [];
  const shelves: ModelFeature[] = [];
  const details: ModelFeature[] = [];

  for (let column = 0; column <= parameters.bayCount; column += 1) {
    const x = -totalWidth / 2 + column * parameters.bayWidth;
    for (const side of ["front", "back"] as const) {
      const z = side === "front" ? parameters.depth / 2 - postSize / 2 : -parameters.depth / 2 + postSize / 2;
      structure.push(box(
        `warehouse-rack-upright-${String(column + 1).padStart(2, "0")}-${side}`,
        `第 ${column + 1} 列${side === "front" ? "前" : "后"}立柱`,
        [postSize, parameters.height, postSize],
        [x, parameters.height / 2, z],
        metalAppearance,
        6,
      ));
    }
  }

  for (let bay = 0; bay < parameters.bayCount; bay += 1) {
    for (let level = 0; level < parameters.levelCount; level += 1) {
      shelves.push(box(
        `warehouse-rack-shelf-b${String(bay + 1).padStart(2, "0")}-l${String(level + 1).padStart(2, "0")}`,
        `第 ${bay + 1} 跨第 ${level + 1} 层货板`,
        [parameters.bayWidth - postSize - 26, 44, parameters.depth - postSize - 34],
        [warehouseRackBayX(parameters, bay), warehouseRackShelfY(parameters, level), 0],
        shelfAppearance,
        5,
      ));
    }
  }

  for (let level = 0; level < parameters.levelCount; level += 1) {
    const shelfY = warehouseRackShelfY(parameters, level);
    for (const side of ["front", "back"] as const) {
      structure.push(box(
        `warehouse-rack-level-beam-${side}-l${String(level + 1).padStart(2, "0")}`,
        `第 ${level + 1} 层${side === "front" ? "前" : "后"}承重横梁`,
        [totalWidth + postSize, 72, 48],
        [0, shelfY - 14, side === "front" ? parameters.depth / 2 - 28 : -parameters.depth / 2 + 28],
        metalAppearance,
        5,
      ));
    }
  }

  const braceLength = Math.hypot(totalWidth, parameters.height - 260);
  const braceAngle = Math.atan2(parameters.height - 260, totalWidth) * 180 / Math.PI;
  details.push(
    box("warehouse-rack-back-brace-up", "后侧上行斜撑", [braceLength, 38, 28], [0, parameters.height / 2, -parameters.depth / 2 + 54], metalAppearance, 3, [0, 0, braceAngle]),
    box("warehouse-rack-back-brace-down", "后侧下行斜撑", [braceLength, 38, 28], [0, parameters.height / 2, -parameters.depth / 2 + 82], metalAppearance, 3, [0, 0, -braceAngle]),
  );

  return {
    name: "参数化仓储货架",
    description: "可按跨数、层数和尺寸生成稳定货位的仓储货架。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [...structure, ...shelves, ...details],
      groups: [
        group(warehouseGroupIds.rackStructure, "货架结构", structure),
        group(warehouseGroupIds.rackStorage, "货位层板", shelves),
        group(warehouseGroupIds.rackDetail, "货架斜撑", details),
      ],
      variables: variables([
        ["--bay-width", "单跨宽度", parameters.bayWidth],
        ["--height", "货架高度", parameters.height],
        ["--depth", "货架深度", parameters.depth],
      ]),
    },
  };
}

export function normalizeWarehousePalletParameters(
  input: Partial<WarehousePalletParameters> = {},
): WarehousePalletParameters {
  return {
    width: clamp(input.width ?? defaultWarehousePalletParameters.width, 800, 1_300),
    depth: clamp(input.depth ?? defaultWarehousePalletParameters.depth, 600, 1_200),
    height: clamp(input.height ?? defaultWarehousePalletParameters.height, 110, 190),
  };
}

export function createWarehousePallet(
  input: Partial<WarehousePalletParameters> = {},
): CreateModelInput {
  const parameters = normalizeWarehousePalletParameters(input);
  const features: ModelFeature[] = [];
  const runnerHeight = parameters.height * 0.54;
  [-0.4, 0, 0.4].forEach((ratio, index) => features.push(box(
    `warehouse-pallet-runner-${String(index + 1).padStart(2, "0")}`,
    `第 ${index + 1} 条承重梁`,
    [82, runnerHeight, parameters.depth],
    [parameters.width * ratio, runnerHeight / 2, 0],
    woodAppearance,
    5,
  )));
  const boardCount = 7;
  const boardWidth = (parameters.width - 72) / boardCount;
  for (let index = 0; index < boardCount; index += 1) {
    const x = -parameters.width / 2 + 36 + boardWidth / 2 + index * boardWidth;
    features.push(box(
      `warehouse-pallet-top-board-${String(index + 1).padStart(2, "0")}`,
      `第 ${index + 1} 块顶板`,
      [boardWidth - 12, parameters.height - runnerHeight, parameters.depth],
      [x, runnerHeight + (parameters.height - runnerHeight) / 2, 0],
      woodAppearance,
      4,
    ));
  }
  return {
    name: "参数化仓储托盘",
    description: "保留前后叉车入口和顶部装载面的木质托盘。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [group(warehouseGroupIds.pallet, "托盘结构", features)],
      variables: variables([
        ["--width", "托盘宽度", parameters.width],
        ["--depth", "托盘深度", parameters.depth],
        ["--height", "托盘高度", parameters.height],
      ]),
    },
  };
}

export function normalizeWarehouseToteParameters(
  input: Partial<WarehouseToteParameters> = {},
): WarehouseToteParameters {
  return {
    width: clamp(input.width ?? defaultWarehouseToteParameters.width, 400, 800),
    depth: clamp(input.depth ?? defaultWarehouseToteParameters.depth, 300, 600),
    height: clamp(input.height ?? defaultWarehouseToteParameters.height, 240, 520),
  };
}

export function createWarehouseTote(
  input: Partial<WarehouseToteParameters> = {},
): CreateModelInput {
  const parameters = normalizeWarehouseToteParameters(input);
  const wall = 28;
  const base = 30;
  const wallHeight = parameters.height - base;
  const features: ModelFeature[] = [
    box("warehouse-tote-base", "周转箱底板", [parameters.width, base, parameters.depth], [0, base / 2, 0], plasticAppearance, 12),
    box("warehouse-tote-left-wall", "周转箱左壁", [wall, wallHeight, parameters.depth], [-parameters.width / 2 + wall / 2, base + wallHeight / 2, 0], plasticAppearance, 10),
    box("warehouse-tote-right-wall", "周转箱右壁", [wall, wallHeight, parameters.depth], [parameters.width / 2 - wall / 2, base + wallHeight / 2, 0], plasticAppearance, 10),
    box("warehouse-tote-front-wall", "周转箱前壁", [parameters.width - wall * 2, wallHeight, wall], [0, base + wallHeight / 2, parameters.depth / 2 - wall / 2], plasticAppearance, 10),
    box("warehouse-tote-back-wall", "周转箱后壁", [parameters.width - wall * 2, wallHeight, wall], [0, base + wallHeight / 2, -parameters.depth / 2 + wall / 2], plasticAppearance, 10),
    box("warehouse-tote-left-grip", "左侧搬运握边", [72, 34, parameters.depth + 30], [-parameters.width / 2 - 8, parameters.height - 30, 0], toteRimAppearance, 10),
    box("warehouse-tote-right-grip", "右侧搬运握边", [72, 34, parameters.depth + 30], [parameters.width / 2 + 8, parameters.height - 30, 0], toteRimAppearance, 10),
  ];
  return {
    name: "参数化仓储周转箱",
    description: "带开放内腔和两侧搬运握边的塑料周转箱。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [group(warehouseGroupIds.tote, "周转箱结构", features)],
      variables: variables([
        ["--width", "周转箱宽度", parameters.width],
        ["--depth", "周转箱深度", parameters.depth],
        ["--height", "周转箱高度", parameters.height],
      ]),
    },
  };
}

export function normalizeWarehouseCartParameters(
  input: Partial<WarehouseCartParameters> = {},
): WarehouseCartParameters {
  const deckHeight = clamp(input.deckHeight ?? defaultWarehouseCartParameters.deckHeight, 240, 460);
  return {
    width: clamp(input.width ?? defaultWarehouseCartParameters.width, 650, 1_100),
    depth: clamp(input.depth ?? defaultWarehouseCartParameters.depth, 900, 1_500),
    deckHeight,
    handleHeight: clamp(input.handleHeight ?? defaultWarehouseCartParameters.handleHeight, deckHeight + 480, 1_400),
  };
}

export function createWarehouseCart(
  input: Partial<WarehouseCartParameters> = {},
): CreateModelInput {
  const parameters = normalizeWarehouseCartParameters(input);
  const wheelRadius = 82;
  const deckThickness = 72;
  const lowerDeckCenterY = 145;
  const lowerDeckThickness = 48;
  const lowerDeckTop = lowerDeckCenterY + lowerDeckThickness / 2;
  const mainDeckBottom = parameters.deckHeight - deckThickness / 2;
  const supportHeight = mainDeckBottom - lowerDeckTop;
  const supportY = lowerDeckTop + supportHeight / 2;
  const handleZ = -parameters.depth / 2 + 42;
  const postHeight = parameters.handleHeight - parameters.deckHeight;
  const frame: ModelFeature[] = [
    box("warehouse-cart-main-deck", "推车主承载台", [parameters.width, deckThickness, parameters.depth], [0, parameters.deckHeight, 0], cartDeckAppearance, 18),
    box("warehouse-cart-lower-deck", "推车下层承载台", [parameters.width * 0.88, lowerDeckThickness, parameters.depth * 0.78], [0, lowerDeckCenterY, 30], cartAppearance, 12),
    box("warehouse-cart-left-handle-post", "推车左把手立柱", [46, postHeight, 46], [-parameters.width * 0.4, parameters.deckHeight + postHeight / 2, handleZ], cartAppearance, 8),
    box("warehouse-cart-right-handle-post", "推车右把手立柱", [46, postHeight, 46], [parameters.width * 0.4, parameters.deckHeight + postHeight / 2, handleZ], cartAppearance, 8),
    box("warehouse-cart-handle-bar", "推车横向把手", [parameters.width * 0.86, 54, 54], [0, parameters.handleHeight, handleZ], cartAppearance, 14),
  ];
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      frame.push(box(
        `warehouse-cart-support-${xSign < 0 ? "left" : "right"}-${zSign < 0 ? "rear" : "front"}`,
        `${xSign < 0 ? "左" : "右"}${zSign < 0 ? "后" : "前"}承重支架`,
        [42, supportHeight, 42],
        [
          xSign * (parameters.width * 0.44 - 60),
          supportY,
          30 + zSign * (parameters.depth * 0.39 - 60),
        ],
        cartAppearance,
        6,
      ));
    }
  }
  const wheels: ModelFeature[] = [];
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      wheels.push(cylinder(
        `warehouse-cart-wheel-${xSign < 0 ? "left" : "right"}-${zSign < 0 ? "rear" : "front"}`,
        `${xSign < 0 ? "左" : "右"}${zSign < 0 ? "后" : "前"}轮`,
        wheelRadius,
        48,
        [xSign * (parameters.width / 2 - 88), wheelRadius, zSign * (parameters.depth / 2 - 130)],
        rubberAppearance,
        [0, 0, 90],
      ));
    }
  }
  return {
    name: "参数化仓储推车",
    description: "带双层承载台、推行把手和四轮的内部物流推车。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [...frame, ...wheels],
      groups: [
        group(warehouseGroupIds.cartFrame, "推车车架", frame),
        group(warehouseGroupIds.cartWheels, "推车车轮", wheels),
      ],
      variables: variables([
        ["--width", "推车宽度", parameters.width],
        ["--depth", "推车深度", parameters.depth],
        ["--deck-height", "承载台高度", parameters.deckHeight],
        ["--handle-height", "把手高度", parameters.handleHeight],
      ]),
    },
  };
}

export function normalizeWarehouseStackerCraneParameters(
  input: Partial<WarehouseStackerCraneParameters> = {},
): WarehouseStackerCraneParameters {
  return {
    railLength: clamp(input.railLength ?? defaultWarehouseStackerCraneParameters.railLength, 3_500, 30_000),
    mastHeight: clamp(input.mastHeight ?? defaultWarehouseStackerCraneParameters.mastHeight, 2_400, 8_000),
    carriageWidth: clamp(input.carriageWidth ?? defaultWarehouseStackerCraneParameters.carriageWidth, 1_120, 1_600),
    carriageDepth: clamp(input.carriageDepth ?? defaultWarehouseStackerCraneParameters.carriageDepth, 850, 1_400),
    forkReach: clamp(input.forkReach ?? defaultWarehouseStackerCraneParameters.forkReach, 400, 2_400),
  };
}

export function warehouseStackerMaximumTravel(
  input: Partial<WarehouseStackerCraneParameters> = {},
) {
  const parameters = normalizeWarehouseStackerCraneParameters(input);
  return Math.max(
    0,
    parameters.railLength / 2 - parameters.carriageWidth / 2 - warehouseStackerTravelEndClearance,
  );
}

export function warehouseStackerRackAssemblyZ(
  rackInput: Partial<WarehouseRackParameters> = {},
  craneInput: Partial<WarehouseStackerCraneParameters> = {},
) {
  const rack = normalizeWarehouseRackParameters(rackInput);
  const crane = normalizeWarehouseStackerCraneParameters(craneInput);
  return -(rack.depth / 2 + crane.carriageDepth * warehouseStackerTravelBaseDepthScale / 2);
}

export function normalizeWarehouseStackerCranePose(
  parameters: WarehouseStackerCraneParameters,
  input: Partial<WarehouseStackerCranePose> = {},
): WarehouseStackerCranePose {
  const maximumTravel = warehouseStackerMaximumTravel(parameters);
  return {
    travelX: clamp(input.travelX ?? -maximumTravel, -maximumTravel, maximumTravel),
    liftY: clamp(input.liftY ?? defaultWarehouseStackerCranePose.liftY, 260, parameters.mastHeight - 100),
    forkExtension: clamp(input.forkExtension ?? defaultWarehouseStackerCranePose.forkExtension, 0, parameters.forkReach),
  };
}

export function createWarehouseStackerCrane(
  input: Partial<WarehouseStackerCraneParameters> = {},
  poseInput: Partial<WarehouseStackerCranePose> = {},
): CreateModelInput {
  const parameters = normalizeWarehouseStackerCraneParameters(input);
  const pose = normalizeWarehouseStackerCranePose(parameters, poseInput);
  const railOffsetZ = parameters.carriageDepth * 0.52;
  const mastZ = -parameters.carriageDepth * 0.58;
  const mastBottom = 230;
  const railFeatures: ModelFeature[] = [
    box("warehouse-stacker-left-rail", "堆垛机左轨", [parameters.railLength, 72, 96], [0, 36, -railOffsetZ], metalAppearance, 12),
    box("warehouse-stacker-right-rail", "堆垛机右轨", [parameters.railLength, 72, 96], [0, 36, railOffsetZ], metalAppearance, 12),
    box("warehouse-stacker-left-end-stop", "左端限位器", [120, 190, parameters.carriageDepth * warehouseStackerTravelBaseDepthScale], [-parameters.railLength / 2 + 60, 95, 0], stackerFrameAppearance, 18),
    box("warehouse-stacker-right-end-stop", "右端限位器", [120, 190, parameters.carriageDepth * warehouseStackerTravelBaseDepthScale], [parameters.railLength / 2 - 60, 95, 0], stackerFrameAppearance, 18),
  ];
  const travelFeatures: ModelFeature[] = [
    box("warehouse-stacker-travel-base", "紧凑型行走底座", [parameters.carriageWidth + 160, 150, parameters.carriageDepth * warehouseStackerTravelBaseDepthScale], [pose.travelX, 140, 0], stackerFrameAppearance, 24),
    box("warehouse-stacker-single-mast", "堆垛机单立柱", [150, parameters.mastHeight, 180], [pose.travelX, mastBottom + parameters.mastHeight / 2, mastZ], stackerFrameAppearance, 14),
    box("warehouse-stacker-mast-guide", "单立柱升降导轨", [58, parameters.mastHeight - 220, 34], [pose.travelX, mastBottom + parameters.mastHeight / 2 - 40, mastZ + 107], metalAppearance, 10),
    box("warehouse-stacker-mast-cap", "单立柱顶帽", [280, 100, 210], [pose.travelX, mastBottom + parameters.mastHeight, mastZ], stackerFrameAppearance, 14),
    box("warehouse-stacker-control-cabinet", "紧凑型控制柜", [240, 560, 260], [pose.travelX - parameters.carriageWidth * 0.34, 500, -parameters.carriageDepth * 0.46], stackerCarriageAppearance, 18),
  ];
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      travelFeatures.push(cylinder(
        `warehouse-stacker-wheel-${xSign < 0 ? "left" : "right"}-${zSign < 0 ? "rear" : "front"}`,
        `${xSign < 0 ? "左" : "右"}${zSign < 0 ? "后" : "前"}行走轮`,
        112,
        64,
        [pose.travelX + xSign * parameters.carriageWidth * 0.4, 104, zSign * railOffsetZ],
        rubberAppearance,
        [90, 0, 0],
      ));
    }
  }
  const carriageFeatures: ModelFeature[] = [
    box("warehouse-stacker-carriage-deck", "升降载货台", [parameters.carriageWidth, 110, parameters.carriageDepth], [pose.travelX, pose.liftY - 86, 0], stackerCarriageAppearance, 18),
    box("warehouse-stacker-carriage-back", "载货台背板", [parameters.carriageWidth, 540, 72], [pose.travelX, pose.liftY + 150, -parameters.carriageDepth / 2 + 36], stackerFrameAppearance, 12),
    box("warehouse-stacker-carriage-left-guard", "载货台左护栏", [54, 330, parameters.carriageDepth], [pose.travelX - parameters.carriageWidth / 2 + 27, pose.liftY + 75, 0], stackerFrameAppearance, 10),
    box("warehouse-stacker-carriage-right-guard", "载货台右护栏", [54, 330, parameters.carriageDepth], [pose.travelX + parameters.carriageWidth / 2 - 27, pose.liftY + 75, 0], stackerFrameAppearance, 10),
  ];
  const forkLength = parameters.carriageDepth + pose.forkExtension - 80;
  const forkZ = pose.forkExtension / 2 + 40;
  const forkOffsetX = parameters.carriageWidth * 0.23;
  const forkFeatures: ModelFeature[] = [
    box("warehouse-stacker-left-fork", "左伸缩货叉", [94, 58, forkLength], [pose.travelX - forkOffsetX, pose.liftY, forkZ], stackerForkAppearance, 10),
    box("warehouse-stacker-right-fork", "右伸缩货叉", [94, 58, forkLength], [pose.travelX + forkOffsetX, pose.liftY, forkZ], stackerForkAppearance, 10),
    box("warehouse-stacker-fork-crosshead", "载货台内固定货叉横梁", [parameters.carriageWidth * 0.72, 90, 120], [pose.travelX, pose.liftY + 12, -parameters.carriageDepth / 2 + 140], stackerForkAppearance, 12),
  ];
  return {
    name: "参数化巷道堆垛机",
    description: "采用紧凑单立柱、沿短轨横移并伸缩货叉的参数化自动仓储取放设备。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [...railFeatures, ...travelFeatures, ...carriageFeatures, ...forkFeatures],
      groups: [
        group(warehouseGroupIds.stackerRails, "固定轨道", railFeatures),
        group(warehouseGroupIds.stackerTravelFrame, "横移机架", travelFeatures),
        group(warehouseGroupIds.stackerCarriage, "升降载货台", carriageFeatures),
        group(warehouseGroupIds.stackerForks, "伸缩货叉", forkFeatures),
      ],
      variables: variables([
        ["--rail-length", "轨道长度", parameters.railLength],
        ["--mast-height", "立柱高度", parameters.mastHeight],
        ["--carriage-width", "载货台宽度", parameters.carriageWidth],
        ["--carriage-depth", "载货台深度", parameters.carriageDepth],
        ["--fork-reach", "货叉行程", parameters.forkReach],
        ["--travel-x", "横移位置", pose.travelX],
        ["--lift-y", "升降位置", pose.liftY],
        ["--fork-extension", "货叉伸出量", pose.forkExtension],
      ]),
    },
  };
}

export function parseWarehouseRackSlotId(slotId: string) {
  const match = /^warehouse-rack-slot-b(0*[1-9][0-9]*)-l(0*[1-9][0-9]*)$/.exec(slotId);
  if (!match) return null;
  return { bayIndex: Number(match[1]) - 1, levelIndex: Number(match[2]) - 1 };
}

export function planWarehouseRetrieval(
  slotId: string,
  rackInput: Partial<WarehouseRackParameters> = {},
  craneInput: Partial<WarehouseStackerCraneParameters> = {},
): WarehouseRetrievalPlan {
  const slot = parseWarehouseRackSlotId(slotId);
  if (!slot) return { valid: false, slotId, code: "invalid-slot-id", message: "格口 ID 格式无效。" };
  const rack = normalizeWarehouseRackParameters(rackInput);
  const crane = normalizeWarehouseStackerCraneParameters(craneInput);
  if (slot.bayIndex >= rack.bayCount || slot.levelIndex >= rack.levelCount) {
    return { valid: false, slotId, code: "slot-out-of-range", message: "目标格口不在当前货架参数范围内。" };
  }
  const rackAssemblyZ = warehouseStackerRackAssemblyZ(rack, crane);
  const forkInsertionFromCargoCenter = Math.min(
    defaultWarehousePalletParameters.depth / 2 + warehouseStackerForkCargoOvertravel,
    rack.depth / 2 - warehouseStackerForkBackClearance,
  );
  const requiredForkExtension = (
    Math.abs(rackAssemblyZ)
    + forkInsertionFromCargoCenter
    - crane.carriageDepth / 2
  );
  if (requiredForkExtension > crane.forkReach) {
    return { valid: false, slotId, code: "insufficient-fork-reach", message: "货叉行程不足，无法到达目标货位。" };
  }
  const targetTravelX = warehouseRackBayX(rack, slot.bayIndex);
  const maximumTravel = warehouseStackerMaximumTravel(crane);
  if (Math.abs(targetTravelX) > maximumTravel) {
    return { valid: false, slotId, code: "insufficient-rail-travel", message: "轨道行程不足，无法横移到目标货位。" };
  }
  const home = normalizeWarehouseStackerCranePose(crane);
  const insertionLiftY = warehouseRackShelfY(rack, slot.levelIndex) + 52;
  const targetPose = normalizeWarehouseStackerCranePose(crane, {
    travelX: targetTravelX,
    liftY: insertionLiftY + 20,
    forkExtension: requiredForkExtension,
  });
  const travelPose = { ...home, travelX: targetPose.travelX };
  const liftedPose = { ...travelPose, liftY: insertionLiftY };
  const extendedPose = { ...liftedPose, forkExtension: targetPose.forkExtension };
  const capturedPose = { ...targetPose };
  const retractedPose = { ...targetPose, forkExtension: 0 };
  const loweredPose = { ...retractedPose, liftY: home.liftY };
  const outboundPose = { ...home, travelX: -maximumTravel };
  return {
    valid: true,
    slotId,
    bayIndex: slot.bayIndex,
    levelIndex: slot.levelIndex,
    targetPose,
    steps: [
      { id: "reserve", label: "预占目标货位", durationMs: 450, pose: home, plannedActions: ["reserve-slot"] },
      { id: "travel", label: "横移到目标跨", durationMs: 1_200, pose: travelPose },
      { id: "lift", label: "升降到目标层", durationMs: 1_100, pose: liftedPose },
      { id: "extend", label: "货叉伸至托盘远端", durationMs: 1_050, pose: extendedPose },
      { id: "capture", label: "挂接目标货物", durationMs: 450, pose: capturedPose, plannedActions: ["attach-cargo"] },
      { id: "retract", label: "收回货叉", durationMs: 850, pose: retractedPose },
      { id: "lower", label: "下降到出库高度", durationMs: 1_100, pose: loweredPose },
      { id: "deliver", label: "横移到左侧出库位", durationMs: 1_200, pose: outboundPose },
      { id: "release", label: "在载货台内释放货物与货位", durationMs: 450, pose: outboundPose, plannedActions: ["detach-cargo", "release-slot"] },
    ],
  };
}

export function planWarehouseRestock(
  slotId: string,
  rackInput: Partial<WarehouseRackParameters> = {},
  craneInput: Partial<WarehouseStackerCraneParameters> = {},
): WarehouseRestockPlan {
  const retrieval = planWarehouseRetrieval(slotId, rackInput, craneInput);
  if (!retrieval.valid) return retrieval;

  const home = { ...retrieval.steps[0]!.pose };
  const targetPose = { ...retrieval.targetPose };
  const travelPose = { ...home, travelX: targetPose.travelX };
  const liftedPose = { ...travelPose, liftY: targetPose.liftY };
  const extendedPose = { ...targetPose };
  const placedPose = {
    ...retrieval.steps.find(({ id }) => id === "extend")!.pose,
  };
  const retractedPose = { ...placedPose, forkExtension: 0 };
  const loweredPose = { ...retractedPose, liftY: home.liftY };

  return {
    valid: true,
    slotId,
    bayIndex: retrieval.bayIndex,
    levelIndex: retrieval.levelIndex,
    targetPose,
    steps: [
      { id: "reserve", label: "预占上货目标货位", durationMs: 450, pose: home, plannedActions: ["reserve-slot"] },
      { id: "attach", label: "挂接左侧上货托盘", durationMs: 450, pose: home, plannedActions: ["attach-cargo"] },
      { id: "travel", label: "携货横移到目标跨", durationMs: 1_200, pose: travelPose },
      { id: "lift", label: "携货升至目标层上方", durationMs: 1_100, pose: liftedPose },
      { id: "extend", label: "货叉携货伸入货位", durationMs: 1_050, pose: extendedPose },
      { id: "place", label: "下降托盘到货板", durationMs: 550, pose: placedPose },
      { id: "release", label: "释放托盘并占用货位", durationMs: 450, pose: placedPose, plannedActions: ["detach-cargo", "occupy-slot"] },
      { id: "retract", label: "空载收回货叉", durationMs: 850, pose: retractedPose },
      { id: "lower", label: "下降到待机高度", durationMs: 1_100, pose: loweredPose },
      { id: "return", label: "返回左侧出库端", durationMs: 1_200, pose: home },
    ],
  };
}
