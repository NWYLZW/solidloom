import type {
  ArticulationJoint,
  BoxFeature,
  CreateModelInput,
  CylinderFeature,
  FeatureAppearance,
  FeatureGroup,
  ModelFeature,
  ModelVariable,
  Vector3Tuple,
} from "@solidloom/shared";
import type {
  RestroomDoorLeafBounds,
  RestroomMirrorParameters,
  RestroomPartitionParameters,
  RestroomStallDoorParameters,
  RestroomToiletParameters,
  RestroomUrinalBankParameters,
  RestroomVanityParameters,
} from "./types.js";

const ceramic: FeatureAppearance = { material: "default", color: "#E8EEEE" };
const ceramicShadow: FeatureAppearance = { material: "default", color: "#C7D2D1" };
const darkMetal: FeatureAppearance = { material: "metal", color: "#344449" };
const brushedMetal: FeatureAppearance = { material: "metal", color: "#A7B7BA" };
const partitionPanel: FeatureAppearance = { material: "plastic", color: "#567C79" };
const partitionEdge: FeatureAppearance = { material: "metal", color: "#8CA1A1" };
const charcoalPlastic: FeatureAppearance = { material: "plastic", color: "#26383C" };
const counter: FeatureAppearance = { material: "default", color: "#D7E0DF" };
const vanityFront: FeatureAppearance = { material: "wood", color: "#8B6950" };
const mirrorGlass: FeatureAppearance = { material: "glass", color: "#9ED7D6" };
const mirrorBacking: FeatureAppearance = { material: "default", color: "#253438" };

export const restroomAssetIds = {
  partition: "cyber-factory-restroom-partition",
  stallDoor: "cyber-factory-restroom-stall-door",
  toilet: "cyber-factory-restroom-toilet",
  urinalBank: "cyber-factory-restroom-urinal-bank",
  vanity: "cyber-factory-restroom-vanity",
  mirror: "cyber-factory-restroom-mirror",
  accessibleDoor: "cyber-factory-restroom-accessible-door",
  accessibleVanity: "cyber-factory-restroom-accessible-vanity",
  accessibilitySupport: "cyber-factory-restroom-accessibility-support",
} as const;

export const restroomGroupIds = {
  partition: "restroom-partition-group",
  doorFrame: "restroom-stall-door-frame-group",
  doorLeaf: "restroom-stall-door-leaf-group",
  toilet: "restroom-toilet-group",
  urinals: "restroom-urinal-bank-group",
  urinalDividers: "restroom-urinal-divider-group",
  vanity: "restroom-vanity-group",
  mirror: "restroom-mirror-group",
  accessibleDoorFrame: "restroom-accessible-door-frame-group",
  accessibleDoorLeaf: "restroom-accessible-door-leaf-group",
  accessibleVanity: "restroom-accessible-vanity-group",
  accessibilitySupport: "restroom-accessibility-support-group",
} as const;

export const restroomJointIds = {
  stallDoor: "restroom-stall-door-hinge",
  accessibleDoor: "restroom-accessible-door-hinge",
} as const;

export const restroomParameterLimits = {
  partition: {
    width: { minimum: 900, maximum: 2_200, step: 50 },
    panelHeight: { minimum: 1_650, maximum: 2_200, step: 50 },
    bottomGap: { minimum: 100, maximum: 250, step: 10 },
    thickness: { minimum: 25, maximum: 60, step: 5 },
  },
  stallDoor: {
    openingWidth: { minimum: 760, maximum: 1_050, step: 10 },
    doorHeight: { minimum: 1_650, maximum: 2_100, step: 50 },
    bottomGap: { minimum: 100, maximum: 250, step: 10 },
    thickness: { minimum: 25, maximum: 55, step: 5 },
    openAngle: { minimum: 70, maximum: 92, step: 1 },
  },
  toilet: {
    bowlWidth: { minimum: 350, maximum: 430, step: 10 },
    seatHeight: { minimum: 400, maximum: 480, step: 10 },
    depth: { minimum: 660, maximum: 780, step: 10 },
    tankHeight: { minimum: 680, maximum: 850, step: 10 },
  },
  urinalBank: {
    count: { minimum: 1, maximum: 6, step: 1 },
    centerSpacing: { minimum: 620, maximum: 900, step: 10 },
    urinalWidth: { minimum: 340, maximum: 440, step: 10 },
    rimHeight: { minimum: 560, maximum: 720, step: 10 },
    projection: { minimum: 300, maximum: 430, step: 10 },
    dividerDepth: { minimum: 450, maximum: 650, step: 10 },
  },
  vanity: {
    width: { minimum: 800, maximum: 2_400, step: 50 },
    depth: { minimum: 480, maximum: 650, step: 10 },
    counterHeight: { minimum: 800, maximum: 930, step: 10 },
    basinCount: { minimum: 1, maximum: 3, step: 1 },
    basinSpacing: { minimum: 620, maximum: 850, step: 10 },
  },
  mirror: {
    width: { minimum: 600, maximum: 2_400, step: 50 },
    height: { minimum: 650, maximum: 1_200, step: 50 },
    bottomHeight: { minimum: 900, maximum: 1_250, step: 10 },
    frameThickness: { minimum: 20, maximum: 60, step: 5 },
  },
} as const;

