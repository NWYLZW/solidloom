import type {
  ModelAssetManifest,
  ModelFeature,
} from "@solidloom/shared";
import {
  createRestroomMirrorModel,
  createRestroomPartitionModel,
  createRestroomStallDoorModel,
  createRestroomToiletModel,
  createRestroomUrinalBankModel,
  createRestroomVanityModel,
  defaultRestroomMirrorParameters,
  defaultRestroomPartitionParameters,
  defaultRestroomStallDoorParameters,
  defaultRestroomToiletParameters,
  defaultRestroomUrinalBankParameters,
  defaultRestroomVanityParameters,
  normalizeRestroomMirrorParameters,
  normalizeRestroomPartitionParameters,
  normalizeRestroomStallDoorParameters,
  normalizeRestroomToiletParameters,
  normalizeRestroomUrinalBankParameters,
  normalizeRestroomVanityParameters,
  restroomAssetIds,
  restroomGroupIds,
  restroomJointIds,
  restroomParameterLimits,
  restroomUrinalCenterX,
  restroomUrinalDividerX,
  restroomVanityBasinX,
} from "./model.js";
import type {
  RestroomMirrorParameters,
  RestroomPartitionParameters,
  RestroomStallDoorParameters,
  RestroomToiletParameters,
  RestroomUrinalBankParameters,
  RestroomVanityParameters,
} from "./types.js";

function placement(): ModelAssetManifest["placement"] {
  return {
    upAxis: "y",
    groundY: 0,
    origin: [0, 0, 0],
    defaultScale: [1, 1, 1],
  };
}

function featureIds(model: { featureGraph?: { features: ModelFeature[] } }) {
  return model.featureGraph!.features.map(({ id }) => id);
}

function idsByMaterial(model: { featureGraph?: { features: ModelFeature[] } }, material: string) {
  return model.featureGraph!.features
    .filter((feature) => feature.appearance?.material === material)
    .map(({ id }) => id);
}

function desktopAndMobilePreview(
  desktopPosition: [number, number, number],
  mobilePosition: [number, number, number],
  target: [number, number, number],
): ModelAssetManifest["previews"] {
  return [
    { device: "desktop", cameraPosition: desktopPosition, cameraTarget: target, background: "dark" },
    { device: "mobile", cameraPosition: mobilePosition, cameraTarget: target, background: "dark" },
  ];
}

