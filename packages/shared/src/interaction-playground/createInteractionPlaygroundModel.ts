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
          id: "power",
          kind: "power",
          anchorPosition: [0, 280, 420],
          range: 820,
          targetFeatureIds: [
            "coffee-machine-display",
            "coffee-machine-status-light",
          ],
        },
        {
          id: "water-tank-lid",
          kind: "articulation",
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
        anchorPosition: [120, 280, 420],
        range: 880,
        targetFeatureIds: ["cabinet-door"],
        jointId: "cabinet-door-hinge",
        closedValue: 0,
        openValue: -72,
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
          anchorPosition: [0, 430, -700],
          range: 940,
          targetFeatureIds: ["lounge-sofa-seat-cushion-2"],
        },
        {
          id: "left-chair-seat",
          kind: "seat",
          anchorPosition: [-1680, 430, 240],
          range: 840,
          targetFeatureIds: ["lounge-left-chair-seat-cushion"],
        },
        {
          id: "right-chair-seat",
          kind: "seat",
          anchorPosition: [1680, 430, 240],
          range: 840,
          targetFeatureIds: ["lounge-right-chair-seat-cushion"],
        },
        {
          id: "floor-lamp",
          kind: "power",
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
