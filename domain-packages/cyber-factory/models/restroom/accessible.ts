import {
  assertModelAssetDefinition,
  type ArticulationJoint,
  type BoxFeature,
  type CreateModelInput,
  type CylinderFeature,
  type FeatureAppearance,
  type FeatureGroup,
  type ModelAssetDefinition,
  type ModelAssetManifest,
  type ModelFeature,
  type ModelVariable,
  type Vector3Tuple,
} from "@solidloom/shared";
import { restroomAssetIds, restroomGroupIds, restroomJointIds } from "./model.js";
import type { RestroomDoorLeafBounds } from "./types.js";

export type RestroomAccessibleTransferSide = "left" | "right";

export interface RestroomAccessibleDoorParameters {
  openingWidth: number;
  doorHeight: number;
  thickness: number;
  openAngle: number;
}

export interface RestroomAccessibleVanityParameters {
  width: number;
  depth: number;
  counterHeight: number;
  kneeClearanceHeight: number;
}

export interface RestroomAccessibilitySupportParameters {
  transferSide: RestroomAccessibleTransferSide;
  railHeight: number;
  railLength: number;
  railDiameter: number;
  callHeight: number;
}

const panel: FeatureAppearance = { material: "plastic", color: "#567C79" };
const metal: FeatureAppearance = { material: "metal", color: "#A7B7BA" };
const ceramic: FeatureAppearance = { material: "default", color: "#D7E0DF" };
const darkPlastic: FeatureAppearance = { material: "plastic", color: "#26383C" };
const accessBlue: FeatureAppearance = { material: "plastic", color: "#3D83C5" };
const emergencyRed: FeatureAppearance = { material: "plastic", color: "#D95757" };

export const restroomAccessibleParameterLimits = {
  door: {
    openingWidth: { minimum: 900, maximum: 1_200, step: 10 },
    doorHeight: { minimum: 2_000, maximum: 2_300, step: 50 },
    thickness: { minimum: 35, maximum: 60, step: 5 },
    openAngle: { minimum: 80, maximum: 100, step: 1 },
  },
  vanity: {
    width: { minimum: 700, maximum: 1_000, step: 10 },
    depth: { minimum: 480, maximum: 600, step: 10 },
    counterHeight: { minimum: 760, maximum: 850, step: 10 },
    kneeClearanceHeight: { minimum: 640, maximum: 720, step: 10 },
  },
  support: {
    railHeight: { minimum: 680, maximum: 850, step: 10 },
    railLength: { minimum: 600, maximum: 850, step: 10 },
    railDiameter: { minimum: 32, maximum: 50, step: 2 },
    callHeight: { minimum: 800, maximum: 1_050, step: 10 },
  },
} as const;

export const defaultRestroomAccessibleDoorParameters: RestroomAccessibleDoorParameters = {
  openingWidth: 1_050,
  doorHeight: 2_100,
  thickness: 45,
  openAngle: 92,
};

export const defaultRestroomAccessibleVanityParameters: RestroomAccessibleVanityParameters = {
  width: 820,
  depth: 520,
  counterHeight: 800,
  kneeClearanceHeight: 680,
};

export const defaultRestroomAccessibilitySupportParameters: RestroomAccessibilitySupportParameters = {
  transferSide: "left",
  railHeight: 760,
  railLength: 720,
  railDiameter: 38,
  callHeight: 900,
};

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

export function normalizeRestroomAccessibleDoorParameters(
  input: Partial<RestroomAccessibleDoorParameters> = {},
): RestroomAccessibleDoorParameters {
  const value = { ...defaultRestroomAccessibleDoorParameters, ...input };
  range(value.openingWidth, 900, 1_200, "accessibleDoor.openingWidth");
  range(value.doorHeight, 2_000, 2_300, "accessibleDoor.doorHeight");
  range(value.thickness, 35, 60, "accessibleDoor.thickness");
  range(value.openAngle, 80, 100, "accessibleDoor.openAngle");
  return value;
}