export function createRestroomPartitionManifest(
  input: Partial<RestroomPartitionParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeRestroomPartitionParameters(input);
  const model = createRestroomPartitionModel(parameters);
  const allIds = featureIds(model);
  const coreIds = allIds.filter((id) => !id.includes("foot"));
  const postHeight = parameters.panelHeight + parameters.bottomGap + 50;
  return {
    schemaVersion: 1,
    id: restroomAssetIds.partition,
    displayName: "厕所隔断组件",
    description: "可单独引用和旋转组合的悬空厕所隔断板，带两端立柱、地脚、碰撞体和安装锚点。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "width", label: "隔断宽度", type: "number", defaultValue: parameters.width, unit: "mm", ...restroomParameterLimits.partition.width },
      { id: "panel-height", label: "隔断板高度", type: "number", defaultValue: parameters.panelHeight, unit: "mm", ...restroomParameterLimits.partition.panelHeight },
      { id: "bottom-gap", label: "底部净空", type: "number", defaultValue: parameters.bottomGap, unit: "mm", ...restroomParameterLimits.partition.bottomGap },
      { id: "thickness", label: "隔断厚度", type: "number", defaultValue: parameters.thickness, unit: "mm", ...restroomParameterLimits.partition.thickness },
    ],
    materials: [
      { id: "partition-panel", label: "抗倍特隔断板", material: "plastic", color: "#567C79", featureIds: idsByMaterial(model, "plastic") },
      { id: "partition-hardware", label: "隔断金属件", material: "metal", color: "#8CA1A1", featureIds: idsByMaterial(model, "metal") },
    ],
    placement: placement(),
    colliders: [
      { id: "restroom-partition-panel-collider", label: "隔断板碰撞体", shape: "box", position: [0, parameters.bottomGap + parameters.panelHeight / 2, 0], rotation: [0, 0, 0], size: [parameters.width - 70, parameters.panelHeight, parameters.thickness], featureId: "restroom-partition-panel" },
      { id: "restroom-partition-left-post-collider", label: "隔断左立柱碰撞体", shape: "box", position: [-parameters.width / 2 + 21, postHeight / 2, 0], rotation: [0, 0, 0], size: [42, postHeight, 42], featureId: "restroom-partition-left-post" },
      { id: "restroom-partition-right-post-collider", label: "隔断右立柱碰撞体", shape: "box", position: [parameters.width / 2 - 21, postHeight / 2, 0], rotation: [0, 0, 0], size: [42, postHeight, 42], featureId: "restroom-partition-right-post" },
    ],
    anchors: [
      { id: "restroom-partition-left-install", label: "隔断左端安装点", kind: "socket", position: [-parameters.width / 2, 0, 0], rotation: [0, 0, 0], groupId: restroomGroupIds.partition, tags: ["install", "partition-end", "ground-reference"] },
      { id: "restroom-partition-right-install", label: "隔断右端安装点", kind: "socket", position: [parameters.width / 2, 0, 0], rotation: [0, 180, 0], groupId: restroomGroupIds.partition, tags: ["install", "partition-end", "ground-reference"] },
      { id: "restroom-partition-maintenance", label: "隔断维护接近位", kind: "approach", position: [0, 0, 620], rotation: [0, 180, 0], range: 900, groupId: restroomGroupIds.partition, tags: ["maintenance", "approach"] },
    ],
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "partition-desktop-full", maximumDistance: 8_000, featureIds: allIds, triangleBudget: 900 }] },
      { device: "mobile", levels: [{ id: "partition-mobile-core", maximumDistance: 10_000, featureIds: coreIds, triangleBudget: 480 }] },
    ],
    previews: desktopAndMobilePreview([2_600, 1_800, 3_200], [3_200, 1_900, 4_000], [0, 1_000, 0]),
    tags: ["cyber-factory", "restroom", "partition", "modular", "planned-runtime"],
  };
}

