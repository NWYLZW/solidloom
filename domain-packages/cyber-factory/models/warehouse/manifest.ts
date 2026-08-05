import type {
  BoxFeature,
  ModelAssetDefinition,
  ModelAssetManifest,
  ModelFeature,
} from "@solidloom/shared";
import {
  createWarehouseCart,
  createWarehousePallet,
  createWarehouseRack,
  createWarehouseStackerCrane,
  createWarehouseTote,
  defaultWarehouseCartParameters,
  defaultWarehousePalletParameters,
  defaultWarehouseRackParameters,
  defaultWarehouseStackerCraneParameters,
  defaultWarehouseStackerCranePose,
  defaultWarehouseToteParameters,
  normalizeWarehouseCartParameters,
  normalizeWarehousePalletParameters,
  normalizeWarehouseRackParameters,
  normalizeWarehouseStackerCraneParameters,
  normalizeWarehouseToteParameters,
  warehouseGroupIds,
  warehouseRackBayX,
  warehouseRackShelfY,
  type WarehouseCartParameters,
  type WarehousePalletParameters,
  type WarehouseRackParameters,
  type WarehouseStackerCraneParameters,
  type WarehouseToteParameters,
} from "./model.js";

function featureIds(features: ModelFeature[]) {
  return features.map((feature) => feature.id);
}

function boxFeatures(features: ModelFeature[]): BoxFeature[] {
  return features.filter((feature): feature is BoxFeature => feature.type === "box");
}

function fixedPlacement(): ModelAssetManifest["placement"] {
  return {
    upAxis: "y",
    groundY: 0,
    origin: [0, 0, 0],
    defaultScale: [1, 1, 1],
  };
}

export function createWarehouseRackManifest(
  input: Partial<WarehouseRackParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeWarehouseRackParameters(input);
  const model = createWarehouseRack(parameters);
  const graph = model.featureGraph!;
  const allIds = featureIds(graph.features);
  const detailIds = allIds.filter((id) => id.includes("back-brace"));
  const coreIds = allIds.filter((id) => !detailIds.includes(id));
  const collidable = boxFeatures(graph.features).filter((feature) => (
    feature.id.includes("upright") || feature.id.includes("shelf-") || feature.id.includes("level-beam")
  ));
  const colliders = collidable.map((feature) => ({
    id: `${feature.id}-collider`,
    label: `${feature.name}碰撞体`,
    shape: "box" as const,
    position: feature.position,
    rotation: feature.rotation,
    size: [feature.parameters.width, feature.parameters.height, feature.parameters.depth] as [number, number, number],
    featureId: feature.id,
  }));
  const anchors: ModelAssetManifest["anchors"] = [{
    id: "warehouse-rack-front-approach",
    label: "货架正面接近位",
    kind: "approach",
    position: [0, 0, parameters.depth / 2 + 900],
    rotation: [0, 180, 0],
    range: 1_200,
    groupId: warehouseGroupIds.rackStructure,
    tags: ["navigation", "warehouse", "front"],
  }];
  for (let bay = 0; bay < parameters.bayCount; bay += 1) {
    for (let level = 0; level < parameters.levelCount; level += 1) {
      const suffix = `b${String(bay + 1).padStart(2, "0")}-l${String(level + 1).padStart(2, "0")}`;
      const x = warehouseRackBayX(parameters, bay);
      const y = warehouseRackShelfY(parameters, level) + 44;
      anchors.push(
        {
          id: `warehouse-rack-slot-${suffix}`,
          label: `第 ${bay + 1} 跨第 ${level + 1} 层货位`,
          kind: "socket",
          position: [x, y, 0],
          rotation: [0, 0, 0],
          range: Math.min(500, parameters.bayWidth * 0.42),
          groupId: warehouseGroupIds.rackStorage,
          tags: ["warehouse", "storage-slot", `bay-${bay + 1}`, `level-${level + 1}`],
        },
        {
          id: `warehouse-rack-pick-${suffix}`,
          label: `第 ${bay + 1} 跨第 ${level + 1} 层取货位`,
          kind: "interaction",
          position: [x, y + 100, parameters.depth / 2 + 360],
          rotation: [0, 180, 0],
          range: 980,
          groupId: warehouseGroupIds.rackStorage,
          tags: ["warehouse", "pick", `bay-${bay + 1}`, `level-${level + 1}`],
        },
        {
          id: `warehouse-rack-restock-${suffix}`,
          label: `第 ${bay + 1} 跨第 ${level + 1} 层补货位`,
          kind: "interaction",
          position: [x, y + 100, -parameters.depth / 2 - 360],
          rotation: [0, 0, 0],
          range: 980,
          groupId: warehouseGroupIds.rackStorage,
          tags: ["warehouse", "restock", `bay-${bay + 1}`, `level-${level + 1}`],
        },
      );
    }
  }
  return {
    schemaVersion: 1,
    id: "cyber-factory-warehouse-rack",
    displayName: "参数化仓储货架",
    description: "可按跨数与层数生成稳定货位、取货位和补货位的金属仓储货架。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "bay-count", label: "货架跨数", type: "number", defaultValue: parameters.bayCount, minimum: 1, step: 1 },
      { id: "level-count", label: "货架层数", type: "number", defaultValue: parameters.levelCount, minimum: 2, step: 1 },
      { id: "bay-width", label: "单跨宽度", type: "number", defaultValue: parameters.bayWidth, unit: "mm", minimum: 800, maximum: 1_400, step: 50 },
      { id: "height", label: "货架高度", type: "number", defaultValue: parameters.height, unit: "mm", minimum: 1_800, maximum: 3_600, step: 100 },
      { id: "depth", label: "货架深度", type: "number", defaultValue: parameters.depth, unit: "mm", minimum: 600, maximum: 1_200, step: 50 },
    ],
    materials: [{ id: "rack-metal", label: "镀锌金属货架", material: "metal", color: "#71858E", featureIds: allIds }],
    placement: fixedPlacement(),
    colliders,
    anchors,
    joints: [],
    lod: [
      { device: "desktop", levels: [
        { id: "rack-desktop-full", maximumDistance: 8_000, featureIds: allIds, triangleBudget: Math.max(1_600, allIds.length * 16) },
        { id: "rack-desktop-core", maximumDistance: 18_000, featureIds: coreIds, triangleBudget: Math.max(1_200, coreIds.length * 16) },
      ] },
      { device: "mobile", levels: [
        { id: "rack-mobile-core", maximumDistance: 10_000, featureIds: coreIds, triangleBudget: Math.max(1_000, coreIds.length * 12) },
      ] },
    ],
    previews: [
      { device: "desktop", cameraPosition: [4_800, 3_500, 5_900], cameraTarget: [0, 1_300, 0], background: "dark" },
      { device: "mobile", cameraPosition: [6_300, 3_700, 7_500], cameraTarget: [0, 1_250, 0], background: "dark" },
    ],
    tags: ["cyber-factory", "warehouse", "rack", "storage", "planned"],
  };
}

