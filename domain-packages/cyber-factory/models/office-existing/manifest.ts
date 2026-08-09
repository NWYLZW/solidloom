import {
  assertModelAssetDefinition,
  type CreateModelInput,
  type FeatureMaterialPreset,
  type ModelAssetDefinition,
  type ModelAssetLodProfile,
  type ModelAssetManifest,
  type ModelAssetMaterialSlot,
  type Vector3Tuple,
} from "@solidloom/shared";
import {
  blockAvatarFeatureIds,
  blockAvatarGroupIds,
  blockAvatarJointIds,
  blockAvatarParameterLimits,
  createBlockAvatar,
  createChair,
  createDesk,
  createLaptop,
  createMonitor,
  createTower,
  defaultBlockAvatarParameters,
  defaultOfficeChairParameters,
  defaultOfficeDeskParameters,
  defaultOfficeLaptopParameters,
  defaultOfficeMonitorParameters,
  defaultOfficeTowerParameters,
  normalizeBlockAvatarParameters,
  normalizeOfficeChairParameters,
  normalizeOfficeDeskParameters,
  normalizeOfficeLaptopParameters,
  normalizeOfficeMonitorParameters,
  normalizeOfficeTowerParameters,
  officeChairFeatureIds,
  officeChairGroupIds,
  officeChairLegFeatureId,
  officeChairParameterLimits,
  officeChairWheelFeatureId,
  officeDeskFeatureIds,
  officeDeskGroupIds,
  officeDeskParameterLimits,
  officeLaptopFeatureIds,
  officeLaptopGroupIds,
  officeLaptopJointIds,
  officeLaptopParameterLimits,
  officeMonitorFeatureIds,
  officeMonitorGroupIds,
  officeMonitorParameterLimits,
  officeTowerFanFeatureId,
  officeTowerFeatureIds,
  officeTowerGroupIds,
  officeTowerParameterLimits,
  type BlockAvatarParameters,
  type OfficeChairParameters,
  type OfficeDeskParameters,
  type OfficeLaptopParameters,
  type OfficeMonitorParameters,
  type OfficeTowerParameters,
} from "./model.js";
import { officeAssetPerformanceBudgets } from "./performance.js";
import type { OfficeExistingAssetKey } from "./types.js";

export const officeExistingAssetIds = {
  desk: "cyber-factory-office-desk",
  chair: "cyber-factory-office-chair",
  laptop: "cyber-factory-office-laptop",
  monitor: "cyber-factory-office-monitor",
  tower: "cyber-factory-office-tower",
  avatar: "cyber-factory-block-avatar",
} as const;

const materialLabels: Record<FeatureMaterialPreset, string> = {
  default: "默认材质",
  wood: "木质",
  metal: "金属",
  plastic: "塑料",
  glass: "玻璃",
  fabric: "织物",
  rubber: "橡胶",
};

function featureIds(model: CreateModelInput) {
  return model.featureGraph?.features.map((feature) => feature.id) ?? [];
}

function materialSlots(
  assetKey: OfficeExistingAssetKey,
  model: CreateModelInput,
): ModelAssetMaterialSlot[] {
  const slots = new Map<string, ModelAssetMaterialSlot>();
  for (const feature of model.featureGraph?.features ?? []) {
    const material = feature.appearance?.material ?? "default";
    const color = feature.appearance?.color;
    const slotKey = `${material}:${color ?? "none"}`;
    const existing = slots.get(slotKey);
    if (existing) {
      existing.featureIds.push(feature.id);
      continue;
    }
    const index = slots.size + 1;
    slots.set(slotKey, {
      id: `${assetKey}-${material}-${index}`,
      label: `${materialLabels[material]} ${index}`,
      material,
      ...(color ? { color } : {}),
      featureIds: [feature.id],
    });
  }
  return [...slots.values()];
}

