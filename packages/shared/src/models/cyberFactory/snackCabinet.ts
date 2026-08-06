import type {
  BoxFeature,
  CreateModelInput,
  FeatureAppearance,
  FeatureGroup,
  FeatureMaterialPreset,
  ModelFeature,
  Vector3Tuple,
} from "../../types.js";

export type SnackCabinetFinish = "graphite" | "porcelain" | "sage";

export interface SnackCabinetColors {
  accent: string;
  body: string;
  darkGlass: string;
  glass: string;
  shelf: string;
  trim: string;
}

export interface SnackCabinetParameters {
  depth: number;
  finish: SnackCabinetFinish;
  height: number;
  width: number;
}

export interface SnackCabinetProductDefinition {
  color: string;
  depth?: number;
  height?: number;
  id: string;
  label: string;
  material?: FeatureMaterialPreset;
  width?: number;
}

export interface SnackCabinetShelfInventory {
  fillMode?: "exact" | "repeat";
  id: string;
  products: readonly SnackCabinetProductDefinition[];
}

export interface SnackCabinetCreateInput extends Partial<SnackCabinetParameters> {
  colors?: Partial<SnackCabinetColors>;
  inventory?: readonly SnackCabinetShelfInventory[];
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
  glassDoor: "snack-cabinet-glass-door",
  pickupRecess: "snack-cabinet-pickup-recess",
  pickupFlap: "snack-cabinet-pickup-flap",
  paymentDisplay: "snack-cabinet-payment-display",
  statusLight: "snack-cabinet-status-light",
  refillPanel: "snack-cabinet-refill-panel",
} as const;

export const snackCabinetProductFeaturePrefix = "snack-cabinet-product-";
export const snackCabinetGeneratorId = "cyber-factory.snack-cabinet";

export const snackCabinetVariableIds = {
  width: "--snack-cabinet-width",
  height: "--snack-cabinet-height",
  depth: "--snack-cabinet-depth",
  bodyColor: "--snack-cabinet-body-color",
  trimColor: "--snack-cabinet-trim-color",
  accentColor: "--snack-cabinet-accent-color",
  shelfColor: "--snack-cabinet-shelf-color",
  glassColor: "--snack-cabinet-glass-color",
  darkGlassColor: "--snack-cabinet-dark-glass-color",
} as const;

const defaultProductWidth = 76;
const defaultProductDepth = 88;
const productGap = 18;

export const defaultSnackCabinetInventory: readonly SnackCabinetShelfInventory[] = [
  {
    id: "drinks",
    fillMode: "repeat",
    products: [
      { id: "sparkling-water", label: "气泡水", color: "#75C9D2", height: 178 },
      { id: "cold-brew", label: "冷萃咖啡", color: "#795548", height: 166 },
      { id: "green-tea", label: "无糖绿茶", color: "#7DBB63", height: 174 },
      { id: "orange-soda", label: "橙味汽水", color: "#F29A4A", height: 170 },
    ],
  },
  {
    id: "savory",
    fillMode: "repeat",
    products: [
      { id: "sea-salt-chips", label: "海盐薯片", color: "#4D9ED0", height: 150 },
      { id: "nori-crackers", label: "海苔脆片", color: "#4E8066", height: 138 },
      { id: "mixed-nuts", label: "混合坚果", color: "#C68B54", height: 132 },
      { id: "corn-snack", label: "玉米脆", color: "#E5BC45", height: 145 },
    ],
  },
  {
    id: "sweets",
    fillMode: "repeat",
    products: [
      { id: "dark-chocolate", label: "黑巧克力", color: "#60453D", height: 118 },
      { id: "energy-bar", label: "能量棒", color: "#B8F13C", height: 102 },
      { id: "berry-gummy", label: "莓果软糖", color: "#D66A91", height: 126 },
      { id: "milk-cookie", label: "牛乳曲奇", color: "#E8C987", height: 122 },
    ],
  },
  {
    id: "quick-meals",
    fillMode: "repeat",
    products: [
      { id: "sandwich", label: "即食三明治", color: "#D7B56D", height: 116 },
      { id: "oat-cup", label: "燕麦杯", color: "#B58A61", height: 132 },
      { id: "protein-box", label: "蛋白餐盒", color: "#8699B7", height: 108 },
      { id: "fruit-cup", label: "鲜果杯", color: "#EF7F63", height: 128 },
    ],
  },
];

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

const defaultShelfColor = "#A8B6B8";
const defaultGlassColor = "#92D5DE";
const defaultDarkGlassColor = "#163039";

function normalizedColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