export function createWarehousePalletManifest(
  input: Partial<WarehousePalletParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeWarehousePalletParameters(input);
  const model = createWarehousePallet(parameters);
  const features = model.featureGraph!.features;
  const allIds = featureIds(features);
  const runnerIds = allIds.filter((id) => id.includes("runner"));
  const representativeBoards = ["warehouse-pallet-top-board-01", "warehouse-pallet-top-board-04", "warehouse-pallet-top-board-07"];
  return {
    schemaVersion: 1,
    id: "cyber-factory-warehouse-pallet",
    displayName: "参数化仓储托盘",
    description: "带前后叉车入口和顶部装载面的木质仓储托盘。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "width", label: "托盘宽度", type: "number", defaultValue: parameters.width, unit: "mm", minimum: 800, maximum: 1_300, step: 50 },
      { id: "depth", label: "托盘深度", type: "number", defaultValue: parameters.depth, unit: "mm", minimum: 600, maximum: 1_200, step: 50 },
      { id: "height", label: "托盘高度", type: "number", defaultValue: parameters.height, unit: "mm", minimum: 110, maximum: 190, step: 1 },
    ],
    materials: [{ id: "pallet-wood", label: "托盘木材", material: "wood", color: "#C99861", featureIds: allIds }],
    placement: fixedPlacement(),
    colliders: [
      {
        id: "warehouse-pallet-deck-collider",
        label: "托盘承载面碰撞体",
        shape: "box",
        position: [0, parameters.height * 0.77, 0],
        rotation: [0, 0, 0],
        size: [parameters.width, parameters.height * 0.46, parameters.depth],
        groupId: warehouseGroupIds.pallet,
      },
      ...[-0.4, 0, 0.4].map((ratio, index) => ({
        id: `warehouse-pallet-runner-${String(index + 1).padStart(2, "0")}-collider`,
        label: `第 ${index + 1} 条承重梁碰撞体`,
        shape: "box" as const,
        position: [parameters.width * ratio, parameters.height * 0.27, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        size: [82, parameters.height * 0.54, parameters.depth] as [number, number, number],
        featureId: runnerIds[index]!,
      })),
    ],
    anchors: [
      { id: "warehouse-pallet-load-socket", label: "托盘装载面", kind: "socket", position: [0, parameters.height, 0], rotation: [0, 0, 0], range: 620, groupId: warehouseGroupIds.pallet, tags: ["warehouse", "load", "placement"] },
      { id: "warehouse-pallet-fork-entry-front", label: "前侧货叉入口", kind: "interaction", position: [0, parameters.height * 0.33, parameters.depth / 2 + 240], rotation: [0, 180, 0], range: 700, groupId: warehouseGroupIds.pallet, tags: ["warehouse", "forklift", "fork-entry"] },
      { id: "warehouse-pallet-fork-entry-rear", label: "后侧货叉入口", kind: "interaction", position: [0, parameters.height * 0.33, -parameters.depth / 2 - 240], rotation: [0, 0, 0], range: 700, groupId: warehouseGroupIds.pallet, tags: ["warehouse", "forklift", "fork-entry"] },
    ],
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "pallet-desktop-full", maximumDistance: 6_000, featureIds: allIds, triangleBudget: 420 }] },
      { device: "mobile", levels: [{ id: "pallet-mobile-core", maximumDistance: 8_000, featureIds: [...runnerIds, ...representativeBoards], triangleBudget: 220 }] },
    ],
    previews: [
      { device: "desktop", cameraPosition: [1_800, 1_100, 2_100], cameraTarget: [0, 120, 0], background: "dark" },
      { device: "mobile", cameraPosition: [2_300, 1_300, 2_800], cameraTarget: [0, 120, 0], background: "dark" },
    ],
    tags: ["cyber-factory", "warehouse", "pallet", "logistics", "planned"],
  };
}