export const defaultRestroomPartitionParameters: RestroomPartitionParameters = {
  width: 1_800,
  panelHeight: 1_900,
  bottomGap: 150,
  thickness: 38,
};

export const defaultRestroomStallDoorParameters: RestroomStallDoorParameters = {
  openingWidth: 900,
  doorHeight: 1_850,
  bottomGap: 150,
  thickness: 38,
  openAngle: 88,
};

export const defaultRestroomToiletParameters: RestroomToiletParameters = {
  bowlWidth: 390,
  seatHeight: 430,
  depth: 720,
  tankHeight: 760,
};

export const defaultRestroomUrinalBankParameters: RestroomUrinalBankParameters = {
  count: 3,
  centerSpacing: 700,
  urinalWidth: 380,
  rimHeight: 620,
  projection: 360,
  dividerEnabled: true,
  dividerDepth: 520,
};

export const defaultRestroomVanityParameters: RestroomVanityParameters = {
  width: 1_600,
  depth: 560,
  counterHeight: 860,
  basinCount: 2,
  basinSpacing: 700,
};

export const defaultRestroomMirrorParameters: RestroomMirrorParameters = {
  width: 1_600,
  height: 800,
  bottomHeight: 1_050,
  frameThickness: 35,
};

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
    featureIds: features.map(({ id: featureId }) => featureId),
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  };
}

function variables(entries: Array<[string, string, number, boolean?]>): ModelVariable[] {
  return entries.map(([id, label, value, unitless]) => ({
    id,
    label,
    value,
    ...(unitless ? {} : { unit: "mm" as const }),
  }));
}

function finite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} 必须是有限数字。`);
  return value;
}

function range(value: number, minimum: number, maximum: number, label: string) {
  finite(value, label);
  if (value < minimum || value > maximum) {
    throw new Error(`${label} 必须位于 ${minimum}–${maximum} mm。`);
  }
  return value;
}

function integerRange(value: number, minimum: number, maximum: number, label: string) {
  finite(value, label);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} 必须是 ${minimum}–${maximum} 的整数。`);
  }
  return value;
}

export function normalizeRestroomPartitionParameters(
  input: Partial<RestroomPartitionParameters> = {},
): RestroomPartitionParameters {
  const value = { ...defaultRestroomPartitionParameters, ...input };
  range(value.width, 900, 2_200, "partition.width");
  range(value.panelHeight, 1_650, 2_200, "partition.panelHeight");
  range(value.bottomGap, 100, 250, "partition.bottomGap");
  range(value.thickness, 25, 60, "partition.thickness");
  return value;
}

export function normalizeRestroomStallDoorParameters(
  input: Partial<RestroomStallDoorParameters> = {},
): RestroomStallDoorParameters {
  const value = { ...defaultRestroomStallDoorParameters, ...input };
  range(value.openingWidth, 760, 1_050, "stallDoor.openingWidth");
  range(value.doorHeight, 1_650, 2_100, "stallDoor.doorHeight");
  range(value.bottomGap, 100, 250, "stallDoor.bottomGap");
  range(value.thickness, 25, 55, "stallDoor.thickness");
  range(value.openAngle, 70, 92, "stallDoor.openAngle");
  if (value.doorHeight + value.bottomGap > 2_250) {
    throw new Error("stallDoor 的门顶高度不得超过 2250 mm。");
  }
  return value;
}