export function createRestroomStallDoorManifest(
  input: Partial<RestroomStallDoorParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeRestroomStallDoorParameters(input);
  const model = createRestroomStallDoorModel(parameters);
  const allIds = featureIds(model);
  const mobileIds = allIds.filter((id) => !id.includes("handle-inside") && !id.includes("occupancy-indicator"));
  const frameHeight = parameters.bottomGap + parameters.doorHeight + 60;
  const leafWidth = parameters.openingWidth - 32;
  const leafY = parameters.bottomGap + parameters.doorHeight / 2;
  const hingeX = -parameters.openingWidth / 2 + 16;
  return {
    schemaVersion: 1,
    id: restroomAssetIds.stallDoor,
    displayName: "厕所隔间门组件",
    description: "可单独安装的向外开启隔间门，含门框、动态门扇碰撞体、稳定铰链和开关维护锚点。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "opening-width", label: "门洞宽度", type: "number", defaultValue: parameters.openingWidth, unit: "mm", ...restroomParameterLimits.stallDoor.openingWidth },
      { id: "door-height", label: "门扇高度", type: "number", defaultValue: parameters.doorHeight, unit: "mm", ...restroomParameterLimits.stallDoor.doorHeight },
      { id: "bottom-gap", label: "门扇底部净空", type: "number", defaultValue: parameters.bottomGap, unit: "mm", ...restroomParameterLimits.stallDoor.bottomGap },
      { id: "thickness", label: "门扇厚度", type: "number", defaultValue: parameters.thickness, unit: "mm", ...restroomParameterLimits.stallDoor.thickness },
      { id: "open-angle", label: "最大开启角", type: "number", defaultValue: parameters.openAngle, unit: "degree", ...restroomParameterLimits.stallDoor.openAngle },
    ],
    materials: [
      { id: "stall-door-panel", label: "隔间门板", material: "plastic", color: "#567C79", featureIds: idsByMaterial(model, "plastic") },
      { id: "stall-door-hardware", label: "门框与五金", material: "metal", color: "#A7B7BA", featureIds: idsByMaterial(model, "metal") },
    ],
    placement: placement(),
    colliders: [
      { id: "restroom-stall-door-left-post-collider", label: "门框左立柱碰撞体", shape: "box", position: [-(parameters.openingWidth + 48) / 2, frameHeight / 2, 0], rotation: [0, 0, 0], size: [48, frameHeight, 50], featureId: "restroom-stall-door-left-post" },
      { id: "restroom-stall-door-right-post-collider", label: "门框右立柱碰撞体", shape: "box", position: [(parameters.openingWidth + 48) / 2, frameHeight / 2, 0], rotation: [0, 0, 0], size: [48, frameHeight, 50], featureId: "restroom-stall-door-right-post" },
      { id: "restroom-stall-door-leaf-collider", label: "动态门扇碰撞体", shape: "box", position: [hingeX + leafWidth / 2, leafY, 0], rotation: [0, 0, 0], size: [leafWidth, parameters.doorHeight, parameters.thickness], dynamic: true, groupId: restroomGroupIds.doorLeaf, jointId: restroomJointIds.stallDoor },
    ],
    anchors: [
      { id: "restroom-stall-door-front-approach", label: "隔间门外侧接近位", kind: "approach", position: [0, 0, 720], rotation: [0, 180, 0], range: 1_000, groupId: restroomGroupIds.doorFrame, tags: ["navigation", "door", "outside"] },
      { id: "restroom-stall-door-open-control", label: "隔间门开关位置", kind: "interaction", position: [hingeX + leafWidth - 90, leafY, parameters.thickness / 2 + 45], rotation: [0, 0, 0], range: 900, featureId: "restroom-stall-door-handle-front", tags: ["door", "open-close", "planned-runtime"] },
      { id: "restroom-stall-door-hinge-maintenance", label: "隔间门铰链维护位", kind: "interaction", position: [hingeX, leafY, -120], rotation: [0, 0, 0], range: 700, jointId: restroomJointIds.stallDoor, tags: ["maintenance", "hinge"] },
      { id: "restroom-stall-door-install", label: "隔间门安装基准", kind: "socket", position: [0, 0, 0], rotation: [0, 0, 0], groupId: restroomGroupIds.doorFrame, tags: ["install", "ground-reference"] },
    ],
    joints: [{ id: "restroom-stall-door-joint", label: "隔间门铰链", jointId: restroomJointIds.stallDoor, semantic: "stall-door" }],
    lod: [
      { device: "desktop", levels: [{ id: "stall-door-desktop-full", maximumDistance: 8_000, featureIds: allIds, triangleBudget: 1_400 }] },
      { device: "mobile", levels: [{ id: "stall-door-mobile-core", maximumDistance: 10_000, featureIds: mobileIds, triangleBudget: 720 }] },
    ],
    previews: desktopAndMobilePreview([2_400, 1_700, 2_900], [3_000, 1_800, 3_600], [0, 1_000, 0]),
    tags: ["cyber-factory", "restroom", "stall-door", "articulated", "planned-runtime"],
  };
}