function lod(
  key: OfficeExistingAssetKey,
  desktopFeatureSets: string[][],
  mobileFeatureSets: string[][],
): ModelAssetLodProfile[] {
  const budgets = officeAssetPerformanceBudgets[key];
  return [
    {
      device: "desktop",
      levels: budgets.desktop.map((budget, index) => ({
        id: budget.levelId,
        maximumDistance: index === 0 ? 5_000 : 14_000,
        featureIds: desktopFeatureSets[index]!,
        triangleBudget: budget.triangleBudget,
      })),
    },
    {
      device: "mobile",
      levels: budgets.mobile.map((budget, index) => ({
        id: budget.levelId,
        maximumDistance: index === 0 ? 8_000 : 16_000,
        featureIds: mobileFeatureSets[index]!,
        triangleBudget: budget.triangleBudget,
      })),
    },
  ];
}

function baseManifest(
  id: string,
  displayName: string,
  description: string,
  kind: ModelAssetManifest["kind"],
): Pick<ModelAssetManifest, "schemaVersion" | "id" | "displayName" | "description" | "version" | "kind" | "modelUnit" | "placement" | "tags"> {
  return {
    schemaVersion: 1,
    id,
    displayName,
    description,
    version: "1.0.0",
    kind,
    modelUnit: "mm",
    placement: {
      upAxis: "y",
      groundY: 0,
      origin: [0, 0, 0],
      defaultScale: [1, 1, 1],
    },
    tags: ["cyber-factory", "office", "planned"],
  };
}

export function createOfficeDeskManifest(
  input: Partial<OfficeDeskParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeOfficeDeskParameters(input);
  const model = createDesk(parameters);
  const all = featureIds(model);
  const core = [
    officeDeskFeatureIds.top,
    officeDeskFeatureIds.legFrontLeft,
    officeDeskFeatureIds.legFrontRight,
    officeDeskFeatureIds.legBackLeft,
    officeDeskFeatureIds.legBackRight,
    officeDeskFeatureIds.crossbar,
    officeDeskFeatureIds.modestyPanel,
  ];
  return {
    ...baseManifest(
      officeExistingAssetIds.desk,
      "办公桌",
      "具有真实工作面高度、线缆管理、放置基准和工位语义锚点的参数化办公桌。",
      "asset",
    ),
    parameters: [
      { id: "width", label: "桌面宽度", type: "number", defaultValue: parameters.width, unit: "mm", ...officeDeskParameterLimits.width },
      { id: "depth", label: "桌面深度", type: "number", defaultValue: parameters.depth, unit: "mm", ...officeDeskParameterLimits.depth },
      { id: "height", label: "工作面高度", type: "number", defaultValue: parameters.height, unit: "mm", ...officeDeskParameterLimits.height },
    ],
    materials: materialSlots("desk", model),
    colliders: [
      {
        id: "desk-top-collider",
        label: "桌面碰撞体",
        shape: "box",
        position: [0, parameters.height - 17, 0],
        rotation: [0, 0, 0],
        size: [parameters.width, 34, parameters.depth],
        featureId: officeDeskFeatureIds.top,
      },
      ...([
        ["desk-front-left-leg-collider", -1, -1, officeDeskFeatureIds.legFrontLeft],
        ["desk-front-right-leg-collider", 1, -1, officeDeskFeatureIds.legFrontRight],
        ["desk-back-left-leg-collider", -1, 1, officeDeskFeatureIds.legBackLeft],
        ["desk-back-right-leg-collider", 1, 1, officeDeskFeatureIds.legBackRight],
      ] as const).map(([id, xSign, zSign, target]) => ({
        id,
        label: "桌腿碰撞体",
        shape: "box" as const,
        position: [
          xSign * (parameters.width / 2 - Math.min(90, parameters.width * 0.08)),
          (parameters.height - 40) / 2,
          zSign * (parameters.depth / 2 - Math.min(80, parameters.depth * 0.12)),
        ] as Vector3Tuple,
        rotation: [0, 0, 0] as Vector3Tuple,
        size: [54, parameters.height - 40, 54] as Vector3Tuple,
        featureId: target,
      })),
    ],
    anchors: [
      {
        id: "desk-work-surface",
        label: "桌面设备放置基准",
        kind: "placement",
        position: [0, parameters.height, 0],
        rotation: [0, 0, 0],
        featureId: officeDeskFeatureIds.top,
        tags: ["work-surface", "device-placement"],
      },
      {
        id: "desk-front-approach",
        label: "工位接近位置",
        kind: "approach",
        position: [0, 0, -parameters.depth / 2 - 650],
        rotation: [0, 0, 0],
        range: 900,
        groupId: officeDeskGroupIds.frame,
        tags: ["workstation", "navigation"],
      },
      {
        id: "desk-chair-alignment",
        label: "座椅对齐基准",
        kind: "socket",
        position: [0, 0, -parameters.depth / 2 - 520],
        rotation: [0, 0, 0],
        tags: ["chair", "alignment"],
      },
      {
        id: "desk-height-control",
        label: "桌面高度控制",
        kind: "interaction",
        position: [parameters.width * 0.3375, parameters.height - 56, -parameters.depth / 2 - 6],
        rotation: [90, 0, 0],
        range: 850,
        featureId: officeDeskFeatureIds.heightButton,
        tags: ["height", "control", "planned-runtime"],
      },
      {
        id: "desk-work-action",
        label: "办公动作目标",
        kind: "interaction",
        position: [0, parameters.height, -80],
        rotation: [0, 0, 0],
        range: 1_000,
        groupId: officeDeskGroupIds.surface,
        tags: ["work", "planned-runtime"],
      },
    ],
    joints: [],
    lod: lod("desk", [all, core], [core]),
    previews: [
      { device: "desktop", cameraPosition: [2_200, 1_450, 2_500], cameraTarget: [0, 430, 0], background: "dark" },
      { device: "mobile", cameraPosition: [2_700, 1_650, 3_200], cameraTarget: [0, 430, 0], background: "dark" },
    ],
  };
}