export function normalizeRestroomAccessibleVanityParameters(
  input: Partial<RestroomAccessibleVanityParameters> = {},
): RestroomAccessibleVanityParameters {
  const value = { ...defaultRestroomAccessibleVanityParameters, ...input };
  range(value.width, 700, 1_000, "accessibleVanity.width");
  range(value.depth, 480, 600, "accessibleVanity.depth");
  range(value.counterHeight, 760, 850, "accessibleVanity.counterHeight");
  range(value.kneeClearanceHeight, 640, 720, "accessibleVanity.kneeClearanceHeight");
  if (value.kneeClearanceHeight > value.counterHeight - 70) {
    throw new Error("accessibleVanity.kneeClearanceHeight 必须低于台面并保留结构厚度。");
  }
  return value;
}

export function normalizeRestroomAccessibilitySupportParameters(
  input: Partial<RestroomAccessibilitySupportParameters> = {},
): RestroomAccessibilitySupportParameters {
  const value = { ...defaultRestroomAccessibilitySupportParameters, ...input };
  if (value.transferSide !== "left" && value.transferSide !== "right") {
    throw new Error("accessibilitySupport.transferSide 只能是 left 或 right。");
  }
  range(value.railHeight, 680, 850, "accessibilitySupport.railHeight");
  range(value.railLength, 600, 850, "accessibilitySupport.railLength");
  range(value.railDiameter, 32, 50, "accessibilitySupport.railDiameter");
  range(value.callHeight, 800, 1_050, "accessibilitySupport.callHeight");
  return value;
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

function placement(): ModelAssetManifest["placement"] {
  return {
    upAxis: "y",
    groundY: 0,
    origin: [0, 0, 0],
    defaultScale: [1, 1, 1],
  };
}

function featureIds(model: CreateModelInput) {
  return model.featureGraph!.features.map(({ id }) => id);
}

function idsByMaterial(model: CreateModelInput, material: string) {
  return model.featureGraph!.features
    .filter((feature) => feature.appearance?.material === material)
    .map(({ id }) => id);
}

export function restroomAccessibleDoorLeafBounds(
  input: Partial<RestroomAccessibleDoorParameters> = {},
  angle = 0,
): RestroomDoorLeafBounds {
  const parameters = normalizeRestroomAccessibleDoorParameters(input);
  const leafWidth = parameters.openingWidth - 40;
  const hingeX = -parameters.openingWidth / 2 + 20;
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

export function createRestroomAccessibleDoorModel(
  input: Partial<RestroomAccessibleDoorParameters> = {},
): CreateModelInput {
  const parameters = normalizeRestroomAccessibleDoorParameters(input);
  const postWidth = 58;
  const frameHeight = parameters.doorHeight + 70;
  const leafWidth = parameters.openingWidth - 40;
  const hingeX = -parameters.openingWidth / 2 + 20;
  const frameFeatures: ModelFeature[] = [
    box("restroom-accessible-door-left-post", "无障碍门左门框", [postWidth, frameHeight, 70], [-(parameters.openingWidth + postWidth) / 2, frameHeight / 2, 0], metal, 8),
    box("restroom-accessible-door-right-post", "无障碍门右门框", [postWidth, frameHeight, 70], [(parameters.openingWidth + postWidth) / 2, frameHeight / 2, 0], metal, 8),
    box("restroom-accessible-door-head", "无障碍门上门框", [parameters.openingWidth + postWidth * 2, 70, 70], [0, parameters.doorHeight + 35, 0], metal, 8),
  ];
  const leafFeatures: ModelFeature[] = [
    box("restroom-accessible-door-leaf", "无障碍厕所门扇", [leafWidth, parameters.doorHeight, parameters.thickness], [hingeX + leafWidth / 2, parameters.doorHeight / 2, 0], panel, 20),
    cylinder("restroom-accessible-door-handle-front", "无障碍门外侧把手", 24, 42, [hingeX + leafWidth - 110, 1_000, parameters.thickness / 2 + 21], metal, [90, 0, 0]),
    cylinder("restroom-accessible-door-handle-inside", "无障碍门内侧把手", 24, 42, [hingeX + leafWidth - 110, 1_000, -parameters.thickness / 2 - 21], metal, [90, 0, 0]),
    box("restroom-accessible-door-symbol", "无障碍厕所标识", [230, 230, 18], [40, 1_480, parameters.thickness / 2 + 11], accessBlue, 30),
  ];
  const hinge: ArticulationJoint = {
    id: restroomJointIds.accessibleDoor,
    name: "无障碍厕所门铰链",
    type: "revolute",
    groupId: restroomGroupIds.accessibleDoorLeaf,
    pivot: [hingeX, parameters.doorHeight / 2, 0],
    axis: [0, 1, 0],
    value: 0,
    restValue: 0,
    min: -parameters.openAngle,
    max: 0,
  };
  return {
    name: "无障碍厕所入口门",
    description: "用于独立无障碍厕所的全高入口门、门框、标识和开合关节。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [...frameFeatures, ...leafFeatures],
      groups: [
        group(restroomGroupIds.accessibleDoorFrame, "无障碍入口门框", frameFeatures),
        group(restroomGroupIds.accessibleDoorLeaf, "无障碍入口门扇", leafFeatures),
      ],
      joints: [hinge],
      poses: [
        { id: "restroom-accessible-door-closed", name: "无障碍入口门关闭", durationMs: 480, jointValues: { [restroomJointIds.accessibleDoor]: 0 } },
        { id: "restroom-accessible-door-open", name: "无障碍入口门打开", durationMs: 620, jointValues: { [restroomJointIds.accessibleDoor]: -parameters.openAngle } },
      ],
      variables: variables([
        ["accessible-door-opening-width", "无障碍门洞宽度", parameters.openingWidth],
        ["accessible-door-height", "无障碍门高度", parameters.doorHeight],
        ["accessible-door-thickness", "无障碍门厚度", parameters.thickness],
        ["accessible-door-open-angle", "无障碍门开启角", parameters.openAngle, true],
      ]),
    },
  };
}

export function createRestroomAccessibleVanityModel(
  input: Partial<RestroomAccessibleVanityParameters> = {},
): CreateModelInput {
  const parameters = normalizeRestroomAccessibleVanityParameters(input);
  const basinRadius = Math.min(215, parameters.width * 0.27);
  const features: ModelFeature[] = [
    box("restroom-accessible-vanity-counter", "无障碍洗手台台面", [parameters.width, 70, parameters.depth], [0, parameters.counterHeight - 35, parameters.depth / 2], ceramic, 24),
    cylinder("restroom-accessible-vanity-basin", "无障碍洗手盆", basinRadius, 48, [0, parameters.counterHeight + 4, parameters.depth * 0.5], ceramic),
    box("restroom-accessible-vanity-backsplash", "无障碍洗手台挡水沿", [parameters.width, 140, 30], [0, parameters.counterHeight + 40, 15], ceramic, 10),
    box("restroom-accessible-vanity-front-apron", "无障碍洗手台前挡板", [parameters.width - 100, 105, 45], [0, parameters.counterHeight - 105, parameters.depth - 22.5], ceramic, 12),
    box("restroom-accessible-vanity-left-bracket", "无障碍洗手台左墙架", [80, 280, 180], [-parameters.width * 0.32, parameters.counterHeight - 210, 90], metal, 10),
    box("restroom-accessible-vanity-right-bracket", "无障碍洗手台右墙架", [80, 280, 180], [parameters.width * 0.32, parameters.counterHeight - 210, 90], metal, 10),
    cylinder("restroom-accessible-vanity-faucet", "无障碍感应水龙头", 24, 190, [0, parameters.counterHeight + 95, parameters.depth * 0.18], metal),
    box("restroom-accessible-vanity-faucet-head", "无障碍水龙头出水端", [56, 42, 150], [0, parameters.counterHeight + 175, parameters.depth * 0.29], metal, 18),
    cylinder("restroom-accessible-vanity-drain", "无障碍洗手台排水管", 34, 300, [0, parameters.counterHeight - 220, 125], darkPlastic),
  ];
  return {
    name: "壁挂无障碍洗手台",
    description: "无落地柜体、保留正面净空的壁挂洗手台、洗手盆和墙架。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [group(restroomGroupIds.accessibleVanity, "无障碍洗手台", features)],
      variables: variables([
        ["accessible-vanity-width", "无障碍洗手台宽度", parameters.width],
        ["accessible-vanity-depth", "无障碍洗手台深度", parameters.depth],
        ["accessible-vanity-counter-height", "无障碍洗手台台面高度", parameters.counterHeight],
        ["accessible-vanity-knee-clearance", "膝部净空高度", parameters.kneeClearanceHeight],
      ]),
    },
  };
}