export function createRestroomToiletManifest(
  input: Partial<RestroomToiletParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeRestroomToiletParameters(input);
  const model = createRestroomToiletModel(parameters);
  const allIds = featureIds(model);
  const mobileIds = allIds.filter((id) => !id.includes("flush-button") && !id.includes("tank-lid"));
  const bowlRadius = parameters.bowlWidth / 2;
  const tankDepth = Math.min(220, parameters.depth * 0.31);
  const tankWidth = parameters.bowlWidth + 40;
  const tankCenterZ = -parameters.depth / 2 + tankDepth / 2;
  return {
    schemaVersion: 1,
    id: restroomAssetIds.toilet,
    displayName: "落地式坐便器组件",
    description: "可独立布置的落地式坐便器，包含座圈、水箱、碰撞体及使用、冲水和维护锚点。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "bowl-width", label: "坐便器宽度", type: "number", defaultValue: parameters.bowlWidth, unit: "mm", ...restroomParameterLimits.toilet.bowlWidth },
      { id: "seat-height", label: "座圈高度", type: "number", defaultValue: parameters.seatHeight, unit: "mm", ...restroomParameterLimits.toilet.seatHeight },
      { id: "depth", label: "坐便器深度", type: "number", defaultValue: parameters.depth, unit: "mm", ...restroomParameterLimits.toilet.depth },
      { id: "tank-height", label: "水箱总高", type: "number", defaultValue: parameters.tankHeight, unit: "mm", ...restroomParameterLimits.toilet.tankHeight },
    ],
    materials: [
      { id: "toilet-ceramic", label: "坐便器陶瓷", material: "default", color: "#E8EEEE", featureIds: idsByMaterial(model, "default") },
      { id: "toilet-seat", label: "坐便器座圈", material: "plastic", color: "#26383C", featureIds: idsByMaterial(model, "plastic") },
      { id: "toilet-metal", label: "冲水按钮", material: "metal", color: "#A7B7BA", featureIds: idsByMaterial(model, "metal") },
    ],
    placement: placement(),
    colliders: [
      { id: "restroom-toilet-bowl-collider", label: "坐便器盆体碰撞体", shape: "cylinder", position: [0, parameters.seatHeight - 105, parameters.depth * 0.12], rotation: [0, 0, 0], size: [parameters.bowlWidth, 210, parameters.bowlWidth], radius: bowlRadius, height: 210, featureId: "restroom-toilet-bowl" },
      { id: "restroom-toilet-tank-collider", label: "坐便器水箱碰撞体", shape: "box", position: [0, (parameters.tankHeight + parameters.seatHeight - 90) / 2, tankCenterZ], rotation: [0, 0, 0], size: [tankWidth, parameters.tankHeight - parameters.seatHeight + 90, tankDepth], featureId: "restroom-toilet-tank" },
    ],
    anchors: [
      { id: "restroom-toilet-use", label: "坐便器使用位", kind: "seat", position: [0, parameters.seatHeight + 35, parameters.depth * 0.1], rotation: [0, 0, 0], range: 850, groupId: restroomGroupIds.toilet, tags: ["use", "seat", "planned-runtime"] },
      { id: "restroom-toilet-front-approach", label: "坐便器前方接近位", kind: "approach", position: [0, 0, parameters.depth / 2 + 650], rotation: [0, 180, 0], range: 1_000, groupId: restroomGroupIds.toilet, tags: ["navigation", "front"] },
      { id: "restroom-toilet-flush-control", label: "坐便器冲水按钮", kind: "interaction", position: [0, parameters.tankHeight + 48, tankCenterZ], rotation: [0, 0, 0], range: 900, featureId: "restroom-toilet-flush-button", tags: ["flush", "planned-runtime"] },
      { id: "restroom-toilet-maintenance", label: "坐便器后部维护位", kind: "approach", position: [0, 0, -parameters.depth / 2 - 520], rotation: [0, 0, 0], range: 900, groupId: restroomGroupIds.toilet, tags: ["maintenance", "plumbing"] },
    ],
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "toilet-desktop-full", maximumDistance: 6_000, featureIds: allIds, triangleBudget: 2_400 }] },
      { device: "mobile", levels: [{ id: "toilet-mobile-core", maximumDistance: 8_000, featureIds: mobileIds, triangleBudget: 1_200 }] },
    ],
    previews: desktopAndMobilePreview([1_700, 1_150, 2_100], [2_100, 1_250, 2_700], [0, 420, 0]),
    tags: ["cyber-factory", "restroom", "toilet", "fixture", "planned-runtime"],
  };
}

