import type {
  CreateModelInput,
  ModelReferenceInstance,
  ModelReferenceOperationMotion,
  ModelReferenceOperationProgram,
} from "../types.js";

export interface InteractionPlaygroundModelIds {
  chairId: string;
  coffeeMachineId: string;
  deskId: string;
  loungeId: string;
  monitorId: string;
  roomId: string;
  snackCabinetId: string;
  waterDispenserId: string;
  warehouseCartId: string;
  warehousePalletId: string;
  warehouseRackId: string;
  warehouseStackerCraneId: string;
  warehouseToteId: string;
}

const galleryLayout = {
  displayZ: -620,
  roomScale: [2.65, 1, 1.2] as [number, number, number],
  stations: {
    coffeeMachine: -10_600,
    waterDispenser: -8_650,
    snackCabinet: -6_800,
    workstation: -4_250,
    lounge: -900,
    warehouse: 3_600,
    warehouseCart: 8_000,
  },
  warehouseStackerZ: 240,
} as const;

const stackerHomeX = -1_140;
const stackerHomeLiftY = 320;
const stackerForkExtension = 761;
const stackerForkScaleZ = (820 + stackerForkExtension) / 820;
const stackerTravelFeatureIds = [
  "warehouse-stacker-travel-base",
  "warehouse-stacker-single-mast",
  "warehouse-stacker-mast-guide",
  "warehouse-stacker-mast-cap",
  "warehouse-stacker-control-cabinet",
  "warehouse-stacker-wheel-left-rear",
  "warehouse-stacker-wheel-left-front",
  "warehouse-stacker-wheel-right-rear",
  "warehouse-stacker-wheel-right-front",
];
const stackerCarriageFeatureIds = [
  "warehouse-stacker-carriage-deck",
  "warehouse-stacker-carriage-back",
  "warehouse-stacker-carriage-left-guard",
  "warehouse-stacker-carriage-right-guard",
  "warehouse-stacker-fork-crosshead",
];
const stackerForkFeatureIds = [
  "warehouse-stacker-left-fork",
  "warehouse-stacker-right-fork",
];

function stackerMotion(
  featureIds: string[],
  x: number,
  y = 0,
  forkExtension = false,
): ModelReferenceOperationMotion {
  return {
    positionOffset: [x, y, forkExtension ? -stackerForkExtension / 2 : 0],
    ...(forkExtension ? { scaleMultiplier: [1, 1, stackerForkScaleZ] as [number, number, number] } : {}),
    targetFeatureIds: featureIds,
  };
}

function createWarehouseRetrievalProgram({
  bayX,
  cargoReferenceId,
  shelfY,
}: {
  bayX: number;
  cargoReferenceId: string;
  shelfY: number;
}): ModelReferenceOperationProgram {
  const travelX = bayX - stackerHomeX;
  const liftY = shelfY + 52 - stackerHomeLiftY;
  const captureLiftY = shelfY + 72 - stackerHomeLiftY;
  const cargoDeliveryOffset: [number, number, number] = [
    stackerHomeX - bayX,
    290 - (shelfY + 22),
    stackerForkExtension,
  ];
  const craneAt = (x: number, y: number, forkExtension = false) => [
    stackerMotion(stackerTravelFeatureIds, x),
    stackerMotion(stackerCarriageFeatureIds, x, y),
    stackerMotion(stackerForkFeatureIds, x, y, forkExtension),
  ];
  const cargoAt = (positionOffset: [number, number, number]): ModelReferenceOperationMotion => ({
    positionOffset,
    targetReferenceId: cargoReferenceId,
  });
  return {
    collect: {
      label: "领取货物",
      status: "货物已领取，货位库存同步扣减。",
      targetReferenceId: cargoReferenceId,
    },
    steps: [
      { id: "reserve", label: "预占目标货位", durationMs: 350, motions: craneAt(0, 0) },
      { id: "travel", label: "横移到目标列", durationMs: 900, motions: craneAt(travelX, 0) },
      { id: "lift", label: "升降到目标层", durationMs: 850, motions: craneAt(travelX, liftY) },
      { id: "extend", label: "伸出货叉", durationMs: 750, motions: craneAt(travelX, liftY, true) },
      {
        id: "capture",
        label: "托起货物",
        durationMs: 300,
        motions: [...craneAt(travelX, captureLiftY, true), cargoAt([0, 20, 0])],
      },
      {
        id: "retract",
        label: "收回货叉",
        durationMs: 700,
        motions: [...craneAt(travelX, captureLiftY), cargoAt([0, 20, stackerForkExtension])],
      },
      {
        id: "lower",
        label: "下降到出库高度",
        durationMs: 850,
        motions: [...craneAt(travelX, 0), cargoAt([0, cargoDeliveryOffset[1], stackerForkExtension])],
      },
      {
        id: "deliver",
        label: "运送到左侧出库位",
        durationMs: 950,
        motions: [...craneAt(0, 0), cargoAt(cargoDeliveryOffset)],
      },
      {
        id: "release",
        label: "等待领取",
        durationMs: 300,
        motions: [...craneAt(0, 0), cargoAt(cargoDeliveryOffset)],
      },
    ],
  };
}