export function normalizeRestroomToiletParameters(
  input: Partial<RestroomToiletParameters> = {},
): RestroomToiletParameters {
  const value = { ...defaultRestroomToiletParameters, ...input };
  range(value.bowlWidth, 350, 430, "toilet.bowlWidth");
  range(value.seatHeight, 400, 480, "toilet.seatHeight");
  range(value.depth, 660, 780, "toilet.depth");
  range(value.tankHeight, 680, 850, "toilet.tankHeight");
  if (value.tankHeight < value.seatHeight + 210) {
    throw new Error("toilet.tankHeight 必须高于座圈并保留水箱空间。");
  }
  return value;
}

export function normalizeRestroomUrinalBankParameters(
  input: Partial<RestroomUrinalBankParameters> = {},
): RestroomUrinalBankParameters {
  const value = { ...defaultRestroomUrinalBankParameters, ...input };
  integerRange(value.count, 1, 6, "urinalBank.count");
  range(value.centerSpacing, 620, 900, "urinalBank.centerSpacing");
  range(value.urinalWidth, 340, 440, "urinalBank.urinalWidth");
  range(value.rimHeight, 560, 720, "urinalBank.rimHeight");
  range(value.projection, 300, 430, "urinalBank.projection");
  range(value.dividerDepth, 450, 650, "urinalBank.dividerDepth");
  if (value.centerSpacing - value.urinalWidth < 240) {
    throw new Error("urinalBank.centerSpacing 必须在相邻小便器之间保留至少 240 mm 净距。");
  }
  if (value.dividerDepth <= value.projection + 60) {
    throw new Error("urinalBank.dividerDepth 必须比小便器投影至少多 60 mm。");
  }
  return value;
}

export function normalizeRestroomVanityParameters(
  input: Partial<RestroomVanityParameters> = {},
): RestroomVanityParameters {
  const value = { ...defaultRestroomVanityParameters, ...input };
  range(value.width, 800, 2_400, "vanity.width");
  range(value.depth, 480, 650, "vanity.depth");
  range(value.counterHeight, 800, 930, "vanity.counterHeight");
  integerRange(value.basinCount, 1, 3, "vanity.basinCount");
  range(value.basinSpacing, 620, 850, "vanity.basinSpacing");
  const span = (value.basinCount - 1) * value.basinSpacing + 520;
  if (span > value.width - 80) {
    throw new Error("vanity.width 无法容纳当前洗手盆数量和中心距。");
  }
  return value;
}

export function normalizeRestroomMirrorParameters(
  input: Partial<RestroomMirrorParameters> = {},
): RestroomMirrorParameters {
  const value = { ...defaultRestroomMirrorParameters, ...input };
  range(value.width, 600, 2_400, "mirror.width");
  range(value.height, 650, 1_200, "mirror.height");
  range(value.bottomHeight, 900, 1_250, "mirror.bottomHeight");
  range(value.frameThickness, 20, 60, "mirror.frameThickness");
  return value;
}

export function restroomUrinalCenterX(
  parameters: Pick<RestroomUrinalBankParameters, "count" | "centerSpacing">,
  index: number,
) {
  if (!Number.isInteger(index) || index < 0 || index >= parameters.count) {
    throw new Error(`小便器索引 ${index} 超出范围。`);
  }
  return (index - (parameters.count - 1) / 2) * parameters.centerSpacing;
}

export function restroomUrinalDividerX(
  parameters: Pick<RestroomUrinalBankParameters, "count" | "centerSpacing">,
  index: number,
) {
  if (!Number.isInteger(index) || index < 0 || index >= parameters.count - 1) {
    throw new Error(`小便器挡板索引 ${index} 超出范围。`);
  }
  return (restroomUrinalCenterX(parameters, index) + restroomUrinalCenterX(parameters, index + 1)) / 2;
}

export function restroomVanityBasinX(
  parameters: Pick<RestroomVanityParameters, "basinCount" | "basinSpacing">,
  index: number,
) {
  if (!Number.isInteger(index) || index < 0 || index >= parameters.basinCount) {
    throw new Error(`洗手盆索引 ${index} 超出范围。`);
  }
  return (index - (parameters.basinCount - 1) / 2) * parameters.basinSpacing;
}