export function createRestroomAccessibilitySupportModel(
  input: Partial<RestroomAccessibilitySupportParameters> = {},
): CreateModelInput {
  const parameters = normalizeRestroomAccessibilitySupportParameters(input);
  const transferSign = parameters.transferSide === "left" ? -1 : 1;
  const fixedSign = -transferSign;
  const radius = parameters.railDiameter / 2;
  const wallPlateZ = -505;
  const transferRailX = transferSign * 420;
  const fixedRailX = fixedSign * 420;
  const callX = transferSign * 720;
  const cordHeight = parameters.callHeight - 300;
  const features: ModelFeature[] = [
    cylinder("restroom-accessibility-rear-rail", "坐便器后侧横向扶手", radius, 840, [0, parameters.railHeight, -420], metal, [0, 0, 90]),
    cylinder("restroom-accessibility-transfer-rail", "转移侧折叠扶手", radius, parameters.railLength, [transferRailX, parameters.railHeight, -70], metal, [90, 0, 0]),
    cylinder("restroom-accessibility-fixed-rail", "固定侧扶手", radius, parameters.railLength - 100, [fixedRailX, parameters.railHeight, -120], metal, [90, 0, 0]),
    box("restroom-accessibility-transfer-plate", "转移侧扶手墙装底座", [160, 180, 28], [transferRailX, parameters.railHeight, wallPlateZ], metal, 18),
    box("restroom-accessibility-fixed-plate", "固定侧扶手墙装底座", [160, 180, 28], [fixedRailX, parameters.railHeight, wallPlateZ], metal, 18),
    box("restroom-accessibility-call-plate", "紧急呼叫面板", [220, 260, 35], [callX, parameters.callHeight, wallPlateZ], accessBlue, 22),
    cylinder("restroom-accessibility-call-button", "紧急呼叫按钮", 38, 20, [callX, parameters.callHeight, -477], emergencyRed, [90, 0, 0]),
    cylinder("restroom-accessibility-call-cord", "紧急呼叫拉绳", 8, cordHeight, [callX + transferSign * 55, 170 + cordHeight / 2, -485], emergencyRed),
    cylinder("restroom-accessibility-call-grip", "紧急呼叫拉环", 24, 90, [callX + transferSign * 55, 125, -485], emergencyRed),
  ];
  return {
    name: "无障碍扶手与紧急呼叫组件",
    description: "围绕坐便器布置的后侧扶手、转移侧扶手、固定扶手和紧急呼叫点。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features,
      groups: [group(restroomGroupIds.accessibilitySupport, "无障碍扶手与呼叫组件", features)],
      variables: variables([
        ["accessibility-transfer-side", "转移侧方向", transferSign, true],
        ["accessibility-rail-height", "扶手高度", parameters.railHeight],
        ["accessibility-rail-length", "扶手长度", parameters.railLength],
        ["accessibility-rail-diameter", "扶手直径", parameters.railDiameter],
        ["accessibility-call-height", "紧急呼叫高度", parameters.callHeight],
      ]),
    },
  };
}