export function createOfficeChairManifest(
  input: Partial<OfficeChairParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeOfficeChairParameters(input);
  const model = createChair(parameters);
  const all = featureIds(model);
  const core = [
    officeChairFeatureIds.column,
    officeChairFeatureIds.hub,
    ...Array.from({ length: 5 }, (_, index) => officeChairLegFeatureId(index)),
    officeChairFeatureIds.seat,
    officeChairFeatureIds.back,
    officeChairFeatureIds.headrest,
  ];
  const wheelOffset = Math.max(285, parameters.seatWidth * 0.585);
  return {
    ...baseManifest(
      officeExistingAssetIds.chair,
      "简易人体工学椅",
      "按 460 mm 默认座高校准的移动人体工学椅，包含坐下、接近和推动锚点。",
      "asset",
    ),
    parameters: [
      { id: "seat-width", label: "座面宽度", type: "number", defaultValue: parameters.seatWidth, unit: "mm", ...officeChairParameterLimits.seatWidth },
      { id: "seat-depth", label: "座面深度", type: "number", defaultValue: parameters.seatDepth, unit: "mm", ...officeChairParameterLimits.seatDepth },
      { id: "seat-height", label: "座面高度", type: "number", defaultValue: parameters.seatHeight, unit: "mm", ...officeChairParameterLimits.seatHeight },
      { id: "back-height", label: "靠背高度", type: "number", defaultValue: parameters.backHeight, unit: "mm", ...officeChairParameterLimits.backHeight },
    ],
    materials: materialSlots("chair", model),
    colliders: [
      {
        id: "chair-base-collider",
        label: "移动底座碰撞体",
        shape: "cylinder",
        position: [0, 50, 0],
        rotation: [0, 0, 0],
        size: [(wheelOffset + 32) * 2, 100, (wheelOffset + 32) * 2],
        radius: wheelOffset + 32,
        height: 100,
        dynamic: true,
        groupId: officeChairGroupIds.base,
      },
      {
        id: "chair-seat-collider",
        label: "坐垫碰撞体",
        shape: "box",
        position: [0, parameters.seatHeight - 36, -5],
        rotation: [-4, 0, 0],
        size: [parameters.seatWidth, 72, parameters.seatDepth],
        dynamic: true,
        featureId: officeChairFeatureIds.seat,
      },
      {
        id: "chair-back-collider",
        label: "靠背碰撞体",
        shape: "box",
        position: [0, parameters.seatHeight + 18 + parameters.backHeight / 2, -parameters.seatDepth / 2 + 35],
        rotation: [-8, 0, 0],
        size: [parameters.seatWidth - 20, parameters.backHeight, 74],
        dynamic: true,
        featureId: officeChairFeatureIds.back,
      },
    ],
    anchors: [
      {
        id: "chair-seat",
        label: "坐下位置",
        kind: "seat",
        position: [0, parameters.seatHeight, 25],
        rotation: [0, 0, 0],
        range: 720,
        featureId: officeChairFeatureIds.seat,
        tags: ["sit", "posture", "planned-runtime"],
      },
      {
        id: "chair-front-approach",
        label: "座椅接近位置",
        kind: "approach",
        position: [0, 0, parameters.seatDepth / 2 + 520],
        rotation: [0, 180, 0],
        range: 850,
        groupId: officeChairGroupIds.base,
        tags: ["chair", "navigation"],
      },
      {
        id: "chair-push-handle",
        label: "推动座椅位置",
        kind: "interaction",
        position: [0, parameters.seatHeight + parameters.backHeight * 0.72, -parameters.seatDepth / 2],
        rotation: [0, 0, 0],
        range: 850,
        featureId: officeChairFeatureIds.back,
        tags: ["push", "dynamic", "planned-runtime"],
      },
      {
        id: "chair-floor-origin",
        label: "地面放置基准",
        kind: "placement",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        groupId: officeChairGroupIds.base,
        tags: ["ground", "placement"],
      },
    ],
    joints: [],
    lod: lod("chair", [all, core], [core]),
    previews: [
      { device: "desktop", cameraPosition: [1_650, 1_250, 2_000], cameraTarget: [0, 590, 0], background: "dark" },
      { device: "mobile", cameraPosition: [2_000, 1_350, 2_450], cameraTarget: [0, 590, 0], background: "dark" },
    ],
  };
}