export function restroomDoorLeafBounds(
  input: Partial<RestroomStallDoorParameters> = {},
  angle = 0,
): RestroomDoorLeafBounds {
  const parameters = normalizeRestroomStallDoorParameters(input);
  const leafWidth = parameters.openingWidth - 32;
  const hingeX = -parameters.openingWidth / 2 + 16;
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const corners = [
    [0, -parameters.thickness / 2],
    [0, parameters.thickness / 2],
    [leafWidth, -parameters.thickness / 2],
    [leafWidth, parameters.thickness / 2],
  ].map(([x, z]) => ({
    x: hingeX + x! * cosine + z! * sine,
    z: -x! * sine + z! * cosine,
  }));
  return {
    minimumX: Math.min(...corners.map(({ x }) => x)),
    maximumX: Math.max(...corners.map(({ x }) => x)),
    minimumZ: Math.min(...corners.map(({ z }) => z)),
    maximumZ: Math.max(...corners.map(({ z }) => z)),
  };
}

export function createRestroomPartitionModel(
  input: Partial<RestroomPartitionParameters> = {},
): CreateModelInput {
  const parameters = normalizeRestroomPartitionParameters(input);
  const postHeight = parameters.panelHeight + parameters.bottomGap + 50;
  const panel = box(
    "restroom-partition-panel",
    "悬空隔断板",
    [parameters.width - 70, parameters.panelHeight, parameters.thickness],
    [0, parameters.bottomGap + parameters.panelHeight / 2, 0],
    partitionPanel,
    18,
  );
  const leftPost = box(
    "restroom-partition-left-post",
    "隔断左立柱",
    [42, postHeight, 42],
    [-parameters.width / 2 + 21, postHeight / 2, 0],
    partitionEdge,
    8,
  );
  const rightPost = box(
    "restroom-partition-right-post",
    "隔断右立柱",
    [42, postHeight, 42],
    [parameters.width / 2 - 21, postHeight / 2, 0],
    partitionEdge,
    8,
  );
  const feet = [-1, 1].map((side, index) => cylinder(
    `restroom-partition-foot-${String(index + 1).padStart(2, "0")}`,
    side < 0 ? "隔断左地脚" : "隔断右地脚",
    46,
    14,
    [side * (parameters.width / 2 - 21), 7, 0],
    darkMetal,
  ));
  const features: ModelFeature[] = [panel, leftPost, rightPost, ...feet];
  return {
    name: "厕所隔断组件",
    description: "可独立布置的悬空隔断板、立柱和地脚。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [group(restroomGroupIds.partition, "厕所隔断", features)],
      variables: variables([
        ["partition-width", "隔断宽度", parameters.width],
        ["partition-panel-height", "隔断板高度", parameters.panelHeight],
        ["partition-bottom-gap", "底部净空", parameters.bottomGap],
        ["partition-thickness", "隔断厚度", parameters.thickness],
      ]),
    },
  };
}