export function normalizeSnackCabinetColors(
  colors: Partial<SnackCabinetColors> = {},
  finish: SnackCabinetFinish = defaultSnackCabinetParameters.finish,
): SnackCabinetColors {
  const palette = finishPalette[finish];
  return {
    body: normalizedColor(colors.body, palette.body),
    trim: normalizedColor(colors.trim, palette.trim),
    accent: normalizedColor(colors.accent, palette.accent),
    shelf: normalizedColor(colors.shelf, defaultShelfColor),
    glass: normalizedColor(colors.glass, defaultGlassColor),
    darkGlass: normalizedColor(colors.darkGlass, defaultDarkGlassColor),
  };
}

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

function safeProductId(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || "item";
}

function createShelfProducts(
  inventories: readonly SnackCabinetShelfInventory[],
  shelfYs: number[],
  innerWidth: number,
  frontZ: number,
  depth: number,
): BoxFeature[] {
  const products: BoxFeature[] = [];
  const usableWidth = innerWidth - productGap * 2;

  inventories.slice(0, shelfYs.length).forEach((inventory, shelfIndex) => {
    if (inventory.products.length === 0) return;
    const fillMode = inventory.fillMode ?? "exact";
    const candidates = fillMode === "repeat"
      ? Array.from({ length: 64 }, (_, index) => inventory.products[index % inventory.products.length]!)
      : [...inventory.products];
    const placed: Array<{ definition: SnackCabinetProductDefinition; width: number }> = [];
    let occupiedWidth = 0;

    for (const definition of candidates) {
      const productWidth = clamp(definition.width ?? defaultProductWidth, 44, 150);
      const nextWidth = occupiedWidth + (placed.length > 0 ? productGap : 0) + productWidth;
      if (nextWidth > usableWidth) break;
      placed.push({ definition, width: productWidth });
      occupiedWidth = nextWidth;
    }

    let cursorX = -occupiedWidth / 2;
    placed.forEach(({ definition, width: productWidth }, slotIndex) => {
      const productHeight = clamp(definition.height ?? 138, 72, 210);
      const productDepth = clamp(definition.depth ?? defaultProductDepth, 48, 140);
      const positionX = cursorX + productWidth / 2;
      const featureId = `${snackCabinetProductFeaturePrefix}${shelfIndex + 1}-${slotIndex + 1}-${safeProductId(definition.id)}`;
      products.push(box(
        featureId,
        `第 ${shelfIndex + 1} 层 · ${definition.label}`,
        [productWidth, productHeight, productDepth],
        [positionX, shelfYs[shelfIndex]! + 11 + productHeight / 2, frontZ - Math.max(88, depth * 0.18)],
        { material: definition.material ?? "plastic", color: definition.color },
        Math.min(12, productWidth * 0.14),
      ));
      cursorX += productWidth + productGap;
    });
  });

  return products;
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
  input: SnackCabinetCreateInput = {},
): CreateModelInput {
  const { colors: colorInput, inventory = defaultSnackCabinetInventory, ...parameterInput } = input;
  const parameters = normalizeSnackCabinetParameters(parameterInput);
  const { width, height, depth } = parameters;
  const colors = normalizeSnackCabinetColors(colorInput, parameters.finish);
  const bodyAppearance = { material: "metal" as const, color: colors.body };
  const trimAppearance = { material: "plastic" as const, color: colors.trim };
  const accentAppearance = { material: "plastic" as const, color: colors.accent };
  const shelfAppearance = { material: "metal" as const, color: colors.shelf };
  const glassAppearance = { material: "glass" as const, color: colors.glass };
  const darkGlassAppearance = { material: "glass" as const, color: colors.darkGlass };

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

  const products = createShelfProducts(inventory, shelfYs, innerWidth, frontZ, depth);

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
    description: "带四层独立商品槽位、透明展示窗、支付选择区、前置取物口和后侧补货入口的参数化零食售货机。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      generator: {
        id: snackCabinetGeneratorId,
        version: 1,
        options: {
          finish: parameters.finish,
          colors: structuredClone(colors),
          inventory: structuredClone(inventory),
        },
      },
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
        { id: snackCabinetVariableIds.width, label: "柜体宽度", value: width, unit: "mm" },
        { id: snackCabinetVariableIds.height, label: "柜体高度", value: height, unit: "mm" },
        { id: snackCabinetVariableIds.depth, label: "柜体深度", value: depth, unit: "mm" },
        { id: snackCabinetVariableIds.bodyColor, label: "柜体颜色", type: "color", value: colors.body },
        { id: snackCabinetVariableIds.trimColor, label: "边框颜色", type: "color", value: colors.trim },
        { id: snackCabinetVariableIds.accentColor, label: "强调颜色", type: "color", value: colors.accent },
        { id: snackCabinetVariableIds.shelfColor, label: "层架颜色", type: "color", value: colors.shelf },
        { id: snackCabinetVariableIds.glassColor, label: "展示玻璃颜色", type: "color", value: colors.glass },
        { id: snackCabinetVariableIds.darkGlassColor, label: "屏幕与挡板颜色", type: "color", value: colors.darkGlass },
      ],
    },
  };
}
