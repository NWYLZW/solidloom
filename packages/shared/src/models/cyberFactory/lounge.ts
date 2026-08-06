import type {
  BoxFeature,
  CreateModelInput,
  CylinderFeature,
  FeatureAppearance,
  FeatureGroup,
  ModelFeature,
  Vector3Tuple,
} from "../../types.js";

export type LoungeLayout = "conversation" | "linear" | "compact";
export type LoungePalette = "teal" | "clay" | "sand";

export interface LoungeParameters {
  lampOn: boolean;
  layout: LoungeLayout;
  palette: LoungePalette;
  rugWidth: number;
  seatHeight: number;
  sofaWidth: number;
  tableWidth: number;
}

export interface LoungeComponentTransform {
  position: Vector3Tuple;
  rotationY: number;
}

export interface LoungeLayoutTransforms {
  coffeeTable: LoungeComponentTransform;
  floorLamp: LoungeComponentTransform;
  leftChair: LoungeComponentTransform;
  plant: LoungeComponentTransform;
  rightChair: LoungeComponentTransform;
  rug: LoungeComponentTransform;
  sofa: LoungeComponentTransform;
}

export const defaultLoungeParameters: LoungeParameters = {
  sofaWidth: 2_240,
  seatHeight: 430,
  tableWidth: 1_080,
  rugWidth: 3_800,
  layout: "conversation",
  palette: "teal",
  lampOn: true,
};

export const loungeGroupIds = {
  sofa: "lounge-sofa-group",
  leftChair: "lounge-left-chair-group",
  rightChair: "lounge-right-chair-group",
  coffeeTable: "lounge-coffee-table-group",
  rug: "lounge-rug-group",
  floorLamp: "lounge-floor-lamp-group",
  plant: "lounge-plant-group",
} as const;

export const loungeFeatureIds = {
  rug: "lounge-rug",
  sofaBase: "lounge-sofa-base",
  sofaBack: "lounge-sofa-back",
  leftChairBase: "lounge-left-chair-base",
  leftChairBack: "lounge-left-chair-back",
  rightChairBase: "lounge-right-chair-base",
  rightChairBack: "lounge-right-chair-back",
  tableTop: "lounge-coffee-table-top",
  tableShelf: "lounge-coffee-table-shelf",
  lampBase: "lounge-floor-lamp-base",
  lampPole: "lounge-floor-lamp-pole",
  lampShade: "lounge-floor-lamp-shade",
  lampLight: "lounge-floor-lamp-light",
  plantPot: "lounge-plant-pot",
  plantTrunk: "lounge-plant-trunk",
} as const;