export function createRestroomStallDoorModel(
  input: Partial<RestroomStallDoorParameters> = {},
): CreateModelInput {
  const parameters = normalizeRestroomStallDoorParameters(input);
  const frameHeight = parameters.bottomGap + parameters.doorHeight + 60;
  const postWidth = 48;
  const leafWidth = parameters.openingWidth - 32;
  const leafY = parameters.bottomGap + parameters.doorHeight / 2;
  const hingeX = -parameters.openingWidth / 2 + 16;
  const frameFeatures: ModelFeature[] = [
    box("restroom-stall-door-left-post", "隔间门左门柱", [postWidth, frameHeight, 50], [-(parameters.openingWidth + postWidth) / 2, frameHeight / 2, 0], partitionEdge, 8),
    box("restroom-stall-door-right-post", "隔间门右门柱", [postWidth, frameHeight, 50], [(parameters.openingWidth + postWidth) / 2, frameHeight / 2, 0], partitionEdge, 8),
    box("restroom-stall-door-head-rail", "隔间门上横梁", [parameters.openingWidth + postWidth * 2, 46, 50], [0, frameHeight - 23, 0], partitionEdge, 8),
  ];
  const leafFeatures: ModelFeature[] = [
    box("restroom-stall-door-leaf", "隔间门扇", [leafWidth, parameters.doorHeight, parameters.thickness], [hingeX + leafWidth / 2, leafY, 0], partitionPanel, 18),
    cylinder("restroom-stall-door-handle-front", "隔间门外侧把手", 24, 34, [hingeX + leafWidth - 90, leafY, parameters.thickness / 2 + 17], brushedMetal, [90, 0, 0]),
    cylinder("restroom-stall-door-handle-inside", "隔间门内侧把手", 24, 34, [hingeX + leafWidth - 90, leafY, -parameters.thickness / 2 - 17], brushedMetal, [90, 0, 0]),
    box("restroom-stall-door-occupancy-indicator", "隔间门占用指示", [54, 36, 12], [hingeX + leafWidth - 145, leafY + 120, parameters.thickness / 2 + 8], charcoalPlastic, 6),
  ];
  const hinge: ArticulationJoint = {
    id: restroomJointIds.stallDoor,
    name: "隔间门铰链",
    type: "revolute",
    groupId: restroomGroupIds.doorLeaf,
    pivot: [hingeX, leafY, 0],
    axis: [0, 1, 0],
    value: 0,
    restValue: 0,
    min: -parameters.openAngle,
    max: 0,
  };
  return {
    name: "厕所隔间门组件",
    description: "向外开启的参数化隔间门、门框、门锁和铰链。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [...frameFeatures, ...leafFeatures],
      groups: [
        group(restroomGroupIds.doorFrame, "隔间门框", frameFeatures),
        group(restroomGroupIds.doorLeaf, "隔间门扇", leafFeatures),
      ],
      joints: [hinge],
      poses: [
        { id: "restroom-stall-door-closed", name: "隔间门关闭", durationMs: 420, jointValues: { [restroomJointIds.stallDoor]: 0 } },
        { id: "restroom-stall-door-open", name: "隔间门打开", durationMs: 520, jointValues: { [restroomJointIds.stallDoor]: -parameters.openAngle } },
      ],
      variables: variables([
        ["stall-door-opening-width", "门洞宽度", parameters.openingWidth],
        ["stall-door-height", "门扇高度", parameters.doorHeight],
        ["stall-door-bottom-gap", "门扇底部净空", parameters.bottomGap],
        ["stall-door-thickness", "门扇厚度", parameters.thickness],
        ["stall-door-open-angle", "最大开启角", parameters.openAngle, true],
      ]),
    },
  };
}

export function createRestroomToiletModel(
  input: Partial<RestroomToiletParameters> = {},
): CreateModelInput {
  const parameters = normalizeRestroomToiletParameters(input);
  const bowlRadius = parameters.bowlWidth / 2;
  const bowlCenterZ = parameters.depth * 0.12;
  const tankDepth = Math.min(220, parameters.depth * 0.31);
  const tankWidth = parameters.bowlWidth + 40;
  const tankCenterZ = -parameters.depth / 2 + tankDepth / 2;
  const features: ModelFeature[] = [
    cylinder("restroom-toilet-pedestal", "坐便器落地基座", bowlRadius * 0.58, parameters.seatHeight - 105, [0, (parameters.seatHeight - 105) / 2, -8], ceramicShadow),
    cylinder("restroom-toilet-bowl", "坐便器陶瓷盆体", bowlRadius, 210, [0, parameters.seatHeight - 105, bowlCenterZ], ceramic),
    cylinder("restroom-toilet-seat", "坐便器座圈", bowlRadius * 0.92, 26, [0, parameters.seatHeight + 13, bowlCenterZ + 18], charcoalPlastic),
    box("restroom-toilet-tank", "坐便器水箱", [tankWidth, parameters.tankHeight - parameters.seatHeight + 90, tankDepth], [0, (parameters.tankHeight + parameters.seatHeight - 90) / 2, tankCenterZ], ceramic, 34),
    box("restroom-toilet-tank-lid", "坐便器水箱盖", [tankWidth + 18, 32, tankDepth + 14], [0, parameters.tankHeight + 16, tankCenterZ], ceramic, 15),
    cylinder("restroom-toilet-flush-button", "坐便器冲水按钮", 27, 16, [0, parameters.tankHeight + 40, tankCenterZ], brushedMetal),
    box("restroom-toilet-seat-lid", "坐便器座盖", [parameters.bowlWidth * 0.82, 30, parameters.depth * 0.42], [0, parameters.seatHeight + 22, bowlCenterZ - 12], ceramicShadow, 85),
  ];
  return {
    name: "落地式坐便器组件",
    description: "真实毫米尺度的落地式坐便器、水箱、座圈和冲水按钮。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [group(restroomGroupIds.toilet, "坐便器", features)],
      variables: variables([
        ["toilet-bowl-width", "坐便器宽度", parameters.bowlWidth],
        ["toilet-seat-height", "座圈高度", parameters.seatHeight],
        ["toilet-depth", "坐便器深度", parameters.depth],
        ["toilet-tank-height", "水箱总高", parameters.tankHeight],
      ]),
    },
  };
}