export function createWarehouseToteManifest(
  input: Partial<WarehouseToteParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeWarehouseToteParameters(input);
  const model = createWarehouseTote(parameters);
  const features = model.featureGraph!.features;
  const allIds = featureIds(features);
  const coreIds = allIds.filter((id) => !id.includes("grip"));
  const colliders = boxFeatures(features).filter((feature) => !feature.id.includes("grip")).map((feature) => ({
    id: `${feature.id}-collider`,
    label: `${feature.name}碰撞体`,
    shape: "box" as const,
    position: feature.position,
    rotation: feature.rotation,
    size: [feature.parameters.width, feature.parameters.height, feature.parameters.depth] as [number, number, number],
    featureId: feature.id,
  }));
  return {
    schemaVersion: 1,
    id: "cyber-factory-warehouse-tote",
    displayName: "参数化仓储周转箱",
    description: "带开放内腔、内容挂接位和双侧搬运锚点的塑料周转箱。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "width", label: "周转箱宽度", type: "number", defaultValue: parameters.width, unit: "mm", minimum: 400, maximum: 800, step: 20 },
      { id: "depth", label: "周转箱深度", type: "number", defaultValue: parameters.depth, unit: "mm", minimum: 300, maximum: 600, step: 20 },
      { id: "height", label: "周转箱高度", type: "number", defaultValue: parameters.height, unit: "mm", minimum: 240, maximum: 520, step: 20 },
    ],
    materials: [
      { id: "tote-plastic", label: "周转箱塑料", material: "plastic", color: "#45A8BF", featureIds: coreIds },
      { id: "tote-grip-plastic", label: "搬运握边塑料", material: "plastic", color: "#236A7C", featureIds: allIds.filter((id) => id.includes("grip")) },
    ],
    placement: fixedPlacement(),
    colliders,
    anchors: [
      { id: "warehouse-tote-content-socket", label: "周转箱内容挂接位", kind: "socket", position: [0, 34, 0], rotation: [0, 0, 0], range: 340, groupId: warehouseGroupIds.tote, tags: ["warehouse", "container", "content"] },
      { id: "warehouse-tote-pickup-left", label: "左侧搬运位", kind: "interaction", position: [-parameters.width / 2 - 220, parameters.height * 0.72, 0], rotation: [0, -90, 0], range: 620, groupId: warehouseGroupIds.tote, tags: ["warehouse", "pickup", "carry"] },
      { id: "warehouse-tote-pickup-right", label: "右侧搬运位", kind: "interaction", position: [parameters.width / 2 + 220, parameters.height * 0.72, 0], rotation: [0, 90, 0], range: 620, groupId: warehouseGroupIds.tote, tags: ["warehouse", "pickup", "carry"] },
    ],
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "tote-desktop-full", maximumDistance: 4_500, featureIds: allIds, triangleBudget: 320 }] },
      { device: "mobile", levels: [{ id: "tote-mobile-core", maximumDistance: 7_000, featureIds: coreIds, triangleBudget: 180 }] },
    ],
    previews: [
      { device: "desktop", cameraPosition: [1_300, 850, 1_500], cameraTarget: [0, 180, 0], background: "dark" },
      { device: "mobile", cameraPosition: [1_750, 980, 2_000], cameraTarget: [0, 180, 0], background: "dark" },
    ],
    tags: ["cyber-factory", "warehouse", "tote", "container", "planned"],
  };
}