export function createRestroomUrinalBankManifest(
  input: Partial<RestroomUrinalBankParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeRestroomUrinalBankParameters(input);
  const model = createRestroomUrinalBankModel(parameters);
  const allIds = featureIds(model);
  const mobileIds = allIds.filter((id) => !id.includes("drain") && !id.includes("sensor"));
  const anchors: ModelAssetManifest["anchors"] = [];
  const colliders: ModelAssetManifest["colliders"] = [];
  for (let index = 0; index < parameters.count; index += 1) {
    const suffix = String(index + 1).padStart(2, "0");
    const x = restroomUrinalCenterX(parameters, index);
    colliders.push(
      { id: `restroom-urinal-${suffix}-back-collider`, label: `第 ${index + 1} 个小便器背板碰撞体`, shape: "box", position: [x, parameters.rimHeight + 155, 55], rotation: [0, 0, 0], size: [parameters.urinalWidth, 600, 110], featureId: `restroom-urinal-${suffix}-back` },
      { id: `restroom-urinal-${suffix}-bowl-collider`, label: `第 ${index + 1} 个小便器盆体碰撞体`, shape: "cylinder", position: [x, parameters.rimHeight - 100, 105 + (parameters.projection - 105) / 2], rotation: [90, 0, 0], size: [parameters.urinalWidth * 0.88, parameters.projection - 105, parameters.urinalWidth * 0.88], radius: parameters.urinalWidth * 0.44, height: parameters.projection - 105, featureId: `restroom-urinal-${suffix}-bowl` },
    );
    anchors.push(
      { id: `restroom-urinal-${suffix}-wall-mount`, label: `第 ${index + 1} 个小便器墙面安装点`, kind: "socket", position: [x, parameters.rimHeight + 150, 0], rotation: [0, 0, 0], featureId: `restroom-urinal-${suffix}-back`, tags: ["wall-mount", "plumbing", "z-zero-reference"] },
      { id: `restroom-urinal-${suffix}-use`, label: `第 ${index + 1} 个小便器使用位`, kind: "interaction", position: [x, parameters.rimHeight, parameters.projection + 120], rotation: [0, 180, 0], range: 800, featureId: `restroom-urinal-${suffix}-rim`, tags: ["use", "planned-runtime"] },
      { id: `restroom-urinal-${suffix}-approach`, label: `第 ${index + 1} 个小便器接近位`, kind: "approach", position: [x, 0, parameters.projection + 700], rotation: [0, 180, 0], range: 1_000, groupId: restroomGroupIds.urinals, tags: ["navigation", "front"] },
      { id: `restroom-urinal-${suffix}-maintenance`, label: `第 ${index + 1} 个小便器维护位`, kind: "interaction", position: [x, parameters.rimHeight + 385, 160], rotation: [0, 0, 0], range: 850, featureId: `restroom-urinal-${suffix}-sensor`, tags: ["maintenance", "flush-sensor", "plumbing"] },
    );
  }
  if (parameters.dividerEnabled) {
    for (let index = 0; index < parameters.count - 1; index += 1) {
      const suffix = String(index + 1).padStart(2, "0");
      const x = restroomUrinalDividerX(parameters, index);
      colliders.push({ id: `restroom-urinal-divider-${suffix}-collider`, label: `第 ${index + 1} 块小便器挡板碰撞体`, shape: "box", position: [x, parameters.rimHeight + 230, parameters.dividerDepth / 2], rotation: [0, 0, 0], size: [30, 760, parameters.dividerDepth], featureId: `restroom-urinal-divider-${suffix}` });
    }
  }
  const totalWidth = parameters.urinalWidth + (parameters.count - 1) * parameters.centerSpacing;
  return {
    schemaVersion: 1,
    id: restroomAssetIds.urinalBank,
    displayName: "壁挂式小便器组合",
    description: "可生成 1–6 个连续壁挂小便器并选择挡板；器具、碰撞体、墙装、使用、维护和接近锚点同步派生。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "count", label: "小便器数量", type: "number", defaultValue: parameters.count, ...restroomParameterLimits.urinalBank.count },
      { id: "center-spacing", label: "小便器中心距", type: "number", defaultValue: parameters.centerSpacing, unit: "mm", ...restroomParameterLimits.urinalBank.centerSpacing },
      { id: "urinal-width", label: "小便器宽度", type: "number", defaultValue: parameters.urinalWidth, unit: "mm", ...restroomParameterLimits.urinalBank.urinalWidth },
      { id: "rim-height", label: "小便器前沿高度", type: "number", defaultValue: parameters.rimHeight, unit: "mm", ...restroomParameterLimits.urinalBank.rimHeight },
      { id: "projection", label: "小便器墙面投影", type: "number", defaultValue: parameters.projection, unit: "mm", ...restroomParameterLimits.urinalBank.projection },
      { id: "divider-enabled", label: "启用小便器挡板", type: "boolean", defaultValue: parameters.dividerEnabled },
      { id: "divider-depth", label: "挡板深度", type: "number", defaultValue: parameters.dividerDepth, unit: "mm", ...restroomParameterLimits.urinalBank.dividerDepth },
    ],
    materials: [
      { id: "urinal-ceramic", label: "小便器陶瓷", material: "default", color: "#E8EEEE", featureIds: idsByMaterial(model, "default") },
      { id: "urinal-controls", label: "感应器与排水五金", material: "metal", color: "#344449", featureIds: idsByMaterial(model, "metal") },
      { id: "urinal-sensors", label: "冲水感应器", material: "plastic", color: "#26383C", featureIds: idsByMaterial(model, "plastic").filter((id) => id.includes("sensor")) },
      { id: "urinal-dividers", label: "小便器挡板", material: "plastic", color: "#567C79", featureIds: idsByMaterial(model, "plastic").filter((id) => id.includes("divider")) },
    ],
    placement: placement(),
    colliders,
    anchors,
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "urinal-bank-desktop-full", maximumDistance: 8_000, featureIds: allIds, triangleBudget: Math.max(2_400, allIds.length * 160) }] },
      { device: "mobile", levels: [{ id: "urinal-bank-mobile-core", maximumDistance: 10_000, featureIds: mobileIds, triangleBudget: Math.max(1_200, mobileIds.length * 90) }] },
    ],
    previews: desktopAndMobilePreview([totalWidth * 0.9 + 1_600, 1_900, 3_200], [totalWidth + 2_000, 2_000, 4_200], [0, 850, 150]),
    tags: ["cyber-factory", "restroom", "urinal", "wall-mounted", "modular", "planned-runtime"],
  };
}