export function createRestroomUrinalBankModel(
  input: Partial<RestroomUrinalBankParameters> = {},
): CreateModelInput {
  const parameters = normalizeRestroomUrinalBankParameters(input);
  const urinalFeatures: ModelFeature[] = [];
  for (let index = 0; index < parameters.count; index += 1) {
    const suffix = String(index + 1).padStart(2, "0");
    const x = restroomUrinalCenterX(parameters, index);
    const backHeight = 600;
    urinalFeatures.push(
      box(`restroom-urinal-${suffix}-back`, `第 ${index + 1} 个小便器背板`, [parameters.urinalWidth, backHeight, 110], [x, parameters.rimHeight + 155, 55], ceramic, 85),
      cylinder(`restroom-urinal-${suffix}-bowl`, `第 ${index + 1} 个小便器盆体`, parameters.urinalWidth * 0.44, parameters.projection - 105, [x, parameters.rimHeight - 100, 105 + (parameters.projection - 105) / 2], ceramic, [90, 0, 0]),
      box(`restroom-urinal-${suffix}-rim`, `第 ${index + 1} 个小便器前沿`, [parameters.urinalWidth * 0.9, 70, parameters.projection * 0.72], [x, parameters.rimHeight, parameters.projection * 0.58], ceramic, 65),
      cylinder(`restroom-urinal-${suffix}-drain`, `第 ${index + 1} 个小便器排水口`, 34, 12, [x, parameters.rimHeight + 38, parameters.projection * 0.58], darkMetal),
      box(`restroom-urinal-${suffix}-sensor`, `第 ${index + 1} 个小便器感应器`, [82, 105, 40], [x, parameters.rimHeight + 385, 132], charcoalPlastic, 16),
    );
  }
  const dividerFeatures: ModelFeature[] = [];
  if (parameters.dividerEnabled) {
    for (let index = 0; index < parameters.count - 1; index += 1) {
      dividerFeatures.push(box(
        `restroom-urinal-divider-${String(index + 1).padStart(2, "0")}`,
        `第 ${index + 1} 块小便器挡板`,
        [30, 760, parameters.dividerDepth],
        [restroomUrinalDividerX(parameters, index), parameters.rimHeight + 230, parameters.dividerDepth / 2],
        partitionPanel,
        14,
      ));
    }
  }
  return {
    name: "壁挂式小便器组合",
    description: "按中心距连续排列的壁挂小便器，可选择在相邻器具中线间生成挡板。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [...urinalFeatures, ...dividerFeatures],
      groups: [
        group(restroomGroupIds.urinals, "壁挂小便器", urinalFeatures),
        group(restroomGroupIds.urinalDividers, "小便器挡板", dividerFeatures),
      ],
      variables: variables([
        ["urinal-count", "小便器数量", parameters.count, true],
        ["urinal-center-spacing", "小便器中心距", parameters.centerSpacing],
        ["urinal-width", "小便器宽度", parameters.urinalWidth],
        ["urinal-rim-height", "小便器前沿高度", parameters.rimHeight],
        ["urinal-projection", "小便器墙面投影", parameters.projection],
        ["urinal-divider-depth", "挡板深度", parameters.dividerDepth],
      ]),
    },
  };
}