export function createRestroomAccessibleDoorManifest(
  input: Partial<RestroomAccessibleDoorParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeRestroomAccessibleDoorParameters(input);
  const model = createRestroomAccessibleDoorModel(parameters);
  const allIds = featureIds(model);
  const mobileIds = allIds.filter((id) => !id.includes("handle-inside"));
  const postWidth = 58;
  const frameHeight = parameters.doorHeight + 70;
  const leafWidth = parameters.openingWidth - 40;
  const hingeX = -parameters.openingWidth / 2 + 20;
  return {
    schemaVersion: 1,
    id: restroomAssetIds.accessibleDoor,
    displayName: "无障碍厕所入口门",
    description: "带无障碍标识、稳定铰链、动态门扇碰撞体和入口交互锚点的全高房门。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "opening-width", label: "门洞宽度", type: "number", defaultValue: parameters.openingWidth, unit: "mm", ...restroomAccessibleParameterLimits.door.openingWidth },
      { id: "door-height", label: "门扇高度", type: "number", defaultValue: parameters.doorHeight, unit: "mm", ...restroomAccessibleParameterLimits.door.doorHeight },
      { id: "thickness", label: "门扇厚度", type: "number", defaultValue: parameters.thickness, unit: "mm", ...restroomAccessibleParameterLimits.door.thickness },
      { id: "open-angle", label: "最大开启角", type: "number", defaultValue: parameters.openAngle, unit: "degree", ...restroomAccessibleParameterLimits.door.openAngle },
    ],
    materials: [
      { id: "accessible-door-panel", label: "入口门板", material: "plastic", color: "#567C79", featureIds: idsByMaterial(model, "plastic").filter((id) => id !== "restroom-accessible-door-symbol") },
      { id: "accessible-door-symbol", label: "无障碍标识", material: "plastic", color: "#3D83C5", featureIds: ["restroom-accessible-door-symbol"] },
      { id: "accessible-door-hardware", label: "入口门五金", material: "metal", color: "#A7B7BA", featureIds: idsByMaterial(model, "metal") },
    ],
    placement: placement(),
    colliders: [
      { id: "restroom-accessible-door-left-post-collider", label: "入口门左框碰撞体", shape: "box", position: [-(parameters.openingWidth + postWidth) / 2, frameHeight / 2, 0], rotation: [0, 0, 0], size: [postWidth, frameHeight, 70], featureId: "restroom-accessible-door-left-post" },
      { id: "restroom-accessible-door-right-post-collider", label: "入口门右框碰撞体", shape: "box", position: [(parameters.openingWidth + postWidth) / 2, frameHeight / 2, 0], rotation: [0, 0, 0], size: [postWidth, frameHeight, 70], featureId: "restroom-accessible-door-right-post" },
      { id: "restroom-accessible-door-leaf-collider", label: "无障碍入口动态门扇碰撞体", shape: "box", position: [hingeX + leafWidth / 2, parameters.doorHeight / 2, 0], rotation: [0, 0, 0], size: [leafWidth, parameters.doorHeight, parameters.thickness], dynamic: true, groupId: restroomGroupIds.accessibleDoorLeaf, jointId: restroomJointIds.accessibleDoor },
    ],
    anchors: [
      { id: "restroom-accessible-door-outside-approach", label: "无障碍厕所门外接近位", kind: "approach", position: [0, 0, 850], rotation: [0, 180, 0], range: 1_200, groupId: restroomGroupIds.accessibleDoorFrame, tags: ["navigation", "accessible", "outside"] },
      { id: "restroom-accessible-door-inside-approach", label: "无障碍厕所门内接近位", kind: "approach", position: [0, 0, -850], rotation: [0, 0, 0], range: 1_200, groupId: restroomGroupIds.accessibleDoorFrame, tags: ["navigation", "accessible", "inside"] },
      { id: "restroom-accessible-door-open-control", label: "无障碍入口门开关", kind: "interaction", position: [hingeX + leafWidth - 110, 1_000, parameters.thickness / 2 + 55], rotation: [0, 0, 0], range: 1_000, featureId: "restroom-accessible-door-handle-front", tags: ["door", "open-close", "planned-runtime"] },
      { id: "restroom-accessible-door-install", label: "无障碍入口门安装基准", kind: "socket", position: [0, 0, 0], rotation: [0, 0, 0], groupId: restroomGroupIds.accessibleDoorFrame, tags: ["install", "ground-reference"] },
    ],
    joints: [{ id: "restroom-accessible-door-joint", label: "无障碍入口门铰链", jointId: restroomJointIds.accessibleDoor, semantic: "accessible-entry-door" }],
    lod: [
      { device: "desktop", levels: [{ id: "accessible-door-desktop-full", maximumDistance: 8_000, featureIds: allIds, triangleBudget: 1_300 }] },
      { device: "mobile", levels: [{ id: "accessible-door-mobile-core", maximumDistance: 10_000, featureIds: mobileIds, triangleBudget: 720 }] },
    ],
    previews: [
      { device: "desktop", cameraPosition: [2_800, 1_900, 3_500], cameraTarget: [0, 1_050, 0], background: "dark" },
      { device: "mobile", cameraPosition: [3_600, 2_000, 4_500], cameraTarget: [0, 1_050, 0], background: "dark" },
    ],
    tags: ["cyber-factory", "restroom", "accessible", "door", "articulated", "planned-runtime"],
  };
}