export function createOfficeLaptopManifest(
  input: Partial<OfficeLaptopParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeOfficeLaptopParameters(input);
  const model = createLaptop(parameters);
  const graph = model.featureGraph!;
  const all = featureIds(model);
  const core = [
    officeLaptopFeatureIds.base,
    officeLaptopFeatureIds.keyboard,
    officeLaptopFeatureIds.screenShell,
    officeLaptopFeatureIds.screenPanel,
  ];
  const screenShell = graph.features.find(({ id }) => id === officeLaptopFeatureIds.screenShell)!;
  const screenHeight = parameters.width * 260 / 380;
  return {
    ...baseManifest(
      officeExistingAssetIds.laptop,
      "笔记本",
      "具备屏幕关节、工作动作锚点和桌面放置基准的参数化办公笔记本。",
      "asset",
    ),
    parameters: [
      { id: "width", label: "机身宽度", type: "number", defaultValue: parameters.width, unit: "mm", ...officeLaptopParameterLimits.width },
      { id: "depth", label: "机身深度", type: "number", defaultValue: parameters.depth, unit: "mm", ...officeLaptopParameterLimits.depth },
      { id: "open-angle", label: "屏幕开合角", type: "number", defaultValue: parameters.openAngle, unit: "degree", ...officeLaptopParameterLimits.openAngle },
    ],
    materials: materialSlots("laptop", model),
    colliders: [
      {
        id: "laptop-base-collider",
        label: "笔记本底座碰撞体",
        shape: "box",
        position: [0, 4.5, 10],
        rotation: [0, 0, 0],
        size: [parameters.width, 9, parameters.depth],
        featureId: officeLaptopFeatureIds.base,
      },
      {
        id: "laptop-screen-collider",
        label: "屏幕碰撞体",
        shape: "box",
        position: screenShell.position,
        rotation: screenShell.rotation,
        size: [parameters.width, screenHeight, 7],
        dynamic: true,
        groupId: officeLaptopGroupIds.screen,
      },
    ],
    anchors: [
      {
        id: "laptop-desk-placement",
        label: "桌面放置基准",
        kind: "placement",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        featureId: officeLaptopFeatureIds.base,
        tags: ["desk", "placement"],
      },
      {
        id: "laptop-open-control",
        label: "屏幕开合控制",
        kind: "interaction",
        position: [0, 20, -parameters.depth / 2 + 10],
        rotation: [0, 0, 0],
        range: 950,
        jointId: officeLaptopJointIds.screenHinge,
        tags: ["open", "close", "planned-runtime"],
      },
      {
        id: "laptop-work-action",
        label: "键盘工作动作",
        kind: "interaction",
        position: [0, 9, 10],
        rotation: [0, 0, 0],
        range: 900,
        featureId: officeLaptopFeatureIds.keyboard,
        tags: ["work", "type", "planned-runtime"],
      },
      {
        id: "laptop-screen-socket",
        label: "屏幕内容挂接点",
        kind: "socket",
        position: screenShell.position,
        rotation: screenShell.rotation,
        featureId: officeLaptopFeatureIds.screenPanel,
        tags: ["screen", "world-surface"],
      },
      {
        id: "laptop-user-approach",
        label: "使用者接近位置",
        kind: "approach",
        position: [0, 0, parameters.depth / 2 + 620],
        rotation: [0, 180, 0],
        range: 1_050,
        groupId: officeLaptopGroupIds.base,
        tags: ["workstation", "navigation"],
      },
    ],
    joints: [{
      id: "laptop-screen-hinge-binding",
      label: "屏幕开合关节",
      jointId: officeLaptopJointIds.screenHinge,
      semantic: "screen-open-close",
    }],
    lod: lod("laptop", [all, core], [core]),
    previews: [
      { device: "desktop", cameraPosition: [850, 520, 900], cameraTarget: [0, 100, 0], background: "dark" },
      { device: "mobile", cameraPosition: [1_050, 620, 1_250], cameraTarget: [0, 100, 0], background: "dark" },
    ],
  };
}

