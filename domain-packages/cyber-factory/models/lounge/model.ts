import type {
  BoxFeature,
  CreateModelInput,
  CylinderFeature,
  FeatureAppearance,
  FeatureGroup,
  ModelFeature,
  Vector3Tuple,
} from "@solidloom/shared";

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

export const loungeDimensions = {
  referenceFigureHeight: 1_720,
  referenceFigureWidth: 860,
  sofa: {
    armHeight: 520,
    armWidth: 140,
    backCushionDepth: 135,
    backCushionHeight: 350,
    backDepth: 145,
    baseHeight: 180,
    depth: 900,
    legHeight: 90,
    overallHeight: 850,
    seatCushionHeight: 150,
    seatDepth: 620,
  },
  armchair: {
    armHeight: 500,
    armWidth: 140,
    backCushionDepth: 130,
    backCushionHeight: 350,
    backDepth: 145,
    baseHeight: 170,
    depth: 860,
    legHeight: 90,
    overallHeight: 830,
    seatCushionHeight: 160,
    seatDepth: 620,
    width: 1_040,
  },
  coffeeTable: {
    depthRatio: 0.58,
    height: 380,
    minimumDepth: 620,
    shelfHeight: 190,
    shelfThickness: 18,
    topThickness: 45,
  },
  floorLamp: {
    baseHeight: 30,
    baseRadius: 160,
    height: 1_650,
    poleRadius: 18,
    shadeHeight: 270,
    shadeRadius: 210,
  },
  plant: {
    colliderHeight: 1_250,
    colliderRadius: 250,
    potHeight: 320,
    potRadius: 200,
  },
  rug: {
    depthRatio: 0.62,
    edgeInset: 60,
    thickness: 10,
  },
  layout: {
    linearChairGap: 40,
  },
} as const;