export function createRestroomAccessibleVanityManifest(
  input: Partial<RestroomAccessibleVanityParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeRestroomAccessibleVanityParameters(input);
  const model = createRestroomAccessibleVanityModel(parameters);
  const allIds = featureIds(model);
  const mobileIds = allIds.filter((id) => !id.includes("drain") && !id.includes("faucet-head"));
  return {
    schemaVersion: 1,
    id: restroomAssetIds.accessibleVanity,
    displayName: "壁挂无障碍洗手台",
    description: "不设置落地柜体、保留正面膝部净空的壁挂洗手台，带墙架、碰撞体与使用锚点。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "width", label: "洗手台宽度", type: "number", defaultValue: parameters.width, unit: "mm", ...restroomAccessibleParameterLimits.vanity.width },
      { id: "depth", label: "洗手台深度", type: "number", defaultValue: parameters.depth, unit: "mm", ...restroomAccessibleParameterLimits.vanity.depth },
      { id: "counter-height", label: "台面高度", type: "number", defaultValue: parameters.counterHeight, unit: "mm", ...restroomAccessibleParameterLimits.vanity.counterHeight },
      { id: "knee-clearance-height", label: "膝部净空高度", type: "number", defaultValue: parameters.kneeClearanceHeight, unit: "mm", ...restroomAccessibleParameterLimits.vanity.kneeClearanceHeight },
    ],
    materials: [
      { id: "accessible-vanity-ceramic", label: "无障碍台面与洗手盆", material: "default", color: "#D7E0DF", featureIds: idsByMaterial(model, "default") },
      { id: "accessible-vanity-hardware", label: "墙架与水龙头", material: "metal", color: "#A7B7BA", featureIds: idsByMaterial(model, "metal") },
      { id: "accessible-vanity-drain", label: "防护排水管", material: "plastic", color: "#26383C", featureIds: idsByMaterial(model, "plastic") },
    ],
    placement: placement(),
    colliders: [
      { id: "restroom-accessible-vanity-counter-collider", label: "无障碍洗手台台面碰撞体", shape: "box", position: [0, parameters.counterHeight - 35, parameters.depth / 2], rotation: [0, 0, 0], size: [parameters.width, 70, parameters.depth], featureId: "restroom-accessible-vanity-counter" },
      { id: "restroom-accessible-vanity-basin-collider", label: "无障碍洗手盆碰撞体", shape: "cylinder", position: [0, parameters.counterHeight + 4, parameters.depth * 0.5], rotation: [0, 0, 0], size: [Math.min(430, parameters.width * 0.54), 48, Math.min(430, parameters.width * 0.54)], radius: Math.min(215, parameters.width * 0.27), height: 48, featureId: "restroom-accessible-vanity-basin" },
    ],
    anchors: [
      { id: "restroom-accessible-vanity-use", label: "无障碍洗手台使用位", kind: "interaction", position: [0, parameters.counterHeight + 70, parameters.depth + 80], rotation: [0, 180, 0], range: 1_000, featureId: "restroom-accessible-vanity-basin", tags: ["wash-hands", "accessible", "planned-runtime"] },
      { id: "restroom-accessible-vanity-approach", label: "无障碍洗手台正面接近位", kind: "approach", position: [0, 0, parameters.depth + 760], rotation: [0, 180, 0], range: 1_200, groupId: restroomGroupIds.accessibleVanity, tags: ["navigation", "wheelchair", "front"] },
      { id: "restroom-accessible-vanity-knee-space", label: "洗手台膝部净空基准", kind: "placement", position: [0, parameters.kneeClearanceHeight, parameters.depth * 0.62], rotation: [0, 180, 0], groupId: restroomGroupIds.accessibleVanity, tags: ["clearance", "wheelchair", "planned-runtime"] },
      { id: "restroom-accessible-vanity-wall-service", label: "无障碍洗手台墙面管线基准", kind: "socket", position: [0, parameters.counterHeight * 0.55, 0], rotation: [0, 0, 0], groupId: restroomGroupIds.accessibleVanity, tags: ["wall-service", "plumbing", "z-zero-reference"] },
      { id: "restroom-accessible-vanity-maintenance", label: "无障碍洗手台维护位", kind: "interaction", position: [0, 420, parameters.depth + 60], rotation: [0, 180, 0], range: 900, featureId: "restroom-accessible-vanity-drain", tags: ["maintenance", "plumbing"] },
    ],
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "accessible-vanity-desktop-full", maximumDistance: 7_000, featureIds: allIds, triangleBudget: 1_900 }] },
      { device: "mobile", levels: [{ id: "accessible-vanity-mobile-core", maximumDistance: 9_000, featureIds: mobileIds, triangleBudget: 960 }] },
    ],
    previews: [
      { device: "desktop", cameraPosition: [2_000, 1_500, 2_600], cameraTarget: [0, 650, 260], background: "dark" },
      { device: "mobile", cameraPosition: [2_700, 1_600, 3_400], cameraTarget: [0, 650, 260], background: "dark" },
    ],
    tags: ["cyber-factory", "restroom", "accessible", "sink", "wall-mounted", "planned-runtime"],
  };
}