export function createOfficeMonitorManifest(
  input: Partial<OfficeMonitorParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeOfficeMonitorParameters(input);
  const model = createMonitor(parameters);
  const all = featureIds(model);
  const core = [
    officeMonitorFeatureIds.shell,
    officeMonitorFeatureIds.panel,
    officeMonitorFeatureIds.neck,
    officeMonitorFeatureIds.base,
    officeMonitorFeatureIds.control,
  ];
  const displayCenterY = parameters.overallHeight - parameters.panelHeight / 2 - 30;
  return {
    ...baseManifest(
      officeExistingAssetIds.monitor,
      "电脑显示器",
      "具备电源交互、屏幕挂接点、碰撞体和桌面放置基准的参数化显示器。",
      "asset",
    ),
    parameters: [
      { id: "width", label: "显示器宽度", type: "number", defaultValue: parameters.width, unit: "mm", ...officeMonitorParameterLimits.width },
      { id: "panel-height", label: "面板高度", type: "number", defaultValue: parameters.panelHeight, unit: "mm", ...officeMonitorParameterLimits.panelHeight },
      { id: "overall-height", label: "整机高度", type: "number", defaultValue: parameters.overallHeight, unit: "mm", ...officeMonitorParameterLimits.overallHeight },
    ],
    materials: materialSlots("monitor", model),
    colliders: [
      {
        id: "monitor-base-collider",
        label: "显示器底座碰撞体",
        shape: "box",
        position: [0, 11, 45],
        rotation: [0, 0, 0],
        size: [360, 22, 235],
        featureId: officeMonitorFeatureIds.base,
      },
      {
        id: "monitor-display-collider",
        label: "显示器面板碰撞体",
        shape: "box",
        position: [0, displayCenterY, 0],
        rotation: [0, 0, 0],
        size: [parameters.width, parameters.panelHeight, 34],
        groupId: officeMonitorGroupIds.display,
      },
    ],
    anchors: [
      {
        id: "monitor-desk-placement",
        label: "桌面放置基准",
        kind: "placement",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        featureId: officeMonitorFeatureIds.base,
        tags: ["desk", "placement"],
      },
      {
        id: "monitor-power-control",
        label: "显示器电源控制",
        kind: "interaction",
        position: [parameters.width / 2 - 75, displayCenterY - parameters.panelHeight / 2 + 6, 40],
        rotation: [0, 180, 0],
        range: 1_050,
        featureId: officeMonitorFeatureIds.control,
        tags: ["power", "toggle", "planned-runtime"],
      },
      {
        id: "monitor-screen-socket",
        label: "屏幕内容挂接点",
        kind: "socket",
        position: [0, displayCenterY, 25],
        rotation: [0, 0, 0],
        featureId: officeMonitorFeatureIds.panel,
        tags: ["screen", "world-surface"],
      },
      {
        id: "monitor-view-target",
        label: "观看动作目标",
        kind: "interaction",
        position: [0, displayCenterY, 160],
        rotation: [0, 180, 0],
        range: 1_350,
        groupId: officeMonitorGroupIds.display,
        tags: ["view", "work", "planned-runtime"],
      },
    ],
    joints: [],
    lod: lod("monitor", [all, core], [core]),
    previews: [
      { device: "desktop", cameraPosition: [1_350, 900, 1_550], cameraTarget: [0, 360, 0], background: "dark" },
      { device: "mobile", cameraPosition: [1_650, 1_000, 2_000], cameraTarget: [0, 360, 0], background: "dark" },
    ],
  };
}