const paletteColors: Record<LoungePalette, {
  accent: string;
  fabric: string;
  fabricDark: string;
  pillow: string;
  rug: string;
}> = {
  teal: {
    fabric: "#4B8582",
    fabricDark: "#315C5D",
    pillow: "#D0A95D",
    rug: "#28545A",
    accent: "#65E0D0",
  },
  clay: {
    fabric: "#B96F59",
    fabricDark: "#78483B",
    pillow: "#E7C783",
    rug: "#59342F",
    accent: "#F09A72",
  },
  sand: {
    fabric: "#CABBA0",
    fabricDark: "#817663",
    pillow: "#52786F",
    rug: "#625B4D",
    accent: "#E2CC91",
  },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeLoungeParameters(
  input: Partial<LoungeParameters> = {},
): LoungeParameters {
  return {
    sofaWidth: clamp(input.sofaWidth ?? defaultLoungeParameters.sofaWidth, 1_800, 2_800),
    seatHeight: clamp(input.seatHeight ?? defaultLoungeParameters.seatHeight, 380, 500),
    tableWidth: clamp(input.tableWidth ?? defaultLoungeParameters.tableWidth, 720, 1_400),
    rugWidth: clamp(input.rugWidth ?? defaultLoungeParameters.rugWidth, 3_200, 4_800),
    layout: input.layout && ["conversation", "linear", "compact"].includes(input.layout)
      ? input.layout
      : defaultLoungeParameters.layout,
    palette: input.palette && input.palette in paletteColors
      ? input.palette
      : defaultLoungeParameters.palette,
    lampOn: input.lampOn ?? defaultLoungeParameters.lampOn,
  };
}

export function getLoungeLayoutTransforms(
  input: Partial<LoungeParameters> = {},
): LoungeLayoutTransforms {
  const parameters = normalizeLoungeParameters(input);
  const chairOffset = parameters.sofaWidth / 2 + 560;
  if (parameters.layout === "linear") {
    return {
      sofa: { position: [0, 0, -620], rotationY: 0 },
      leftChair: { position: [-chairOffset, 0, -520], rotationY: 0 },
      rightChair: { position: [chairOffset, 0, -520], rotationY: 0 },
      coffeeTable: { position: [0, 0, 540], rotationY: 0 },
      rug: { position: [0, 0, 0], rotationY: 0 },
      floorLamp: { position: [parameters.rugWidth / 2 - 1_050, 0, -1_040], rotationY: 0 },
      plant: { position: [-parameters.rugWidth / 2 + 300, 0, -920], rotationY: 0 },
    };
  }
  if (parameters.layout === "compact") {
    return {
      sofa: { position: [0, 0, -620], rotationY: 0 },
      leftChair: { position: [-chairOffset * 0.82, 0, 260], rotationY: 58 },
      rightChair: { position: [chairOffset * 0.82, 0, 260], rotationY: -58 },
      coffeeTable: { position: [0, 0, 340], rotationY: 0 },
      rug: { position: [0, 0, 0], rotationY: 0 },
      floorLamp: { position: [parameters.rugWidth / 2 - 1_050, 0, -920], rotationY: 0 },
      plant: { position: [-parameters.rugWidth / 2 + 350, 0, -740], rotationY: 0 },
    };
  }
  return {
    sofa: { position: [0, 0, -820], rotationY: 0 },
    leftChair: { position: [-chairOffset, 0, 240], rotationY: 62 },
    rightChair: { position: [chairOffset, 0, 240], rotationY: -62 },
    coffeeTable: { position: [0, 0, 420], rotationY: 0 },
    rug: { position: [0, 0, 0], rotationY: 0 },
    floorLamp: { position: [parameters.rugWidth / 2 - 1_050, 0, -1_080], rotationY: 0 },
    plant: { position: [-parameters.rugWidth / 2 + 300, 0, -960], rotationY: 0 },
  };
}

export function transformLoungePoint(
  position: Vector3Tuple,
  transform: LoungeComponentTransform,
): Vector3Tuple {
  const angle = transform.rotationY * Math.PI / 180;
  const [x, y, z] = position;
  return [
    transform.position[0] + x * Math.cos(angle) + z * Math.sin(angle),
    transform.position[1] + y,
    transform.position[2] - x * Math.sin(angle) + z * Math.cos(angle),
  ];
}

function box(
  id: string,
  name: string,
  size: Vector3Tuple,
  position: Vector3Tuple,
  appearance: FeatureAppearance,
  transform: LoungeComponentTransform,
  cornerRadius = 0,
  localRotation: Vector3Tuple = [0, 0, 0],
): BoxFeature {
  const safeRadius = Math.min(cornerRadius, size[0] / 4, size[1] / 4, size[2] / 4);
  return {
    id,
    name,
    type: "box",
    operation: "add",
    position: transformLoungePoint(position, transform),
    rotation: [localRotation[0], localRotation[1] + transform.rotationY, localRotation[2]],
    appearance,
    parameters: {
      width: size[0],
      height: size[1],
      depth: size[2],
      ...(safeRadius > 0 ? { cornerRadius: safeRadius, cornerAlgorithm: "smooth" as const } : {}),
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
  transform: LoungeComponentTransform,
  localRotation: Vector3Tuple = [0, 0, 0],
): CylinderFeature {
  return {
    id,
    name,
    type: "cylinder",
    operation: "add",
    position: transformLoungePoint(position, transform),
    rotation: [localRotation[0], localRotation[1] + transform.rotationY, localRotation[2]],
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

function createSofa(
  parameters: LoungeParameters,
  transform: LoungeComponentTransform,
  colors: typeof paletteColors[LoungePalette],
): ModelFeature[] {
  const width = parameters.sofaWidth;
  const depth = 900;
  const legHeight = 105;
  const seatTop = parameters.seatHeight;
  const innerWidth = width - 300;
  const cushionWidth = (innerWidth - 42) / 3;
  const fabric = { material: "fabric" as const, color: colors.fabric };
  const darkFabric = { material: "fabric" as const, color: colors.fabricDark };
  const pillow = { material: "fabric" as const, color: colors.pillow };
  const metal = { material: "metal" as const, color: "#2D3437" };
  const features: ModelFeature[] = [
    box(loungeFeatureIds.sofaBase, "三人沙发底座", [width, 150, depth], [0, legHeight + 75, 0], darkFabric, transform, 44),
    box(loungeFeatureIds.sofaBack, "三人沙发靠背", [width, 650, 170], [0, legHeight + 420, -depth / 2 + 85], fabric, transform, 54, [-7, 0, 0]),
    box("lounge-sofa-left-arm", "沙发左扶手", [150, 410, depth], [-width / 2 + 75, legHeight + 275, 0], fabric, transform, 54),
    box("lounge-sofa-right-arm", "沙发右扶手", [150, 410, depth], [width / 2 - 75, legHeight + 275, 0], fabric, transform, 54),
  ];
  [-1, 0, 1].forEach((column, index) => {
    const x = column * (cushionWidth + 21);
    features.push(
      box(`lounge-sofa-seat-cushion-${index + 1}`, `沙发座垫 ${index + 1}`, [cushionWidth, 150, 650], [x, seatTop - 75, 85], fabric, transform, 42),
      box(`lounge-sofa-back-cushion-${index + 1}`, `沙发靠垫 ${index + 1}`, [cushionWidth, 390, 135], [x, seatTop + 225, -depth / 2 + 170], fabric, transform, 46, [-9, 0, 0]),
    );
  });
  [-1, 1].forEach((side, index) => {
    features.push(box(
      `lounge-sofa-pillow-${index + 1}`,
      `沙发抱枕 ${index + 1}`,
      [280, 300, 120],
      [side * (innerWidth / 2 - 190), seatTop + 135, 5],
      pillow,
      transform,
      48,
      [0, side * -8, side * 7],
    ));
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([xSide, zSide], index) => {
    features.push(cylinder(
      `lounge-sofa-leg-${index + 1}`,
      `沙发支脚 ${index + 1}`,
      32,
      legHeight,
      [xSide! * (width / 2 - 170), legHeight / 2, zSide! * (depth / 2 - 130)],
      metal,
      transform,
    ));
  });
  return features;
}

function createArmchair(
  side: "left" | "right",
  parameters: LoungeParameters,
  transform: LoungeComponentTransform,
  colors: typeof paletteColors[LoungePalette],
): ModelFeature[] {
  const label = side === "left" ? "左单椅" : "右单椅";
  const prefix = `lounge-${side}-chair`;
  const width = 790;
  const depth = 820;
  const legHeight = 105;
  const seatTop = parameters.seatHeight;
  const fabric = { material: "fabric" as const, color: colors.fabric };
  const darkFabric = { material: "fabric" as const, color: colors.fabricDark };
  const metal = { material: "metal" as const, color: "#2D3437" };
  const features: ModelFeature[] = [
    box(`${prefix}-base`, `${label}底座`, [width, 145, depth], [0, legHeight + 72.5, 0], darkFabric, transform, 42),
    box(`${prefix}-back`, `${label}靠背`, [width, 620, 165], [0, legHeight + 405, -depth / 2 + 82.5], fabric, transform, 52, [-8, 0, 0]),
    box(`${prefix}-left-arm`, `${label}左扶手`, [135, 390, depth], [-width / 2 + 67.5, legHeight + 260, 0], fabric, transform, 50),
    box(`${prefix}-right-arm`, `${label}右扶手`, [135, 390, depth], [width / 2 - 67.5, legHeight + 260, 0], fabric, transform, 50),
    box(`${prefix}-seat-cushion`, `${label}座垫`, [width - 190, 150, 610], [0, seatTop - 75, 75], fabric, transform, 42),
    box(`${prefix}-back-cushion`, `${label}靠垫`, [width - 190, 390, 135], [0, seatTop + 215, -depth / 2 + 165], fabric, transform, 48, [-10, 0, 0]),
  ];
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([xSide, zSide], index) => {
    features.push(cylinder(
      `${prefix}-leg-${index + 1}`,
      `${label}支脚 ${index + 1}`,
      28,
      legHeight,
      [xSide! * (width / 2 - 130), legHeight / 2, zSide! * (depth / 2 - 120)],
      metal,
      transform,
    ));
  });
  return features;
}

function createCoffeeTable(
  parameters: LoungeParameters,
  transform: LoungeComponentTransform,
): ModelFeature[] {
  const width = parameters.tableWidth;
  const depth = Math.max(560, width * 0.62);
  const wood = { material: "wood" as const, color: "#9A6B42" };
  const glass = { material: "glass" as const, color: "#B9E3DE" };
  const metal = { material: "metal" as const, color: "#313B3D" };
  const features: ModelFeature[] = [
    box(loungeFeatureIds.tableTop, "茶几木质台面", [width, 70, depth], [0, 455, 0], wood, transform, 30),
    box(loungeFeatureIds.tableShelf, "茶几玻璃置物层", [width * 0.78, 22, depth * 0.72], [0, 225, 0], glass, transform, 10),
  ];
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([xSide, zSide], index) => {
    features.push(box(
      `lounge-coffee-table-leg-${index + 1}`,
      `茶几支脚 ${index + 1}`,
      [48, 420, 48],
      [xSide! * (width / 2 - 100), 210, zSide! * (depth / 2 - 95)],
      metal,
      transform,
      10,
    ));
  });
  return features;
}

function createFloorLamp(
  parameters: LoungeParameters,
  transform: LoungeComponentTransform,
  colors: typeof paletteColors[LoungePalette],
): ModelFeature[] {
  const metal = { material: "metal" as const, color: "#363F41" };
  return [
    cylinder(loungeFeatureIds.lampBase, "落地灯底座", 180, 32, [0, 16, 0], metal, transform),
    cylinder(loungeFeatureIds.lampPole, "落地灯灯杆", 25, 1_580, [0, 806, 0], metal, transform),
    cylinder(loungeFeatureIds.lampShade, "落地灯灯罩", 235, 320, [0, 1_650, 0], { material: "fabric", color: "#D9CBA8" }, transform),
    cylinder(
      loungeFeatureIds.lampLight,
      "落地灯光源",
      115,
      36,
      [0, 1_485, 0],
      { material: "glass", color: parameters.lampOn ? colors.accent : "#5B625F" },
      transform,
    ),
  ];
}

function createPlant(transform: LoungeComponentTransform): ModelFeature[] {
  const ceramic = { material: "default" as const, color: "#C77952" };
  const wood = { material: "wood" as const, color: "#73503A" };
  const leaf = { material: "fabric" as const, color: "#487B5C" };
  const features: ModelFeature[] = [
    cylinder(loungeFeatureIds.plantPot, "绿植花盆", 230, 360, [0, 180, 0], ceramic, transform),
    cylinder("lounge-plant-pot-rim", "绿植花盆口沿", 250, 55, [0, 345, 0], ceramic, transform),
    cylinder(loungeFeatureIds.plantTrunk, "绿植主干", 42, 720, [0, 690, 0], wood, transform),
  ];
  for (let index = 0; index < 9; index += 1) {
    const angle = index * 40;
    const radians = angle * Math.PI / 180;
    const radius = index % 2 === 0 ? 145 : 205;
    features.push(box(
      `lounge-plant-leaf-${index + 1}`,
      `绿植叶片 ${index + 1}`,
      [190, 28, 390],
      [Math.sin(radians) * radius, 660 + index * 65, Math.cos(radians) * radius],
      leaf,
      transform,
      14,
      [index % 2 === 0 ? 28 : -24, angle, index % 3 === 0 ? 16 : -12],
    ));
  }
  return features;
}

export function createLoungeKit(
  input: Partial<LoungeParameters> = {},
): CreateModelInput {
  const parameters = normalizeLoungeParameters(input);
  const colors = paletteColors[parameters.palette];
  const transforms = getLoungeLayoutTransforms(parameters);
  const sofa = createSofa(parameters, transforms.sofa, colors);
  const leftChair = createArmchair("left", parameters, transforms.leftChair, colors);
  const rightChair = createArmchair("right", parameters, transforms.rightChair, colors);
  const coffeeTable = createCoffeeTable(parameters, transforms.coffeeTable);
  const rug = [box(
    loungeFeatureIds.rug,
    "休息区地毯",
    [parameters.rugWidth, 22, parameters.rugWidth * 0.68],
    [0, 11, 0],
    { material: "fabric", color: colors.rug },
    transforms.rug,
    86,
  )];
  const floorLamp = createFloorLamp(parameters, transforms.floorLamp, colors);
  const plant = createPlant(transforms.plant);
  const features = [...rug, ...sofa, ...leftChair, ...rightChair, ...coffeeTable, ...floorLamp, ...plant];

  return {
    name: "现代休息区资产套件",
    description: "可组合的三人沙发、双单椅、茶几、地毯、落地灯和绿植休息区。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [
        group(loungeGroupIds.rug, "地毯", rug),
        group(loungeGroupIds.sofa, "三人沙发", sofa),
        group(loungeGroupIds.leftChair, "左单椅", leftChair),
        group(loungeGroupIds.rightChair, "右单椅", rightChair),
        group(loungeGroupIds.coffeeTable, "茶几", coffeeTable),
        group(loungeGroupIds.floorLamp, "落地灯", floorLamp),
        group(loungeGroupIds.plant, "绿植", plant),
      ],
      variables: [
        { id: "--lounge-sofa-width", label: "沙发宽度", type: "number", value: parameters.sofaWidth, unit: "mm" },
        { id: "--lounge-seat-height", label: "座面高度", type: "number", value: parameters.seatHeight, unit: "mm" },
        { id: "--lounge-table-width", label: "茶几宽度", type: "number", value: parameters.tableWidth, unit: "mm" },
        { id: "--lounge-rug-width", label: "地毯宽度", type: "number", value: parameters.rugWidth, unit: "mm" },
      ],
    },
  };
}
