import type { ModelAssetManifest } from "@solidloom/shared";
import {
  defaultWaterDispenserParameters,
  resolveWaterDispenserParameters,
  WATER_DISPENSER_ASSET_ID,
  WATER_DISPENSER_DISPLAY_NAME,
  waterDispenserAllFeatureIds,
  waterDispenserCoreFeatureIds,
  waterDispenserParameterLimits,
} from "./model.js";
import type { WaterDispenserParameters } from "./types.js";

export function createWaterDispenserManifest(
  partialParameters: Partial<WaterDispenserParameters> = {},
): ModelAssetManifest {
  const parameters = resolveWaterDispenserParameters(partialParameters);
  const front = parameters.depth / 2;
  const cabinetTop = parameters.bodyHeight * 0.52;
  const cabinetHeight = cabinetTop - 30;
  const cabinetCenterY = 30 + cabinetHeight / 2;
  const upperBodyHeight = parameters.bodyHeight * 0.48;
  const upperBodyCenterY = parameters.bodyHeight * 0.76;
  const doorWidth = parameters.width - 44;
  const actorPosition: [number, number, number] = [0, 0, front + 680];
  const buttonY = parameters.bodyHeight * 0.952;
  const targetZ = front + 34;

  return {
    schemaVersion: 1,
    id: WATER_DISPENSER_ASSET_ID,
    displayName: WATER_DISPENSER_DISPLAY_NAME,
    description: "带可开合中空储水柜和直立下置水桶的参数化落地式饮水机。",
    version: "1.0.0",
    kind: "asset",
    modelUnit: "mm",
    parameters: [
      { id: "width", label: "机身宽度", type: "number", defaultValue: parameters.width, unit: "mm", ...waterDispenserParameterLimits.width },
      { id: "depth", label: "机身深度", type: "number", defaultValue: parameters.depth, unit: "mm", ...waterDispenserParameterLimits.depth },
      { id: "body-height", label: "机身高度", type: "number", defaultValue: parameters.bodyHeight, unit: "mm", ...waterDispenserParameterLimits.bodyHeight },
      { id: "tank-radius", label: "水桶半径", type: "number", defaultValue: parameters.tankRadius, unit: "mm", ...waterDispenserParameterLimits.tankRadius },
      { id: "tank-height", label: "水桶高度", type: "number", defaultValue: parameters.tankHeight, unit: "mm", ...waterDispenserParameterLimits.tankHeight },
      { id: "nozzle-spacing", label: "出水口间距", type: "number", defaultValue: parameters.nozzleSpacing, unit: "mm", ...waterDispenserParameterLimits.nozzleSpacing },
    ],
    materials: [
      { id: "body-plastic", label: "机身塑料", material: "plastic", color: "#E8EDF2", featureIds: ["body-shell", "upper-left-frame", "upper-right-frame", "upper-top-frame", "upper-bottom-frame", "cabinet-back", "cabinet-left-wall", "cabinet-right-wall", "cabinet-floor", "cabinet-ceiling", "cabinet-door"] },
      { id: "dark-plastic", label: "控制区、接水区与柜内塑料", material: "plastic", color: "#18232D", featureIds: ["front-panel", "dispense-alcove", "cabinet-interior", "tank-connector", "tray-grate-left", "tray-grate-right"] },
      { id: "metal", label: "不锈钢", material: "metal", color: "#AFC0CA", featureIds: ["drip-tray", "hot-nozzle", "ambient-nozzle", "cold-nozzle", "brand-strip"] },
      { id: "tank-glass", label: "透明水桶", material: "glass", color: "#71D1EF", featureIds: ["tank-neck", "tank-shoulder", "water-tank"] },
      { id: "hot-control", label: "热水按钮", material: "plastic", color: "#DF5A52", featureIds: ["hot-button"] },
      { id: "ambient-control", label: "常温水按钮", material: "plastic", color: "#64BE94", featureIds: ["ambient-button"] },
      { id: "cold-control", label: "冷水按钮与聪明盖", material: "plastic", color: "#3F8FE8", featureIds: ["cold-button", "tank-cap"] },
      { id: "power-status", label: "已通电指示灯", material: "plastic", color: "#26C985", featureIds: ["power-indicator"] },
      { id: "heating-status", label: "制热中指示灯", material: "plastic", color: "#FF9C4A", featureIds: ["heating-indicator"] },
      { id: "cooling-status", label: "制冷中指示灯", material: "plastic", color: "#45A9F8", featureIds: ["cooling-indicator"] },
      { id: "rubber-base", label: "防滑橡胶", material: "rubber", color: "#263139", featureIds: ["base"] },
    ],
    placement: {
      upAxis: "y",
      groundY: 0,
      origin: [0, 0, 0],
      defaultScale: [1, 1, 1],
    },
    colliders: [
      {
        id: "body-collider",
        label: "上部机身后壳碰撞体",
        shape: "box",
        position: [0, upperBodyCenterY, -38],
        rotation: [0, 0, 0],
        size: [parameters.width, upperBodyHeight, parameters.depth - 76],
        featureId: "body-shell",
      },
      {
        id: "upper-left-frame-collider",
        label: "接水区左框碰撞体",
        shape: "box",
        position: [-parameters.width / 2 + 23, upperBodyCenterY, front - 38],
        rotation: [0, 0, 0],
        size: [46, upperBodyHeight, 76],
        featureId: "upper-left-frame",
      },
      {
        id: "upper-right-frame-collider",
        label: "接水区右框碰撞体",
        shape: "box",
        position: [parameters.width / 2 - 23, upperBodyCenterY, front - 38],
        rotation: [0, 0, 0],
        size: [46, upperBodyHeight, 76],
        featureId: "upper-right-frame",
      },
      {
        id: "upper-top-frame-collider",
        label: "顶部控制区碰撞体",
        shape: "box",
        position: [0, parameters.bodyHeight - 94, front - 38],
        rotation: [0, 0, 0],
        size: [parameters.width - 92, 188, 76],
        featureId: "upper-top-frame",
      },
      {
        id: "upper-bottom-frame-collider",
        label: "接水区下框碰撞体",
        shape: "box",
        position: [0, cabinetTop + 34, front - 38],
        rotation: [0, 0, 0],
        size: [parameters.width - 92, 68, 76],
        featureId: "upper-bottom-frame",
      },
      {
        id: "cabinet-left-collider",
        label: "储水柜左壁碰撞体",
        shape: "box",
        position: [-parameters.width / 2 + 17, cabinetCenterY, 0],
        rotation: [0, 0, 0],
        size: [34, cabinetHeight, parameters.depth],
        featureId: "cabinet-left-wall",
      },
      {
        id: "cabinet-right-collider",
        label: "储水柜右壁碰撞体",
        shape: "box",
        position: [parameters.width / 2 - 17, cabinetCenterY, 0],
        rotation: [0, 0, 0],
        size: [34, cabinetHeight, parameters.depth],
        featureId: "cabinet-right-wall",
      },
      {
        id: "cabinet-back-collider",
        label: "储水柜背板碰撞体",
        shape: "box",
        position: [0, cabinetCenterY, -front + 13],
        rotation: [0, 0, 0],
        size: [parameters.width - 34, cabinetHeight, 26],
        featureId: "cabinet-back",
      },
      {
        id: "cabinet-door-collider",
        label: "储水柜门碰撞体",
        shape: "box",
        position: [0, cabinetCenterY, front + 10],
        rotation: [0, 0, 0],
        size: [doorWidth, cabinetHeight - 36, 20],
        dynamic: true,
        groupId: "dispenser-door",
      },
      {
        id: "tank-collider",
        label: "水桶碰撞体",
        shape: "cylinder",
        position: [0, 30 + parameters.tankHeight / 2, -12],
        rotation: [0, 0, 0],
        size: [parameters.tankRadius * 2, parameters.tankHeight, parameters.tankRadius * 2],
        radius: parameters.tankRadius,
        height: parameters.tankHeight,
        featureId: "water-tank",
      },
    ],
    anchors: [
      {
        id: "water-fill-approach",
        label: "接水角色站位",
        kind: "approach",
        position: actorPosition,
        rotation: [0, 180, 0],
        tags: ["fill-water", "actor"],
      },
      {
        id: "water-fill-target",
        label: "杯具接水位置",
        kind: "interaction",
        position: [0, parameters.bodyHeight * 0.755 - 118, front + 56],
        rotation: [0, 0, 0],
        range: 900,
        tags: ["fill-water", "cup"],
      },
      {
        id: "hot-water-button",
        label: "热水按钮",
        kind: "interaction",
        position: [-parameters.nozzleSpacing / 2, buttonY, targetZ],
        rotation: [0, 0, 0],
        range: 950,
        featureId: "hot-button",
        tags: ["press", "hot-water"],
      },
      {
        id: "ambient-water-button",
        label: "常温水按钮",
        kind: "interaction",
        position: [0, buttonY, targetZ],
        rotation: [0, 0, 0],
        range: 950,
        featureId: "ambient-button",
        tags: ["press", "ambient-water"],
      },
      {
        id: "cold-water-button",
        label: "冷水按钮",
        kind: "interaction",
        position: [parameters.nozzleSpacing / 2, buttonY, targetZ],
        rotation: [0, 0, 0],
        range: 950,
        featureId: "cold-button",
        tags: ["press", "cold-water"],
      },
      {
        id: "cabinet-door-open-control",
        label: "储水柜门开启区域",
        kind: "interaction",
        position: [doorWidth * 0.36, cabinetCenterY, front + 24],
        rotation: [0, 0, 0],
        range: 900,
        featureId: "cabinet-door",
        tags: ["push-open", "replace-water-tank"],
      },
      {
        id: "tank-storage-socket",
        label: "下置水桶收纳位",
        kind: "socket",
        position: [0, 30, -12],
        rotation: [0, 0, 0],
        featureId: "water-tank",
        tags: ["storage", "replace-water-tank"],
      },
    ],
    joints: [
      {
        id: "cabinet-door",
        label: "储水柜门",
        jointId: "cabinet-door-hinge",
        semantic: "cabinet-door",
      },
    ],
    lod: [
      {
        device: "desktop",
        levels: [
          { id: "full", maximumDistance: 5_000, featureIds: [...waterDispenserAllFeatureIds], triangleBudget: 6_000 },
          { id: "simplified", maximumDistance: 12_000, featureIds: [...waterDispenserCoreFeatureIds], triangleBudget: 2_400 },
        ],
      },
      {
        device: "mobile",
        levels: [
          { id: "mobile", maximumDistance: 8_000, featureIds: [...waterDispenserCoreFeatureIds], triangleBudget: 2_400 },
        ],
      },
    ],
    previews: [
      { device: "desktop", cameraPosition: [1_700, 1_250, 2_200], cameraTarget: [0, 510, 0], background: "light" },
      { device: "mobile", cameraPosition: [1_900, 1_250, 2_500], cameraTarget: [0, 510, 0], background: "light" },
    ],
    tags: ["cyber-factory", "appliance", "water", "bottom-loading", "storage"],
  };
}

export const waterDispenserManifest = createWaterDispenserManifest(defaultWaterDispenserParameters);