export function createRestroomAccessibilitySupportManifest(
  input: Partial<RestroomAccessibilitySupportParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeRestroomAccessibilitySupportParameters(input);
  const model = createRestroomAccessibilitySupportModel(parameters);
  const allIds = featureIds(model);
  const mobileIds = allIds.filter((id) => !id.includes("call-cord") && !id.includes("call-grip"));
  const transferSign = parameters.transferSide === "left" ? -1 : 1;
  const fixedSign = -transferSign;
  const transferRailX = transferSign * 420;
  const fixedRailX = fixedSign * 420;
  const callX = transferSign * 720;
  return {
    schemaVersion: 1,
    id: restroomAssetIds.accessibilitySupport,
    displayName: "无障碍扶手与紧急呼叫组件",
    description: "按左右转移侧镜像生成坐便器扶手和紧急呼叫点，几何、碰撞体与交互锚点同步变化。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "transfer-side", label: "转移侧", type: "select", defaultValue: parameters.transferSide, options: ["left", "right"] },
      { id: "rail-height", label: "扶手高度", type: "number", defaultValue: parameters.railHeight, unit: "mm", ...restroomAccessibleParameterLimits.support.railHeight },
      { id: "rail-length", label: "侧扶手长度", type: "number", defaultValue: parameters.railLength, unit: "mm", ...restroomAccessibleParameterLimits.support.railLength },
      { id: "rail-diameter", label: "扶手直径", type: "number", defaultValue: parameters.railDiameter, unit: "mm", ...restroomAccessibleParameterLimits.support.railDiameter },
      { id: "call-height", label: "紧急呼叫高度", type: "number", defaultValue: parameters.callHeight, unit: "mm", ...restroomAccessibleParameterLimits.support.callHeight },
    ],
    materials: [
      { id: "accessibility-rails", label: "无障碍扶手", material: "metal", color: "#A7B7BA", featureIds: idsByMaterial(model, "metal") },
      { id: "accessibility-call-panel", label: "紧急呼叫面板", material: "plastic", color: "#3D83C5", featureIds: ["restroom-accessibility-call-plate"] },
      { id: "accessibility-call-control", label: "紧急呼叫按钮与拉绳", material: "plastic", color: "#D95757", featureIds: idsByMaterial(model, "plastic").filter((id) => id !== "restroom-accessibility-call-plate") },
    ],
    placement: placement(),
    colliders: [
      { id: "restroom-accessibility-rear-rail-collider", label: "后侧扶手碰撞体", shape: "cylinder", position: [0, parameters.railHeight, -420], rotation: [0, 0, 90], size: [parameters.railDiameter, 840, parameters.railDiameter], radius: parameters.railDiameter / 2, height: 840, featureId: "restroom-accessibility-rear-rail" },
      { id: "restroom-accessibility-transfer-rail-collider", label: "转移侧扶手碰撞体", shape: "cylinder", position: [transferRailX, parameters.railHeight, -70], rotation: [90, 0, 0], size: [parameters.railDiameter, parameters.railLength, parameters.railDiameter], radius: parameters.railDiameter / 2, height: parameters.railLength, featureId: "restroom-accessibility-transfer-rail" },
      { id: "restroom-accessibility-fixed-rail-collider", label: "固定侧扶手碰撞体", shape: "cylinder", position: [fixedRailX, parameters.railHeight, -120], rotation: [90, 0, 0], size: [parameters.railDiameter, parameters.railLength - 100, parameters.railDiameter], radius: parameters.railDiameter / 2, height: parameters.railLength - 100, featureId: "restroom-accessibility-fixed-rail" },
      { id: "restroom-accessibility-call-plate-collider", label: "紧急呼叫面板碰撞体", shape: "box", position: [callX, parameters.callHeight, -505], rotation: [0, 0, 0], size: [220, 260, 35], featureId: "restroom-accessibility-call-plate" },
    ],
    anchors: [
      { id: "restroom-accessibility-wall-mount", label: "无障碍扶手墙面安装基准", kind: "socket", position: [0, parameters.railHeight, -520], rotation: [0, 0, 0], groupId: restroomGroupIds.accessibilitySupport, tags: ["wall-mount", "accessible", "z-reference"] },
      { id: "restroom-accessibility-transfer-support", label: "转移侧扶手使用位", kind: "interaction", position: [transferRailX, parameters.railHeight, 80], rotation: [0, 0, 0], range: 800, featureId: "restroom-accessibility-transfer-rail", tags: ["grab-rail", "transfer", parameters.transferSide, "planned-runtime"] },
      { id: "restroom-accessibility-fixed-support", label: "固定侧扶手使用位", kind: "interaction", position: [fixedRailX, parameters.railHeight, 30], rotation: [0, 0, 0], range: 800, featureId: "restroom-accessibility-fixed-rail", tags: ["grab-rail", "support", "planned-runtime"] },
      { id: "restroom-accessibility-emergency-call", label: "紧急呼叫按钮", kind: "interaction", position: [callX, parameters.callHeight, -455], rotation: [0, 0, 0], range: 900, featureId: "restroom-accessibility-call-button", tags: ["emergency-call", "accessible", "planned-runtime"] },
      { id: "restroom-accessibility-maintenance", label: "扶手与呼叫组件维护位", kind: "interaction", position: [0, parameters.railHeight + 300, -420], rotation: [0, 0, 0], range: 900, groupId: restroomGroupIds.accessibilitySupport, tags: ["maintenance", "wall-hardware"] },
    ],
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "accessibility-support-desktop-full", maximumDistance: 7_000, featureIds: allIds, triangleBudget: 1_600 }] },
      { device: "mobile", levels: [{ id: "accessibility-support-mobile-core", maximumDistance: 9_000, featureIds: mobileIds, triangleBudget: 900 }] },
    ],
    previews: [
      { device: "desktop", cameraPosition: [2_200, 1_500, 2_700], cameraTarget: [0, 720, -160], background: "dark" },
      { device: "mobile", cameraPosition: [2_900, 1_650, 3_500], cameraTarget: [0, 720, -160], background: "dark" },
    ],
    tags: ["cyber-factory", "restroom", "accessible", "grab-rail", "emergency-call", "planned-runtime"],
  };
}

