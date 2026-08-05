import type {
  BoxFeature,
  CreateModelInput,
  FeatureAppearance,
  FeatureGroup,
  ModelFeature,
  Vector3Tuple,
} from "@solidloom/shared";

export type SnackCabinetFinish = "graphite" | "porcelain" | "sage";

export interface SnackCabinetParameters {
  depth: number;
  finish: SnackCabinetFinish;
  height: number;
  width: number;
}

export const defaultSnackCabinetParameters: SnackCabinetParameters = {
  depth: 560,
  finish: "graphite",
  height: 1880,
  width: 920,
};

export const snackCabinetFeatureIds = {
  base: "snack-cabinet-base",
  back: "snack-cabinet-back",
  leftColumn: "snack-cabinet-left-column",
  rightColumn: "snack-cabinet-right-column",
  top: "snack-cabinet-top",
  shelfOne: "snack-cabinet-shelf-one",
  shelfTwo: "snack-cabinet-shelf-two",
  shelfThree: "snack-cabinet-shelf-three",
  shelfFour: "snack-cabinet-shelf-four",
  productRowOne: "snack-cabinet-product-row-one",
  productRowTwo: "snack-cabinet-product-row-two",
  productRowThree: "snack-cabinet-product-row-three",
  glassDoor: "snack-cabinet-glass-door",
  pickupRecess: "snack-cabinet-pickup-recess",
  pickupFlap: "snack-cabinet-pickup-flap",
  paymentDisplay: "snack-cabinet-payment-display",
  statusLight: "snack-cabinet-status-light",
  refillPanel: "snack-cabinet-refill-panel",
} as const;

export const snackCabinetGroupIds = {
  structure: "snack-cabinet-structure-group",
  shelves: "snack-cabinet-shelves-group",
  products: "snack-cabinet-products-group",
  glassDoor: "snack-cabinet-glass-door-group",
  pickup: "snack-cabinet-pickup-group",
  pickupFlap: "snack-cabinet-pickup-flap-group",
  service: "snack-cabinet-service-group",
  refill: "snack-cabinet-refill-group",
} as const;

export const snackCabinetJointIds = {
  pickupFlap: "snack-cabinet-pickup-flap-joint",
} as const;