export const defaultLoungeParameters: LoungeParameters = {
  sofaWidth: 2_800,
  seatHeight: 420,
  tableWidth: 1_200,
  rugWidth: 5_200,
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
  const sofaWidth = clamp(input.sofaWidth ?? defaultLoungeParameters.sofaWidth, 2_400, 3_400);
  const minimumRugWidth = Math.ceil((
    sofaWidth
    + loungeDimensions.armchair.width * 2
    + loungeDimensions.layout.linearChairGap * 2
    + loungeDimensions.rug.edgeInset * 2
  ) / 40) * 40;
  return {
    sofaWidth,
    seatHeight: clamp(input.seatHeight ?? defaultLoungeParameters.seatHeight, 380, 470),
    tableWidth: clamp(input.tableWidth ?? defaultLoungeParameters.tableWidth, 900, 1_600),
    rugWidth: Math.max(
      minimumRugWidth,
      clamp(input.rugWidth ?? defaultLoungeParameters.rugWidth, 4_600, 6_200),
    ),
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
  const linearChairOffset = parameters.sofaWidth / 2
    + loungeDimensions.armchair.width / 2
    + loungeDimensions.layout.linearChairGap;
  const lampX = parameters.rugWidth / 2
    - loungeDimensions.floorLamp.baseRadius
    - loungeDimensions.rug.edgeInset;
  const plantX = -parameters.rugWidth / 2
    + loungeDimensions.plant.colliderRadius
    + loungeDimensions.rug.edgeInset;
  if (parameters.layout === "linear") {
    return {
      sofa: { position: [0, 0, -680], rotationY: 0 },
      leftChair: { position: [-linearChairOffset, 0, -680], rotationY: 0 },
      rightChair: { position: [linearChairOffset, 0, -680], rotationY: 0 },
      coffeeTable: { position: [0, 0, 440], rotationY: 0 },
      rug: { position: [0, 0, 0], rotationY: 0 },
      floorLamp: { position: [lampX, 0, -1_120], rotationY: 0 },
      plant: { position: [plantX, 0, -1_020], rotationY: 0 },
    };
  }
  if (parameters.layout === "compact") {
    return {
      sofa: { position: [0, 0, -720], rotationY: 0 },
      leftChair: { position: [-linearChairOffset * 0.78, 0, 240], rotationY: 46 },
      rightChair: { position: [linearChairOffset * 0.78, 0, 240], rotationY: -46 },
      coffeeTable: { position: [0, 0, 360], rotationY: 0 },
      rug: { position: [0, 0, 0], rotationY: 0 },
      floorLamp: { position: [lampX, 0, -1_040], rotationY: 0 },
      plant: { position: [plantX, 0, -940], rotationY: 0 },
    };
  }
  return {
    sofa: { position: [0, 0, -760], rotationY: 0 },
    leftChair: { position: [-linearChairOffset * 0.84, 0, 220], rotationY: 38 },
    rightChair: { position: [linearChairOffset * 0.84, 0, 220], rotationY: -38 },
    coffeeTable: { position: [0, 0, 360], rotationY: 0 },
    rug: { position: [0, 0, 0], rotationY: 0 },
    floorLamp: { position: [lampX, 0, -1_100], rotationY: 0 },
    plant: { position: [plantX, 0, -1_000], rotationY: 0 },
  };
}

export function getLoungeSofaSeatX(sofaWidth: number, column: -1 | 0 | 1) {
  const innerWidth = sofaWidth - loungeDimensions.sofa.armWidth * 2;
  const cushionGap = 18;
  const cushionWidth = (innerWidth - cushionGap * 2) / 3;
  return column * (cushionWidth + cushionGap);
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
  const dimensions = loungeDimensions.sofa;
  const depth = dimensions.depth;
  const legHeight = dimensions.legHeight;
  const seatTop = parameters.seatHeight;
  const innerWidth = width - dimensions.armWidth * 2;
  const cushionGap = 18;
  const cushionWidth = (innerWidth - cushionGap * 2) / 3;
  const fabric = { material: "fabric" as const, color: colors.fabric };
  const darkFabric = { material: "fabric" as const, color: colors.fabricDark };
  const pillow = { material: "fabric" as const, color: colors.pillow };
  const metal = { material: "metal" as const, color: "#2D3437" };
  const features: ModelFeature[] = [
    box(loungeFeatureIds.sofaBase, "三人沙发底座", [width, dimensions.baseHeight, depth], [0, legHeight + dimensions.baseHeight / 2, 0], darkFabric, transform, 42),
    box(loungeFeatureIds.sofaBack, "三人沙发靠背", [width, dimensions.overallHeight - 220, dimensions.backDepth], [0, (dimensions.overallHeight + 220) / 2, -depth / 2 + dimensions.backDepth / 2], fabric, transform, 48),
    box("lounge-sofa-left-arm", "沙发左扶手", [dimensions.armWidth, dimensions.armHeight, depth], [-width / 2 + dimensions.armWidth / 2, legHeight + dimensions.armHeight / 2, 0], fabric, transform, 48),
    box("lounge-sofa-right-arm", "沙发右扶手", [dimensions.armWidth, dimensions.armHeight, depth], [width / 2 - dimensions.armWidth / 2, legHeight + dimensions.armHeight / 2, 0], fabric, transform, 48),
  ];
  [-1, 0, 1].forEach((column, index) => {
    const x = getLoungeSofaSeatX(width, column as -1 | 0 | 1);
    features.push(
      box(`lounge-sofa-seat-cushion-${index + 1}`, `沙发座垫 ${index + 1}`, [cushionWidth, dimensions.seatCushionHeight, dimensions.seatDepth], [x, seatTop - dimensions.seatCushionHeight / 2, 55], fabric, transform, 38),
      box(`lounge-sofa-back-cushion-${index + 1}`, `沙发靠垫 ${index + 1}`, [cushionWidth, dimensions.backCushionHeight, dimensions.backCushionDepth], [x, seatTop + dimensions.backCushionHeight / 2, -depth / 2 + dimensions.backDepth + dimensions.backCushionDepth / 2 - 2], fabric, transform, 42, [-7, 0, 0]),
    );
  });
  [-1, 1].forEach((side, index) => {
    features.push(box(
      `lounge-sofa-pillow-${index + 1}`,
      `沙发抱枕 ${index + 1}`,
      [250, 270, 105],
      [side * (innerWidth / 2 - 165), seatTop + 120, 15],
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
      28,
      legHeight,
      [xSide! * (width / 2 - 150), legHeight / 2, zSide! * (depth / 2 - 120)],
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
  const dimensions = loungeDimensions.armchair;
  const width = dimensions.width;
  const depth = dimensions.depth;
  const legHeight = dimensions.legHeight;
  const seatTop = parameters.seatHeight;
  const fabric = { material: "fabric" as const, color: colors.fabric };
  const darkFabric = { material: "fabric" as const, color: colors.fabricDark };
  const metal = { material: "metal" as const, color: "#2D3437" };
  const features: ModelFeature[] = [
    box(`${prefix}-base`, `${label}底座`, [width, dimensions.baseHeight, depth], [0, legHeight + dimensions.baseHeight / 2, 0], darkFabric, transform, 40),
    box(`${prefix}-back`, `${label}靠背`, [width, dimensions.overallHeight - 240, dimensions.backDepth], [0, (dimensions.overallHeight + 240) / 2, -depth / 2 + dimensions.backDepth / 2], fabric, transform, 48),
    box(`${prefix}-left-arm`, `${label}左扶手`, [dimensions.armWidth, dimensions.armHeight, depth], [-width / 2 + dimensions.armWidth / 2, legHeight + dimensions.armHeight / 2, 0], fabric, transform, 46),
    box(`${prefix}-right-arm`, `${label}右扶手`, [dimensions.armWidth, dimensions.armHeight, depth], [width / 2 - dimensions.armWidth / 2, legHeight + dimensions.armHeight / 2, 0], fabric, transform, 46),
    box(`${prefix}-seat-cushion`, `${label}座垫`, [width - dimensions.armWidth * 2, dimensions.seatCushionHeight, dimensions.seatDepth], [0, seatTop - dimensions.seatCushionHeight / 2, 55], fabric, transform, 38),
    box(`${prefix}-back-cushion`, `${label}靠垫`, [width - dimensions.armWidth * 2 - 30, dimensions.backCushionHeight, dimensions.backCushionDepth], [0, seatTop + dimensions.backCushionHeight / 2, -depth / 2 + dimensions.backDepth + dimensions.backCushionDepth / 2 - 2], fabric, transform, 42, [-8, 0, 0]),
  ];
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([xSide, zSide], index) => {
    features.push(cylinder(
      `${prefix}-leg-${index + 1}`,
      `${label}支脚 ${index + 1}`,
      26,
      legHeight,
      [xSide! * (width / 2 - 120), legHeight / 2, zSide! * (depth / 2 - 110)],
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
  const dimensions = loungeDimensions.coffeeTable;
  const depth = Math.max(dimensions.minimumDepth, width * dimensions.depthRatio);
  const wood = { material: "wood" as const, color: "#9A6B42" };
  const glass = { material: "glass" as const, color: "#B9E3DE" };
  const metal = { material: "metal" as const, color: "#313B3D" };
  const legHeight = dimensions.height - dimensions.topThickness;
  const features: ModelFeature[] = [
    box(loungeFeatureIds.tableTop, "茶几木质台面", [width, dimensions.topThickness, depth], [0, dimensions.height - dimensions.topThickness / 2, 0], wood, transform, 22),
    box(loungeFeatureIds.tableShelf, "茶几玻璃置物层", [width * 0.78, dimensions.shelfThickness, depth * 0.72], [0, dimensions.shelfHeight, 0], glass, transform, 8),
  ];
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([xSide, zSide], index) => {
    features.push(box(
      `lounge-coffee-table-leg-${index + 1}`,
      `茶几支脚 ${index + 1}`,
      [42, legHeight, 42],
      [xSide! * (width / 2 - 85), legHeight / 2, zSide! * (depth / 2 - 75)],
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
  const dimensions = loungeDimensions.floorLamp;
  const shadeCenterY = dimensions.height - dimensions.shadeHeight / 2;
  return [
    cylinder(loungeFeatureIds.lampBase, "落地灯底座", dimensions.baseRadius, dimensions.baseHeight, [0, dimensions.baseHeight / 2, 0], metal, transform),
    cylinder(loungeFeatureIds.lampPole, "落地灯灯杆", dimensions.poleRadius, shadeCenterY, [0, shadeCenterY / 2, 0], metal, transform),
    cylinder(loungeFeatureIds.lampShade, "落地灯灯罩", dimensions.shadeRadius, dimensions.shadeHeight, [0, shadeCenterY, 0], { material: "fabric", color: "#D9CBA8" }, transform),
    cylinder(
      loungeFeatureIds.lampLight,
      "落地灯光源",
      96,
      30,
      [0, dimensions.height - dimensions.shadeHeight + 20, 0],
      { material: "glass", color: parameters.lampOn ? colors.accent : "#5B625F" },
      transform,
    ),
  ];
}

function createPlant(transform: LoungeComponentTransform): ModelFeature[] {
  const ceramic = { material: "default" as const, color: "#C77952" };
  const wood = { material: "wood" as const, color: "#73503A" };
  const leaf = { material: "fabric" as const, color: "#487B5C" };
  const dimensions = loungeDimensions.plant;
  const features: ModelFeature[] = [
    cylinder(loungeFeatureIds.plantPot, "绿植花盆", dimensions.potRadius, dimensions.potHeight, [0, dimensions.potHeight / 2, 0], ceramic, transform),
    cylinder("lounge-plant-pot-rim", "绿植花盆口沿", dimensions.potRadius + 20, 46, [0, dimensions.potHeight - 23, 0], ceramic, transform),
    cylinder(loungeFeatureIds.plantTrunk, "绿植主干", 36, 600, [0, 610, 0], wood, transform),
  ];
  for (let index = 0; index < 9; index += 1) {
    const angle = index * 40;
    const radians = angle * Math.PI / 180;
    const radius = index % 2 === 0 ? 130 : 180;
    features.push(box(
      `lounge-plant-leaf-${index + 1}`,
      `绿植叶片 ${index + 1}`,
      [170, 24, 330],
      [Math.sin(radians) * radius, 650 + index * 48, Math.cos(radians) * radius],
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
    [parameters.rugWidth, loungeDimensions.rug.thickness, parameters.rugWidth * loungeDimensions.rug.depthRatio],
    [0, loungeDimensions.rug.thickness / 2, 0],
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