export function createOfficeTowerManifest(
  input: Partial<OfficeTowerParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeOfficeTowerParameters(input);
  const model = createTower(parameters);
  const all = featureIds(model);
  const core = [
    officeTowerFeatureIds.chassis,
    officeTowerFeatureIds.bottomFrame,
    officeTowerFeatureIds.topFrame,
    officeTowerFeatureIds.leftPanel,
    officeTowerFeatureIds.sidePanel,
    officeTowerFeatureIds.frontPanel,
    officeTowerFeatureIds.power,
  ];
  return {
    ...baseManifest(
      officeExistingAssetIds.tower,
      "主机箱",
      "带电源控制、维护接近点、桌面或地面放置基准和性能层级的参数化主机箱。",
      "asset",
    ),
    parameters: [
      { id: "width", label: "机箱宽度", type: "number", defaultValue: parameters.width, unit: "mm", ...officeTowerParameterLimits.width },
      { id: "depth", label: "机箱深度", type: "number", defaultValue: parameters.depth, unit: "mm", ...officeTowerParameterLimits.depth },
      { id: "height", label: "机箱高度", type: "number", defaultValue: parameters.height, unit: "mm", ...officeTowerParameterLimits.height },
    ],
    materials: materialSlots("tower", model),
    colliders: [{
      id: "tower-chassis-collider",
      label: "主机箱碰撞体",
      shape: "box",
      position: [0, parameters.height / 2, 0],
      rotation: [0, 0, 0],
      size: [parameters.width, parameters.height, parameters.depth],
      groupId: officeTowerGroupIds.chassis,
    }],
    anchors: [
      {
        id: "tower-placement",
        label: "桌面或地面放置基准",
        kind: "placement",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        featureId: officeTowerFeatureIds.bottomFrame,
        tags: ["desk", "floor", "placement"],
      },
      {
        id: "tower-power-control",
        label: "主机电源控制",
        kind: "interaction",
        position: [parameters.width / 2 - 52, parameters.height - 30, parameters.depth / 2 + 20],
        rotation: [0, 180, 0],
        range: 950,
        featureId: officeTowerFeatureIds.power,
        tags: ["power", "toggle", "planned-runtime"],
      },
      {
        id: "tower-rear-maintenance",
        label: "主机维护接近位置",
        kind: "approach",
        position: [0, 0, -parameters.depth / 2 - 620],
        rotation: [0, 0, 0],
        range: 1_000,
        groupId: officeTowerGroupIds.chassis,
        tags: ["maintenance", "planned-runtime"],
      },
    ],
    joints: [],
    lod: lod("tower", [all, core], [core]),
    previews: [
      { device: "desktop", cameraPosition: [1_050, 720, 1_350], cameraTarget: [0, 270, 0], background: "dark" },
      { device: "mobile", cameraPosition: [1_300, 820, 1_700], cameraTarget: [0, 270, 0], background: "dark" },
    ],
  };
}

