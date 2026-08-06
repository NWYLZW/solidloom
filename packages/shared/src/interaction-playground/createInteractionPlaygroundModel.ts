import type { CreateModelInput, ModelReferenceInstance } from "../types.js";

export interface InteractionPlaygroundModelIds {
  chairId: string;
  deskId: string;
  monitorId: string;
  roomId: string;
  snackCabinetId: string;
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
        containerCapacity: 6,
        containerCanConfigure: true,
        containerItems: [
          { id: "sparkling-water", name: "气泡水" },
          { id: "energy-bar", name: "能量棒" },
        ],
      }],
    },
  ];

  return {
    kind: "scene",
    name: "交互试验场",
    description: "通过独立运行入口验证角色与门、座位、设备和通用容器之间的语义交互；当前状态仅在本地运行会话中保留。",
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