export function createRestroomVanityModel(
  input: Partial<RestroomVanityParameters> = {},
): CreateModelInput {
  const parameters = normalizeRestroomVanityParameters(input);
  const features: ModelFeature[] = [
    box("restroom-vanity-plinth", "洗手台落地踢脚", [parameters.width - 90, 100, parameters.depth - 80], [0, 50, -25], charcoalPlastic, 12),
    box("restroom-vanity-cabinet", "洗手台柜体", [parameters.width - 40, parameters.counterHeight - 125, parameters.depth - 45], [0, (parameters.counterHeight - 125) / 2 + 100, -15], vanityFront, 22),
    box("restroom-vanity-counter", "洗手台台面", [parameters.width, 70, parameters.depth], [0, parameters.counterHeight - 35, 0], counter, 28),
    box("restroom-vanity-backsplash", "洗手台挡水沿", [parameters.width, 150, 30], [0, parameters.counterHeight + 45, -parameters.depth / 2 + 15], counter, 10),
  ];
  for (let index = 0; index < parameters.basinCount; index += 1) {
    const suffix = String(index + 1).padStart(2, "0");
    const x = restroomVanityBasinX(parameters, index);
    features.push(
      cylinder(`restroom-vanity-basin-${suffix}`, `第 ${index + 1} 个洗手盆`, 235, 50, [x, parameters.counterHeight + 4, 20], ceramic, [0, 0, 0]),
      cylinder(`restroom-vanity-drain-${suffix}`, `第 ${index + 1} 个洗手盆排水口`, 28, 12, [x, parameters.counterHeight + 35, 20], darkMetal),
      cylinder(`restroom-vanity-faucet-${suffix}`, `第 ${index + 1} 个感应水龙头`, 24, 210, [x, parameters.counterHeight + 105, -parameters.depth * 0.27], brushedMetal),
      box(`restroom-vanity-faucet-head-${suffix}`, `第 ${index + 1} 个水龙头出水端`, [56, 42, 150], [x, parameters.counterHeight + 195, -parameters.depth * 0.16], brushedMetal, 18),
    );
  }
  return {
    name: "组合式洗手台",
    description: "带落地柜体、台面、洗手盆和感应水龙头的参数化洗手台。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [group(restroomGroupIds.vanity, "组合式洗手台", features)],
      variables: variables([
        ["vanity-width", "洗手台宽度", parameters.width],
        ["vanity-depth", "洗手台深度", parameters.depth],
        ["vanity-counter-height", "台面高度", parameters.counterHeight],
        ["vanity-basin-count", "洗手盆数量", parameters.basinCount, true],
        ["vanity-basin-spacing", "洗手盆中心距", parameters.basinSpacing],
      ]),
    },
  };
}

export function createRestroomMirrorModel(
  input: Partial<RestroomMirrorParameters> = {},
): CreateModelInput {
  const parameters = normalizeRestroomMirrorParameters(input);
  const centerY = parameters.bottomHeight + parameters.height / 2;
  const glassWidth = parameters.width - parameters.frameThickness * 2;
  const glassHeight = parameters.height - parameters.frameThickness * 2;
  const features: ModelFeature[] = [
    box("restroom-mirror-backing", "镜面背板", [parameters.width, parameters.height, 26], [0, centerY, 13], mirrorBacking, 20),
    box("restroom-mirror-glass", "镜面", [glassWidth, glassHeight, 12], [0, centerY, 32], mirrorGlass, 12),
    box("restroom-mirror-frame-top", "镜面上边框", [parameters.width, parameters.frameThickness, 35], [0, parameters.bottomHeight + parameters.height - parameters.frameThickness / 2, 27], darkMetal, 8),
    box("restroom-mirror-frame-bottom", "镜面下边框", [parameters.width, parameters.frameThickness, 35], [0, parameters.bottomHeight + parameters.frameThickness / 2, 27], darkMetal, 8),
    box("restroom-mirror-frame-left", "镜面左边框", [parameters.frameThickness, glassHeight, 35], [-parameters.width / 2 + parameters.frameThickness / 2, centerY, 27], darkMetal, 8),
    box("restroom-mirror-frame-right", "镜面右边框", [parameters.frameThickness, glassHeight, 35], [parameters.width / 2 - parameters.frameThickness / 2, centerY, 27], darkMetal, 8),
  ];
  return {
    name: "壁挂镜面组件",
    description: "以墙面为局部 Z=0 安装基准的镜面、背板和金属边框。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [group(restroomGroupIds.mirror, "壁挂镜面", features)],
      variables: variables([
        ["mirror-width", "镜面宽度", parameters.width],
        ["mirror-height", "镜面高度", parameters.height],
        ["mirror-bottom-height", "镜面底边高度", parameters.bottomHeight],
        ["mirror-frame-thickness", "镜框宽度", parameters.frameThickness],
      ]),
    },
  };
}