export function createBlockAvatarManifest(
  input: Partial<BlockAvatarParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeBlockAvatarParameters(input);
  const model = createBlockAvatar(parameters);
  const all = featureIds(model);
  const pixel = parameters.height / 32;
  const halfWidth = (parameters.skinModel === "slim" ? 7 : 8) * pixel;
  const jointLabels: Record<keyof typeof blockAvatarJointIds, string> = {
    torso: "躯干俯仰",
    head: "颈部俯仰",
    leftArm: "左肩",
    rightArm: "右肩",
    leftHip: "左髋",
    leftKnee: "左膝",
    rightHip: "右髋",
    rightKnee: "右膝",
  };
  return {
    ...baseManifest(
      officeExistingAssetIds.avatar,
      "原创方块角色",
      "1720 mm 默认身高的方块角色，包含完整关节绑定、移动姿态和手部/视线/动作锚点。",
      "character",
    ),
    parameters: [
      { id: "height", label: "角色身高", type: "number", defaultValue: parameters.height, unit: "mm", ...blockAvatarParameterLimits.height },
      { id: "skin-model", label: "皮肤模型", type: "select", defaultValue: parameters.skinModel, options: ["classic", "slim"] },
    ],
    materials: materialSlots("avatar", model),
    colliders: [{
      id: "avatar-body-collider",
      label: "角色移动胶囊体",
      shape: "capsule",
      position: [0, parameters.height / 2, 0],
      rotation: [0, 0, 0],
      size: [halfWidth * 2, parameters.height, halfWidth * 2],
      radius: halfWidth,
      height: parameters.height - halfWidth * 2,
      dynamic: true,
      groupId: blockAvatarGroupIds.torso,
    }],
    anchors: [
      {
        id: "avatar-ground-origin",
        label: "角色足底基准",
        kind: "placement",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        tags: ["ground", "spawn"],
      },
      {
        id: "avatar-eye-line",
        label: "角色视线锚点",
        kind: "socket",
        position: [0, 29 * pixel, 4 * pixel],
        rotation: [0, 0, 0],
        featureId: blockAvatarFeatureIds.head,
        tags: ["camera", "view"],
      },
      {
        id: "avatar-left-hand-action",
        label: "左手动作锚点",
        kind: "socket",
        position: [-6 * pixel, 12 * pixel, 0],
        rotation: [0, 0, 0],
        jointId: blockAvatarJointIds.leftArm,
        tags: ["hand", "grip", "action"],
      },
      {
        id: "avatar-right-hand-action",
        label: "右手动作锚点",
        kind: "socket",
        position: [6 * pixel, 12 * pixel, 0],
        rotation: [0, 0, 0],
        jointId: blockAvatarJointIds.rightArm,
        tags: ["hand", "grip", "action"],
      },
      {
        id: "avatar-seat-pose-origin",
        label: "坐姿根锚点",
        kind: "seat",
        position: [0, 12 * pixel, 0],
        rotation: [0, 0, 0],
        jointId: blockAvatarJointIds.torso,
        tags: ["sit", "pose", "planned-runtime"],
      },
      {
        id: "avatar-action-origin",
        label: "语义动作原点",
        kind: "interaction",
        position: [0, 16 * pixel, 3 * pixel],
        rotation: [0, 0, 0],
        range: 1_200,
        groupId: blockAvatarGroupIds.torso,
        tags: ["action", "planned-runtime"],
      },
    ],
    joints: Object.entries(blockAvatarJointIds).map(([key, jointId]) => ({
      id: `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-binding`,
      label: jointLabels[key as keyof typeof blockAvatarJointIds],
      jointId,
      semantic: key,
    })),
    lod: lod("avatar", [all], [all]),
    previews: [
      { device: "desktop", cameraPosition: [2_100, 1_450, 2_500], cameraTarget: [0, 860, 0], background: "dark" },
      { device: "mobile", cameraPosition: [2_600, 1_600, 3_100], cameraTarget: [0, 860, 0], background: "dark" },
    ],
  };
}