const finishPalette: Record<SnackCabinetFinish, {
  accent: string;
  body: string;
  trim: string;
}> = {
  graphite: { body: "#202B31", trim: "#10181C", accent: "#B8F13C" },
  porcelain: { body: "#D7D9D4", trim: "#4D5659", accent: "#E58F3A" },
  sage: { body: "#64786F", trim: "#263630", accent: "#D7E85B" },
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

function group(id: string, name: string, features: ModelFeature[]): FeatureGroup {
  return {
    id,
    name,
    featureIds: features.map((feature) => feature.id),
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  };
}

export function normalizeSnackCabinetParameters(
  parameters: Partial<SnackCabinetParameters> = {},
): SnackCabinetParameters {
  return {
    width: clamp(parameters.width ?? defaultSnackCabinetParameters.width, 720, 1200),
    height: clamp(parameters.height ?? defaultSnackCabinetParameters.height, 1600, 2300),
    depth: clamp(parameters.depth ?? defaultSnackCabinetParameters.depth, 440, 720),
    finish: parameters.finish && parameters.finish in finishPalette
      ? parameters.finish
      : defaultSnackCabinetParameters.finish,
  };
}

export function createSnackCabinet(
  input: Partial<SnackCabinetParameters> = {},
): CreateModelInput {
  const parameters = normalizeSnackCabinetParameters(input);
  const { width, height, depth } = parameters;
  const colors = finishPalette[parameters.finish];
  const bodyAppearance = { material: "metal" as const, color: colors.body };
  const trimAppearance = { material: "plastic" as const, color: colors.trim };
  const accentAppearance = { material: "plastic" as const, color: colors.accent };
  const shelfAppearance = { material: "metal" as const, color: "#A8B6B8" };
  const glassAppearance = { material: "glass" as const, color: "#92D5DE" };
  const darkGlassAppearance = { material: "glass" as const, color: "#163039" };
  const snackAppearance = { material: "plastic" as const, color: "#E88D4D" };

  const baseHeight = Math.max(96, height * 0.055);
  const frameThickness = Math.max(44, width * 0.052);
  const backThickness = Math.max(24, depth * 0.052);
  const displayBottom = baseHeight + height * 0.22;
  const displayTop = height - frameThickness;
  const displayHeight = displayTop - displayBottom;
  const innerWidth = width - frameThickness * 2;
  const frontZ = depth / 2;
  const shelfDepth = depth - backThickness - 48;
  const shelfZ = backThickness / 2 + 6;

  const structure = [
    box(
      snackCabinetFeatureIds.base,
      "承重底座",
      [width, baseHeight, depth],
      [0, baseHeight / 2, 0],
      bodyAppearance,
      16,
    ),
    box(
      snackCabinetFeatureIds.back,
      "金属背板",
      [width, height - baseHeight, backThickness],
      [0, baseHeight + (height - baseHeight) / 2, -depth / 2 + backThickness / 2],
      bodyAppearance,
      8,
    ),
    box(
      snackCabinetFeatureIds.leftColumn,
      "左侧立柱",
      [frameThickness, height - baseHeight, depth],
      [-width / 2 + frameThickness / 2, baseHeight + (height - baseHeight) / 2, 0],
      bodyAppearance,
      12,
    ),
    box(
      snackCabinetFeatureIds.rightColumn,
      "右侧立柱",
      [frameThickness, height - baseHeight, depth],
      [width / 2 - frameThickness / 2, baseHeight + (height - baseHeight) / 2, 0],
      bodyAppearance,
      12,
    ),
    box(
      snackCabinetFeatureIds.top,
      "顶部横梁",
      [width, frameThickness, depth],
      [0, height - frameThickness / 2, 0],
      bodyAppearance,
      12,
    ),
  ];

  const shelfYs = [0.12, 0.36, 0.60, 0.84].map((ratio) => displayBottom + displayHeight * ratio);
  const shelfIds = [
    snackCabinetFeatureIds.shelfOne,
    snackCabinetFeatureIds.shelfTwo,
    snackCabinetFeatureIds.shelfThree,
    snackCabinetFeatureIds.shelfFour,
  ];
  const shelves = shelfYs.map((y, index) => box(
    shelfIds[index]!,
    `第 ${index + 1} 层陈列架`,
    [innerWidth, 22, shelfDepth],
    [0, y, shelfZ],
    shelfAppearance,
    6,
  ));

  const productIds = [
    snackCabinetFeatureIds.productRowOne,
    snackCabinetFeatureIds.productRowTwo,
    snackCabinetFeatureIds.productRowThree,
  ];
  const products = productIds.map((id, index) => box(
    id,
    `第 ${index + 1} 排零食陈列`,
    [innerWidth * 0.78, displayHeight * 0.105, Math.max(70, depth * 0.15)],
    [0, shelfYs[index + 1]! + displayHeight * 0.073, frontZ - depth * 0.22],
    index === 1 ? accentAppearance : snackAppearance,
    10,
  ));

  const glassDoor = [box(
    snackCabinetFeatureIds.glassDoor,
    "整面透明柜门",
    [innerWidth, displayHeight, 18],
    [0, displayBottom + displayHeight / 2, frontZ + 12],
    glassAppearance,
    14,
  )];

  const pickupY = baseHeight + height * 0.105;
  const pickup = [box(
      snackCabinetFeatureIds.pickupRecess,
      "取物口内腔",
      [innerWidth * 0.68, height * 0.105, 34],
      [0, pickupY, frontZ + 10],
      trimAppearance,
      12,
    )];
  const pickupFlap = [box(
      snackCabinetFeatureIds.pickupFlap,
      "取物挡板",
      [innerWidth * 0.58, height * 0.073, 12],
      [0, pickupY, frontZ + 31],
      darkGlassAppearance,
      10,
    )];

  const service = [
    box(
      snackCabinetFeatureIds.paymentDisplay,
      "支付与选择屏",
      [width * 0.22, height * 0.115, 18],
      [width / 2 - frameThickness - width * 0.13, displayBottom + displayHeight * 0.22, frontZ + 34],
      darkGlassAppearance,
      10,
    ),
    box(
      snackCabinetFeatureIds.statusLight,
      "设备状态灯",
      [width * 0.10, 16, 12],
      [width / 2 - frameThickness - width * 0.13, displayBottom + displayHeight * 0.305, frontZ + 38],
      accentAppearance,
      8,
    ),
  ];

  const refill = [box(
    snackCabinetFeatureIds.refillPanel,
    "后侧补货门",
    [innerWidth * 0.72, displayHeight * 0.48, 14],
    [0, displayBottom + displayHeight * 0.47, -depth / 2 - 9],
    trimAppearance,
    10,
  )];

  const features = [
    ...structure,
    ...shelves,
    ...products,
    ...glassDoor,
    ...pickup,
    ...pickupFlap,
    ...service,
    ...refill,
  ];
  const groups = [
    group(snackCabinetGroupIds.structure, "柜体结构", structure),
    group(snackCabinetGroupIds.shelves, "陈列层架", shelves),
    group(snackCabinetGroupIds.products, "零食陈列", products),
    group(snackCabinetGroupIds.glassDoor, "透明柜门", glassDoor),
    group(snackCabinetGroupIds.pickup, "取物区", pickup),
    group(snackCabinetGroupIds.pickupFlap, "取物挡板", pickupFlap),
    group(snackCabinetGroupIds.service, "支付与状态", service),
    group(snackCabinetGroupIds.refill, "补货区", refill),
  ];

  return {
    name: "参数化零食售货机",
    description: "带固定透明展示窗、内部货道、支付选择区、前置取物口和后侧补货入口的零食售货机。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups,
      joints: [{
        id: snackCabinetJointIds.pickupFlap,
        name: "取物挡板铰链",
        type: "revolute",
        groupId: snackCabinetGroupIds.pickupFlap,
        pivot: [0, pickupY + height * 0.0365, frontZ + 31],
        axis: [1, 0, 0],
        value: 0,
        restValue: 0,
        min: 0,
        max: 55,
      }],
      variables: [
        { id: "snack-cabinet-width", label: "柜体宽度", value: width, unit: "mm" },
        { id: "snack-cabinet-height", label: "柜体高度", value: height, unit: "mm" },
        { id: "snack-cabinet-depth", label: "柜体深度", value: depth, unit: "mm" },
      ],
    },
  };
}