export function createWarehouseCartManifest(
  input: Partial<WarehouseCartParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeWarehouseCartParameters(input);
  const model = createWarehouseCart(parameters);
  const features = model.featureGraph!.features;
  const allIds = featureIds(features);
  const wheelIds = allIds.filter((id) => id.includes("wheel"));
  const frameIds = allIds.filter((id) => !wheelIds.includes(id));
  const mobileIds = allIds.filter((id) => id !== "warehouse-cart-lower-deck");
  return {
    schemaVersion: 1,
    id: "cyber-factory-warehouse-cart",
    displayName: "参数化仓储推车",
    description: "带双层承载面、推行把手和四轮的内部物流推车。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "width", label: "推车宽度", type: "number", defaultValue: parameters.width, unit: "mm", minimum: 650, maximum: 1_100, step: 50 },
      { id: "depth", label: "推车深度", type: "number", defaultValue: parameters.depth, unit: "mm", minimum: 900, maximum: 1_500, step: 10 },
      { id: "deck-height", label: "承载台高度", type: "number", defaultValue: parameters.deckHeight, unit: "mm", minimum: 240, maximum: 460, step: 10 },
      { id: "handle-height", label: "把手高度", type: "number", defaultValue: parameters.handleHeight, unit: "mm", minimum: 720, maximum: 1_400, step: 20 },
    ],
    materials: [
      { id: "cart-metal", label: "推车金属", material: "metal", color: "#82959C", featureIds: frameIds },
      { id: "cart-rubber", label: "推车轮胎", material: "rubber", color: "#20282C", featureIds: wheelIds },
    ],
    placement: fixedPlacement(),
    colliders: [
      { id: "warehouse-cart-main-deck-collider", label: "主承载台碰撞体", shape: "box", position: [0, parameters.deckHeight, 0], rotation: [0, 0, 0], size: [parameters.width, 72, parameters.depth], featureId: "warehouse-cart-main-deck" },
      { id: "warehouse-cart-handle-collider", label: "推行把手碰撞体", shape: "box", position: [0, parameters.handleHeight, -parameters.depth / 2 + 42], rotation: [0, 0, 0], size: [parameters.width * 0.86, 54, 54], featureId: "warehouse-cart-handle-bar" },
      ...wheelIds.map((id) => {
        const wheel = features.find((feature) => feature.id === id)!;
        return {
          id: `${id}-collider`,
          label: `${wheel.name}碰撞体`,
          shape: "cylinder" as const,
          position: wheel.position,
          rotation: wheel.rotation,
          size: [164, 48, 164] as [number, number, number],
          radius: 82,
          height: 48,
          featureId: id,
        };
      }),
    ],
    anchors: [
      { id: "warehouse-cart-load-socket", label: "推车装载面", kind: "socket", position: [0, parameters.deckHeight + 36, 0], rotation: [0, 0, 0], range: 620, groupId: warehouseGroupIds.cartFrame, tags: ["warehouse", "load", "placement"] },
      { id: "warehouse-cart-push-handle", label: "推车推行位", kind: "interaction", position: [0, parameters.handleHeight, -parameters.depth / 2 - 320], rotation: [0, 0, 0], range: 780, featureId: "warehouse-cart-handle-bar", tags: ["warehouse", "push", "transport"] },
      { id: "warehouse-cart-front-approach", label: "推车前侧接近位", kind: "approach", position: [0, 0, parameters.depth / 2 + 560], rotation: [0, 180, 0], range: 900, groupId: warehouseGroupIds.cartFrame, tags: ["warehouse", "navigation", "front"] },
    ],
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "cart-desktop-full", maximumDistance: 5_000, featureIds: allIds, triangleBudget: 620 }] },
      { device: "mobile", levels: [{ id: "cart-mobile-core", maximumDistance: 8_000, featureIds: mobileIds, triangleBudget: 420 }] },
    ],
    previews: [
      { device: "desktop", cameraPosition: [2_000, 1_450, 2_500], cameraTarget: [0, 520, 0], background: "dark" },
      { device: "mobile", cameraPosition: [2_700, 1_600, 3_300], cameraTarget: [0, 500, 0], background: "dark" },
    ],
    tags: ["cyber-factory", "warehouse", "cart", "logistics", "planned"],
  };
}