export function createRestroomVanityManifest(
  input: Partial<RestroomVanityParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeRestroomVanityParameters(input);
  const model = createRestroomVanityModel(parameters);
  const allIds = featureIds(model);
  const mobileIds = allIds.filter((id) => !id.includes("drain") && !id.includes("faucet-head"));
  const anchors: ModelAssetManifest["anchors"] = [];
  for (let index = 0; index < parameters.basinCount; index += 1) {
    const suffix = String(index + 1).padStart(2, "0");
    const x = restroomVanityBasinX(parameters, index);
    anchors.push(
      { id: `restroom-vanity-basin-${suffix}-use`, label: `第 ${index + 1} 个洗手盆使用位`, kind: "interaction", position: [x, parameters.counterHeight + 80, parameters.depth / 2 + 60], rotation: [0, 180, 0], range: 850, featureId: `restroom-vanity-basin-${suffix}`, tags: ["wash-hands", "use", "planned-runtime"] },
      { id: `restroom-vanity-basin-${suffix}-approach`, label: `第 ${index + 1} 个洗手盆接近位`, kind: "approach", position: [x, 0, parameters.depth / 2 + 650], rotation: [0, 180, 0], range: 1_000, groupId: restroomGroupIds.vanity, tags: ["navigation", "front"] },
    );
  }
  anchors.push(
    { id: "restroom-vanity-maintenance", label: "洗手台柜内维护位", kind: "interaction", position: [0, 420, parameters.depth / 2 + 40], rotation: [0, 180, 0], range: 900, featureId: "restroom-vanity-cabinet", tags: ["maintenance", "plumbing"] },
    { id: "restroom-vanity-wall-service", label: "洗手台墙面管线基准", kind: "socket", position: [0, parameters.counterHeight * 0.55, -parameters.depth / 2], rotation: [0, 0, 0], groupId: restroomGroupIds.vanity, tags: ["wall-service", "plumbing", "z-reference"] },
  );
  return {
    schemaVersion: 1,
    id: restroomAssetIds.vanity,
    displayName: "组合式洗手台",
    description: "可独立布置的落地洗手台，按台宽生成 1–3 个洗手盆、感应水龙头、碰撞体和使用锚点。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "width", label: "洗手台宽度", type: "number", defaultValue: parameters.width, unit: "mm", ...restroomParameterLimits.vanity.width },
      { id: "depth", label: "洗手台深度", type: "number", defaultValue: parameters.depth, unit: "mm", ...restroomParameterLimits.vanity.depth },
      { id: "counter-height", label: "台面高度", type: "number", defaultValue: parameters.counterHeight, unit: "mm", ...restroomParameterLimits.vanity.counterHeight },
      { id: "basin-count", label: "洗手盆数量", type: "number", defaultValue: parameters.basinCount, ...restroomParameterLimits.vanity.basinCount },
      { id: "basin-spacing", label: "洗手盆中心距", type: "number", defaultValue: parameters.basinSpacing, unit: "mm", ...restroomParameterLimits.vanity.basinSpacing },
    ],
    materials: [
      { id: "vanity-cabinet", label: "洗手台柜体", material: "wood", color: "#8B6950", featureIds: idsByMaterial(model, "wood") },
      { id: "vanity-ceramic", label: "台面与洗手盆", material: "default", color: "#D7E0DF", featureIds: idsByMaterial(model, "default") },
      { id: "vanity-hardware", label: "水龙头与排水五金", material: "metal", color: "#A7B7BA", featureIds: idsByMaterial(model, "metal") },
      { id: "vanity-plinth", label: "防水踢脚", material: "plastic", color: "#26383C", featureIds: idsByMaterial(model, "plastic") },
    ],
    placement: placement(),
    colliders: [
      { id: "restroom-vanity-cabinet-collider", label: "洗手台柜体碰撞体", shape: "box", position: [0, (parameters.counterHeight - 125) / 2 + 100, -15], rotation: [0, 0, 0], size: [parameters.width - 40, parameters.counterHeight - 125, parameters.depth - 45], featureId: "restroom-vanity-cabinet" },
      { id: "restroom-vanity-counter-collider", label: "洗手台台面碰撞体", shape: "box", position: [0, parameters.counterHeight - 35, 0], rotation: [0, 0, 0], size: [parameters.width, 70, parameters.depth], featureId: "restroom-vanity-counter" },
    ],
    anchors,
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "vanity-desktop-full", maximumDistance: 7_000, featureIds: allIds, triangleBudget: Math.max(2_000, allIds.length * 150) }] },
      { device: "mobile", levels: [{ id: "vanity-mobile-core", maximumDistance: 9_000, featureIds: mobileIds, triangleBudget: Math.max(1_000, mobileIds.length * 90) }] },
    ],
    previews: desktopAndMobilePreview([2_700, 1_600, 3_000], [3_300, 1_700, 3_800], [0, 650, 0]),
    tags: ["cyber-factory", "restroom", "sink", "vanity", "modular", "planned-runtime"],
  };
}

