import type { CreateModelInput, ModelReferenceInstance } from "../types.js";

export interface InteractionPlaygroundModelIds {
  chairId: string;
  coffeeMachineId: string;
  deskId: string;
  loungeId: string;
  monitorId: string;
  roomId: string;
  snackCabinetId: string;
  waterDispenserId: string;
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
      id: "interaction-playground-coffee-machine",
      name: "咖啡机",
      modelId: ids.coffeeMachineId,
      position: [-3000, 0, 320],
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
      position: [-3000, 0, -1180],
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
      position: [900, 0, -1550],
      rotation: [0, 0, 0],
      scale: [0.48, 0.48, 0.48],
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
      position: [350, 0, 520],
      rotation: [0, 180, 0],
      scale: [1.1, 1, 1],
    },
    {
      id: "interaction-playground-monitor",
      name: "可操作显示器",
      modelId: ids.monitorId,
      position: [350, 760, 380],
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
      position: [350, 0, 1450],
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
      position: [2600, 0, 850],
      rotation: [0, -90, 0],
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
  ];

  return {
    kind: "scene",
    name: "交互试验场",
    description: "通过独立运行入口验证角色与门、座位、办公设备、补给设备和休息区之间的语义交互；当前状态仅在本地运行会话中保留。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [],
      groups: [],
      references,
      navigation: {
        enabled: true,
        floorY: 0,
        bounds: [-4300, 4300, -2700, 2700],
        cellSize: 160,
        agentRadius: 260,
        agentHeight: 1720,
        start: [350, 1450],
      },
    },
  };
}