export function createWarehouseStackerCraneManifest(
  input: Partial<WarehouseStackerCraneParameters> = {},
): ModelAssetManifest {
  const parameters = normalizeWarehouseStackerCraneParameters(input);
  const model = createWarehouseStackerCrane(parameters, defaultWarehouseStackerCranePose);
  const features = model.featureGraph!.features;
  const allIds = featureIds(features);
  const railIds = allIds.filter((id) => id.includes("rail") || id.includes("end-stop"));
  const forkIds = allIds.filter((id) => id.includes("fork"));
  const wheelIds = allIds.filter((id) => id.includes("wheel"));
  const carriageIds = allIds.filter((id) => id.includes("carriage"));
  const frameIds = allIds.filter((id) => !railIds.includes(id) && !forkIds.includes(id) && !wheelIds.includes(id) && !carriageIds.includes(id));
  const mobileIds = allIds.filter((id) => !wheelIds.includes(id) && id !== "warehouse-stacker-control-cabinet");
  const colliders = boxFeatures(features)
    .filter((feature) => !feature.id.includes("guard"))
    .map((feature) => ({
      id: `${feature.id}-collider`,
      label: `${feature.name}碰撞体`,
      shape: "box" as const,
      position: feature.position,
      rotation: feature.rotation,
      size: [feature.parameters.width, feature.parameters.height, feature.parameters.depth] as [number, number, number],
      featureId: feature.id,
      dynamic: !railIds.includes(feature.id),
    }));
  return {
    schemaVersion: 1,
    id: "cyber-factory-warehouse-stacker-crane",
    displayName: "参数化巷道堆垛机",
    description: "默认轨道宽度和立柱高度与三跨货架对齐，并可按仓库跨度扩展的自动化仓储取放设备。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "rail-length", label: "轨道长度", type: "number", defaultValue: parameters.railLength, unit: "mm", minimum: 3_500, maximum: 30_000, step: 500 },
      { id: "mast-height", label: "立柱高度", type: "number", defaultValue: parameters.mastHeight, unit: "mm", minimum: 2_400, maximum: 8_000, step: 100 },
      { id: "carriage-width", label: "载货台宽度", type: "number", defaultValue: parameters.carriageWidth, unit: "mm", minimum: 700, maximum: 1_600, step: 50 },
      { id: "carriage-depth", label: "载货台深度", type: "number", defaultValue: parameters.carriageDepth, unit: "mm", minimum: 600, maximum: 1_400, step: 50 },
      { id: "fork-reach", label: "货叉行程", type: "number", defaultValue: parameters.forkReach, unit: "mm", minimum: 400, maximum: 2_400, step: 50 },
    ],
    materials: [
      { id: "stacker-rails", label: "堆垛机轨道", material: "metal", color: "#71858E", featureIds: railIds },
      { id: "stacker-frame", label: "堆垛机机架", material: "metal", color: "#E3A62F", featureIds: frameIds },
      { id: "stacker-carriage", label: "堆垛机载货台", material: "metal", color: "#D6E0E2", featureIds: carriageIds },
      { id: "stacker-forks", label: "堆垛机货叉", material: "metal", color: "#5BC6B5", featureIds: forkIds },
      { id: "stacker-wheels", label: "堆垛机行走轮", material: "rubber", color: "#20282C", featureIds: wheelIds },
    ],
    placement: fixedPlacement(),
    colliders,
    anchors: [
      { id: "warehouse-stacker-fork-load-socket", label: "货叉装载位", kind: "socket", position: [0, defaultWarehouseStackerCranePose.liftY + 34, parameters.carriageDepth / 2], rotation: [0, 0, 0], range: 620, groupId: warehouseGroupIds.stackerForks, tags: ["warehouse", "cargo", "planned-attachment"] },
      { id: "warehouse-stacker-control-panel", label: "堆垛机控制面板", kind: "interaction", position: [-parameters.carriageWidth * 0.34, 640, -parameters.carriageDepth * 0.65], rotation: [0, 0, 0], range: 720, featureId: "warehouse-stacker-control-cabinet", tags: ["warehouse", "automation", "planned-control"] },
      { id: "warehouse-stacker-outbound-socket", label: "载货台内出库放置位", kind: "placement", position: [0, defaultWarehouseStackerCranePose.liftY, 0], rotation: [0, 180, 0], range: 620, groupId: warehouseGroupIds.stackerCarriage, tags: ["warehouse", "outbound", "planned-attachment"] },
      { id: "warehouse-stacker-maintenance-approach", label: "堆垛机维护接近位", kind: "approach", position: [0, 0, -parameters.carriageDepth * 1.1], rotation: [0, 0, 0], range: 900, groupId: warehouseGroupIds.stackerTravelFrame, tags: ["warehouse", "maintenance", "navigation"] },
    ],
    joints: [],
    lod: [
      { device: "desktop", levels: [{ id: "stacker-desktop-full", maximumDistance: 18_000, featureIds: allIds, triangleBudget: Math.max(1_800, allIds.length * 24) }] },
      { device: "mobile", levels: [{ id: "stacker-mobile-core", maximumDistance: 22_000, featureIds: mobileIds, triangleBudget: Math.max(1_100, mobileIds.length * 16) }] },
    ],
    previews: [
      { device: "desktop", cameraPosition: [5_800, 4_200, 6_200], cameraTarget: [0, 1_500, 500], background: "dark" },
      { device: "mobile", cameraPosition: [7_000, 5_000, 7_800], cameraTarget: [0, 1_450, 500], background: "dark" },
    ],
    tags: ["cyber-factory", "warehouse", "stacker-crane", "automated-storage", "retrieval", "planned"],
  };
}