export function createRestroomAccessibleDoorDefinition(
  input: Partial<RestroomAccessibleDoorParameters> = {},
): ModelAssetDefinition {
  const parameters = normalizeRestroomAccessibleDoorParameters(input);
  return assertModelAssetDefinition({
    manifest: createRestroomAccessibleDoorManifest(parameters),
    createModel: () => createRestroomAccessibleDoorModel(parameters),
  });
}

export function createRestroomAccessibleVanityDefinition(
  input: Partial<RestroomAccessibleVanityParameters> = {},
): ModelAssetDefinition {
  const parameters = normalizeRestroomAccessibleVanityParameters(input);
  return assertModelAssetDefinition({
    manifest: createRestroomAccessibleVanityManifest(parameters),
    createModel: () => createRestroomAccessibleVanityModel(parameters),
  });
}

export function createRestroomAccessibilitySupportDefinition(
  input: Partial<RestroomAccessibilitySupportParameters> = {},
): ModelAssetDefinition {
  const parameters = normalizeRestroomAccessibilitySupportParameters(input);
  return assertModelAssetDefinition({
    manifest: createRestroomAccessibilitySupportManifest(parameters),
    createModel: () => createRestroomAccessibilitySupportModel(parameters),
  });
}

export const restroomAccessibleDoorDefinition = createRestroomAccessibleDoorDefinition();
export const restroomAccessibleVanityDefinition = createRestroomAccessibleVanityDefinition();
export const restroomAccessibilitySupportDefinition = createRestroomAccessibilitySupportDefinition();