export function createRestroomMirrorManifest(
  input: Partial<RestroomMirrorParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeRestroomMirrorParameters(input);
  const model = createRestroomMirrorModel(parameters);
  const allIds = featureIds(model);
  const mobileIds = ["restroom-mirror-backing", "restroom-mirror-glass", "restroom-mirror-frame-top", "restroom-mirror-frame-bottom"];
  const centerY = parameters.bottomHeight + parameters.height / 2;
  return {
    schemaVersion: 1,
    id: restroomAssetIds.mirror,
    displayName: "壁挂镜面组件",
    description: "以局部 Z=0 墙面为安装基准的独立镜面、背板与金属边框。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "width", label: "镜面宽度", type: "number", defaultValue: parameters.width, unit: "mm", ...restroomParameterLimits.mirror.width },
      { id: "height", label: "镜面高度", type: "number", defaultValue: parameters.height, unit: "mm", ...restroomParameterLimits.mirror.height },
      { id: "bottom-height", label: "镜面底边高度", type: "number", defaultValue: parameters.bottomHeight, unit: "mm", ...restroomParameterLimits.mirror.bottomHeight },
      { id: "frame-thickness", label: "镜框宽度", type: "number", defaultValue: parameters.frameThickness, unit: "mm", ...restroomParameterLimits.mirror.frameThickness },
    ],
    materials: [
      { id: "mirror-glass", label: "镜面玻璃", material: "glass", color: "#9ED7D6", featureIds: idsByMaterial(model, "glass") },
      { id: "mirror-frame", label: "镜面金属边框", material: "metal", color: "#344449", featureIds: idsByMaterial(model, "metal") },
      { id: "mirror-backing", label: "镜面背板", material: "default", color: "#253438", featureIds: idsByMaterial(model, "default") },
    ],
    placement: placement(),
    colliders: [{ id: "restroom-mirror-panel-collider", label: "壁挂镜面碰撞体", shape: "box", position: [0, centerY, 18], rotation: [0, 0, 0], size: [parameters.width, parameters.height, 36], groupId: restroomGroupIds.mirror }],
    anchors: [
      { id: "restroom-mirror-wall-mount", label: "镜面墙面安装基准", kind: "socket", position: [0, centerY, 0], rotation: [0, 0, 0], groupId: restroomGroupIds.mirror, tags: ["wall-mount", "z-zero-reference"] },
      { id: "restroom-mirror-use", label: "镜面使用视点", kind: "interaction", position: [0, centerY, 580], rotation: [0, 180, 0], range: 1_000, featureId: "restroom-mirror-glass", tags: ["use", "view", "planned-runtime"] },
      { id: "restroom-mirror-front-approach", label: "镜面前方接近位", kind: "approach", position: [0, 0, 850], rotation: [0, 180, 0], range: 1_100, groupId: restroomGroupIds.mirror, tags: ["navigation", "front"] },
      { id: "restroom-mirror-maintenance", label: "镜面维护位", kind: "interaction", position: [parameters.width / 2 - 80, centerY, 80], rotation: [0, 0, 0], range: 800, featureId: "restroom-mirror-frame-right", tags: ["maintenance", "remove"] },
    ],
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "mirror-desktop-full", maximumDistance: 8_000, featureIds: allIds, triangleBudget: 700 }] },
      { device: "mobile", levels: [{ id: "mirror-mobile-core", maximumDistance: 10_000, featureIds: mobileIds, triangleBudget: 360 }] },
    ],
    previews: desktopAndMobilePreview([2_500, 1_900, 3_100], [3_200, 2_000, 4_000], [0, centerY, 0]),
    tags: ["cyber-factory", "restroom", "mirror", "wall-mounted", "planned-runtime"],
  };
}

export const restroomPartitionManifest = createRestroomPartitionManifest(defaultRestroomPartitionParameters);
export const restroomStallDoorManifest = createRestroomStallDoorManifest(defaultRestroomStallDoorParameters);
export const restroomToiletManifest = createRestroomToiletManifest(defaultRestroomToiletParameters);
export const restroomUrinalBankManifest = createRestroomUrinalBankManifest(defaultRestroomUrinalBankParameters);
export const restroomVanityManifest = createRestroomVanityManifest(defaultRestroomVanityParameters);
export const restroomMirrorManifest = createRestroomMirrorManifest(defaultRestroomMirrorParameters);