export function createWarehouseRackDefinition(input: Partial<WarehouseRackParameters> = {}): ModelAssetDefinition {
  const parameters = normalizeWarehouseRackParameters(input);
  return { manifest: createWarehouseRackManifest(parameters), createModel: () => createWarehouseRack(parameters) };
}

export function createWarehousePalletDefinition(input: Partial<WarehousePalletParameters> = {}): ModelAssetDefinition {
  const parameters = normalizeWarehousePalletParameters(input);
  return { manifest: createWarehousePalletManifest(parameters), createModel: () => createWarehousePallet(parameters) };
}

export function createWarehouseToteDefinition(input: Partial<WarehouseToteParameters> = {}): ModelAssetDefinition {
  const parameters = normalizeWarehouseToteParameters(input);
  return { manifest: createWarehouseToteManifest(parameters), createModel: () => createWarehouseTote(parameters) };
}

export function createWarehouseCartDefinition(input: Partial<WarehouseCartParameters> = {}): ModelAssetDefinition {
  const parameters = normalizeWarehouseCartParameters(input);
  return { manifest: createWarehouseCartManifest(parameters), createModel: () => createWarehouseCart(parameters) };
}

export function createWarehouseStackerCraneDefinition(input: Partial<WarehouseStackerCraneParameters> = {}): ModelAssetDefinition {
  const parameters = normalizeWarehouseStackerCraneParameters(input);
  return { manifest: createWarehouseStackerCraneManifest(parameters), createModel: () => createWarehouseStackerCrane(parameters) };
}

export const warehouseRackDefinition = createWarehouseRackDefinition(defaultWarehouseRackParameters);
export const warehousePalletDefinition = createWarehousePalletDefinition(defaultWarehousePalletParameters);
export const warehouseToteDefinition = createWarehouseToteDefinition(defaultWarehouseToteParameters);
export const warehouseCartDefinition = createWarehouseCartDefinition(defaultWarehouseCartParameters);
export const warehouseStackerCraneDefinition = createWarehouseStackerCraneDefinition(defaultWarehouseStackerCraneParameters);
export const warehouseAssetDefinitions = [
  warehouseRackDefinition,
  warehousePalletDefinition,
  warehouseToteDefinition,
  warehouseCartDefinition,
  warehouseStackerCraneDefinition,
] as const;