export function createInteractionPlaygroundModel(
  ids: InteractionPlaygroundModelIds,
): CreateModelInput {
  const references: ModelReferenceInstance[] = [
    {
      id: "interaction-playground-room",
      name: "试验房间",
      modelId: ids.roomId,
      position: [0, -160, 0],
      rotation: [0, 0, 0],
      scale: galleryLayout.roomScale,
      roomSurfaceMode: "interior",
      interactions: [{
        id: "door",
        kind: "door",
        activateLabel: "打开房门",
        deactivateLabel: "关闭房门",
        anchorPosition: [-4740, 1210, -650],
        range: 920,
        targetFeatureIds: ["cyber-room-door", "cyber-room-door-handle"],
        openAngle: 88,
      }],
    },
    {
      id: "interaction-playground-coffee-counter",
      name: "咖啡设备台",
      modelId: ids.deskId,
      position: [galleryLayout.stations.coffeeMachine, 0, galleryLayout.displayZ],
      rotation: [0, 180, 0],
    },
    {
      id: "interaction-playground-coffee-machine",
      name: "咖啡机",
      modelId: ids.coffeeMachineId,
      position: [galleryLayout.stations.coffeeMachine, 760, galleryLayout.displayZ - 40],
      rotation: [0, 0, 0],
      interactions: [
        {
          id: "brew",
          kind: "device",
          label: "咖啡机",
          activateLabel: "使用咖啡机",
          deactivateLabel: "关闭咖啡机面板",
          anchorPosition: [0, 280, 420],
          range: 820,
          targetFeatureIds: [
            "coffee-machine-display",
            "coffee-machine-status-light",
          ],
          operationExecuteLabel: "开始制作",
          operationCompleteLabel: "已开始制作：{selection}",
          operationGroups: [{
            id: "recipe",
            label: "咖啡配方",
            options: [
              { id: "espresso", label: "浓缩咖啡", description: "40 ml · 浓郁" },
              { id: "americano", label: "美式咖啡", description: "180 ml · 清爽" },
              { id: "latte", label: "拿铁咖啡", description: "220 ml · 奶香" },
              { id: "cappuccino", label: "卡布奇诺", description: "180 ml · 绵密奶泡" },
            ],
          }],
        },
        {
          id: "water-tank-lid",
          kind: "articulation",
          activateLabel: "打开水箱盖",
          deactivateLabel: "关闭水箱盖",
          anchorPosition: [0, 560, -120],
          range: 760,
          targetFeatureIds: ["coffee-machine-water-tank-lid"],
          jointId: "coffee-machine-water-tank-lid-joint",
          closedValue: 0,
          openValue: 72,
        },
      ],
    },
    {
      id: "interaction-playground-water-dispenser",
      name: "饮水机",
      modelId: ids.waterDispenserId,
      position: [galleryLayout.stations.waterDispenser, 0, galleryLayout.displayZ],
      rotation: [0, 0, 0],
      interactions: [{
        id: "cabinet-door",
        kind: "articulation",
        activateLabel: "打开储水柜",
        deactivateLabel: "关闭储水柜",
        anchorPosition: [120, 280, 420],
        range: 880,
        targetFeatureIds: ["cabinet-door"],
        jointId: "cabinet-door-hinge",
        closedValue: 0,
        openValue: -72,
      }, {
        id: "dispense",
        kind: "device",
        label: "饮水机",
        activateLabel: "使用饮水机",
        deactivateLabel: "关闭饮水机面板",
        anchorPosition: [0, 760, 220],
        range: 900,
        targetFeatureIds: [
          "hot-button",
          "ambient-button",
          "cold-button",
          "hot-nozzle",
          "ambient-nozzle",
          "cold-nozzle",
        ],
        operationExecuteLabel: "开始接水",
        operationCompleteLabel: "接水任务已开始：{selection}",
        operationGroups: [{
          id: "temperature",
          label: "水温",
          options: [
            { id: "hot", label: "热水", description: "约 85℃" },
            { id: "ambient", label: "常温水", description: "约 25℃" },
            { id: "cold", label: "冷水", description: "约 8℃" },
          ],
        }, {
          id: "volume",
          label: "出水量",
          options: [
            { id: "small", label: "小杯", description: "250 ml" },
            { id: "large", label: "大杯", description: "500 ml" },
          ],
        }],
      }],
    },
    {
      id: "interaction-playground-lounge",
      name: "休息区",
      modelId: ids.loungeId,
      position: [galleryLayout.stations.lounge, 0, galleryLayout.displayZ - 180],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      interactions: [
        {
          id: "sofa-seat",
          kind: "seat",
          activateLabel: "坐到沙发",
          deactivateLabel: "离开沙发",
          anchorPosition: [0, 430, -700],
          range: 940,
          targetFeatureIds: ["lounge-sofa-seat-cushion-2"],
        },
        {
          id: "left-chair-seat",
          kind: "seat",
          activateLabel: "坐到左侧座椅",
          deactivateLabel: "离开座椅",
          anchorPosition: [-1680, 430, 240],
          range: 840,
          targetFeatureIds: ["lounge-left-chair-seat-cushion"],
        },
        {
          id: "right-chair-seat",
          kind: "seat",
          activateLabel: "坐到右侧座椅",
          deactivateLabel: "离开座椅",
          anchorPosition: [1680, 430, 240],
          range: 840,
          targetFeatureIds: ["lounge-right-chair-seat-cushion"],
        },
        {
          id: "floor-lamp",
          kind: "power",
          activateLabel: "打开落地灯",
          deactivateLabel: "关闭落地灯",
          anchorPosition: [850, 920, -1080],
          range: 760,
          targetFeatureIds: ["lounge-floor-lamp-light"],
        },
      ],
    },
    {
      id: "interaction-playground-desk",
      name: "设备工作台",
      modelId: ids.deskId,
      position: [galleryLayout.stations.workstation, 0, galleryLayout.displayZ],
      rotation: [0, 180, 0],
      scale: [1, 1, 1],
    },
    {
      id: "interaction-playground-monitor",
      name: "可操作显示器",
      modelId: ids.monitorId,
      position: [galleryLayout.stations.workstation, 760, galleryLayout.displayZ - 130],
      rotation: [0, 180, 0],
      interactions: [{
        id: "display-power",
        kind: "power",
        activateLabel: "开启显示器",
        deactivateLabel: "关闭显示器",
        range: 1100,
        targetFeatureIds: [
          "cyber-monitor-panel",
          "cyber-monitor-light-left",
          "cyber-monitor-light-right",
        ],
      }],
    },
    {
      id: "interaction-playground-chair",
      name: "可坐座椅",
      modelId: ids.chairId,
      position: [galleryLayout.stations.workstation, 0, galleryLayout.displayZ + 840],
      rotation: [0, 180, 0],
      physics: {
        bodyType: "dynamic",
        mass: 16,
        friction: 0.42,
        linearDamping: 2.8,
      },
      interactions: [{
        id: "seat",
        kind: "seat",
        activateLabel: "坐到座椅",
        deactivateLabel: "离开座椅",
        range: 720,
        targetFeatureIds: ["cyber-chair-seat"],
      }],
    },
    {
      id: "interaction-playground-container",
      name: "办公补给柜",
      modelId: ids.snackCabinetId,
      position: [galleryLayout.stations.snackCabinet, 0, galleryLayout.displayZ],
      rotation: [0, 0, 0],
      interactions: [{
        id: "inventory",
        kind: "container",
        label: "办公补给柜",
        range: 1050,
        targetFeatureIds: [
          "snack-cabinet-payment-display",
          "snack-cabinet-pickup-flap",
          "snack-cabinet-status-light",
        ],
        containerCapacity: 64,
        containerCanConfigure: true,
        containerCurrency: "CNY",
        containerProducts: [
          { id: "sparkling-water", name: "气泡水", unitPrice: 6 },
          { id: "energy-bar", name: "能量棒", unitPrice: 12 },
          { id: "fruit-tea", name: "柑橘茶", unitPrice: 8 },
        ],
        containerItems: [
          { id: "sparkling-water-1", name: "气泡水", productId: "sparkling-water" },
          { id: "sparkling-water-2", name: "气泡水", productId: "sparkling-water" },
          { id: "energy-bar-1", name: "能量棒", productId: "energy-bar" },
          { id: "fruit-tea-1", name: "柑橘茶", productId: "fruit-tea" },
        ],
      }],
    },
    {
      id: "interaction-playground-warehouse-rack",
      name: "仓储货架",
      modelId: ids.warehouseRackId,
      position: [galleryLayout.stations.warehouse, 0, galleryLayout.displayZ - 120],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      interactions: [{
        id: "warehouse-stock",
        kind: "container",
        label: "仓储货架",
        range: 1180,
        targetFeatureIds: [
          "warehouse-rack-upright-01-front",
          "warehouse-rack-upright-04-front",
          "warehouse-rack-shelf-b01-l01",
        ],
        containerCapacity: 96,
        containerCanConfigure: true,
        containerProducts: [
          { id: "component-a", name: "标准组件 A", unitPrice: 24 },
          { id: "component-b", name: "标准组件 B", unitPrice: 38 },
          { id: "maintenance-kit", name: "维护套件", unitPrice: 65 },
        ],
        containerItems: [
          { id: "component-a-1", name: "标准组件 A", productId: "component-a" },
          { id: "component-a-2", name: "标准组件 A", productId: "component-a" },
          { id: "component-b-1", name: "标准组件 B", productId: "component-b" },
          { id: "maintenance-kit-1", name: "维护套件", productId: "maintenance-kit" },
        ],
      }],
    },
    {
      id: "interaction-playground-warehouse-stacker-crane",
      name: "自动取货机",
      modelId: ids.warehouseStackerCraneId,
      position: [galleryLayout.stations.warehouse, 0, galleryLayout.warehouseStackerZ],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      interactions: [{
        id: "warehouse-retrieval",
        kind: "device",
        activateLabel: "操作自动取货机",
        anchorPosition: [stackerHomeX, 920, 760],
        label: "自动取货机",
        range: 2_200,
        targetFeatureIds: [
          "warehouse-stacker-control-cabinet",
          "warehouse-stacker-carriage-deck",
        ],
        operationExecuteLabel: "开始取货",
        operationCompleteLabel: "{selection} 已送达出库位，可以领取。",
        operationGroups: [{
          id: "slot",
          label: "选择货位",
          options: [
            {
              id: "component-a",
              label: "标准组件 A",
              description: "第 1 列 · 第 1 层",
              program: createWarehouseRetrievalProgram({
                bayX: -1_100,
                cargoReferenceId: "interaction-playground-warehouse-cargo-a",
                shelfY: 220,
              }),
            },
            {
              id: "component-b",
              label: "标准组件 B",
              description: "第 2 列 · 第 2 层",
              program: createWarehouseRetrievalProgram({
                bayX: 0,
                cargoReferenceId: "interaction-playground-warehouse-cargo-b",
                shelfY: 953.333,
              }),
            },
            {
              id: "maintenance-kit",
              label: "维护套件",
              description: "第 3 列 · 第 3 层",
              program: createWarehouseRetrievalProgram({
                bayX: 1_100,
                cargoReferenceId: "interaction-playground-warehouse-cargo-maintenance",
                shelfY: 1_686.667,
              }),
            },
          ],
        }],
      }],
    },
    {
      id: "interaction-playground-warehouse-cargo-a",
      name: "第 1 列第 1 层 · 标准组件 A",
      modelId: ids.warehouseToteId,
      position: [galleryLayout.stations.warehouse - 1_100, 242, galleryLayout.displayZ - 120],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    {
      id: "interaction-playground-warehouse-cargo-b",
      name: "第 2 列第 2 层 · 标准组件 B",
      modelId: ids.warehouseToteId,
      position: [galleryLayout.stations.warehouse, 975.333, galleryLayout.displayZ - 120],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    {
      id: "interaction-playground-warehouse-cargo-maintenance",
      name: "第 3 列第 3 层 · 维护套件",
      modelId: ids.warehouseToteId,
      position: [galleryLayout.stations.warehouse + 1_100, 1_708.667, galleryLayout.displayZ - 120],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    {
      id: "interaction-playground-warehouse-pallet",
      name: "仓储托盘",
      modelId: ids.warehousePalletId,
      position: [galleryLayout.stations.warehouse + 2_200, 0, galleryLayout.displayZ + 120],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    {
      id: "interaction-playground-warehouse-tote",
      name: "仓储周转箱",
      modelId: ids.warehouseToteId,
      position: [galleryLayout.stations.warehouse + 2_200, 144, galleryLayout.displayZ + 120],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    {
      id: "interaction-playground-warehouse-cart",
      name: "可推动仓储推车",
      modelId: ids.warehouseCartId,
      position: [galleryLayout.stations.warehouseCart, 0, galleryLayout.displayZ + 660],
      rotation: [0, 90, 0],
      scale: [1, 1, 1],
      physics: {
        bodyType: "dynamic",
        mass: 28,
        friction: 0.48,
        linearDamping: 2.4,
      },
    },
  ];

  return {
    kind: "scene",
    name: "交互试验场",
    description: "沿单一主通道按真实毫米比例陈列台面咖啡机、饮水机、补给柜、电脑工位、休息区和仓储物流资产；仓储区可选择稳定货位，驱动堆垛机横移、升降、伸叉、出库并领取货物。当前状态仅在本地运行会话中保留。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [],
      groups: [],
      references,
      navigation: {
        enabled: true,
        floorY: 0,
        bounds: [-11_900, 11_900, -3_300, 3_300],
        cellSize: 160,
        agentRadius: 260,
        agentHeight: 1720,
        start: [-11_250, 900],
      },
    },
  };
}