function definition(
  manifest: ModelAssetManifest,
  createModel: () => CreateModelInput,
): ModelAssetDefinition {
  return assertModelAssetDefinition({ manifest, createModel });
}

export function createOfficeDeskDefinition(input: Partial<OfficeDeskParameters> = {}) {
  const parameters = normalizeOfficeDeskParameters(input);
  return definition(createOfficeDeskManifest(parameters), () => createDesk(parameters));
}

export function createOfficeChairDefinition(input: Partial<OfficeChairParameters> = {}) {
  const parameters = normalizeOfficeChairParameters(input);
  return definition(createOfficeChairManifest(parameters), () => createChair(parameters));
}

export function createOfficeLaptopDefinition(input: Partial<OfficeLaptopParameters> = {}) {
  const parameters = normalizeOfficeLaptopParameters(input);
  return definition(createOfficeLaptopManifest(parameters), () => createLaptop(parameters));
}

export function createOfficeMonitorDefinition(input: Partial<OfficeMonitorParameters> = {}) {
  const parameters = normalizeOfficeMonitorParameters(input);
  return definition(createOfficeMonitorManifest(parameters), () => createMonitor(parameters));
}

export function createOfficeTowerDefinition(input: Partial<OfficeTowerParameters> = {}) {
  const parameters = normalizeOfficeTowerParameters(input);
  return definition(createOfficeTowerManifest(parameters), () => createTower(parameters));
}

export function createBlockAvatarDefinition(input: Partial<BlockAvatarParameters> = {}) {
  const parameters = normalizeBlockAvatarParameters(input);
  return definition(createBlockAvatarManifest(parameters), () => createBlockAvatar(parameters));
}

export const officeDeskDefinition = createOfficeDeskDefinition(defaultOfficeDeskParameters);
export const officeChairDefinition = createOfficeChairDefinition(defaultOfficeChairParameters);
export const officeLaptopDefinition = createOfficeLaptopDefinition(defaultOfficeLaptopParameters);
export const officeMonitorDefinition = createOfficeMonitorDefinition(defaultOfficeMonitorParameters);
export const officeTowerDefinition = createOfficeTowerDefinition(defaultOfficeTowerParameters);
export const blockAvatarDefinition = createBlockAvatarDefinition(defaultBlockAvatarParameters);

export const officeAssetDefinitions = [
  officeDeskDefinition,
  officeChairDefinition,
  officeLaptopDefinition,
  officeMonitorDefinition,
  officeTowerDefinition,
  blockAvatarDefinition,
] as const;

export const officeAssetDefinitionByKey = {
  desk: officeDeskDefinition,
  chair: officeChairDefinition,
  laptop: officeLaptopDefinition,
  monitor: officeMonitorDefinition,
  tower: officeTowerDefinition,
  avatar: blockAvatarDefinition,
} as const satisfies Record<OfficeExistingAssetKey, ModelAssetDefinition>;
