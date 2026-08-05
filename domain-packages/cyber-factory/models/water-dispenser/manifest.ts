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
  const actorPosition: [number, number, number] = [0, 0, front + 680];
  const buttonY = parameters.bodyHeight * 0.79;
  const targetZ = front + 58;

  return {
    schemaVersion: 1,
    id: WATER_DISPENSER_ASSET_ID,
    displayName: WATER_DISPENSER_DISPLAY_NAME,
    description: "办公室与移动场景共用的参数化落地式桶装饮水机。",
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
      { id: "body-plastic", label: "机身塑料", material: "plastic", color: "#E8EDF2", featureIds: ["body-shell"] },
      { id: "dark-plastic", label: "出水区塑料", material: "plastic", color: "#18232D", featureIds: ["front-panel", "dispense-alcove"] },
      { id: "metal", label: "不锈钢", material: "metal", color: "#AFC0CA", featureIds: ["drip-tray", "hot-nozzle", "cold-nozzle", "brand-strip"] },
      { id: "tank-glass", label: "透明水桶", material: "glass", color: "#71D1EF", featureIds: ["water-tank"] },
      { id: "hot-control", label: "热水按钮", material: "plastic", color: "#DF5A52", featureIds: ["hot-button"] },
      { id: "cold-control", label: "冷水按钮与桶盖", material: "plastic", color: "#3F8FE8", featureIds: ["cold-button", "tank-cap"] },
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
        label: "机身碰撞体",
        shape: "box",
        position: [0, parameters.bodyHeight / 2, 0],
        rotation: [0, 0, 0],
        size: [parameters.width, parameters.bodyHeight, parameters.depth],
        featureId: "body-shell",
      },
      {
        id: "tank-collider",
        label: "水桶碰撞体",
        shape: "cylinder",
        position: [0, parameters.bodyHeight + 56 + parameters.tankHeight / 2, 0],
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
        position: [0, parameters.bodyHeight * 0.63 - 118, front + 96],
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
        id: "cold-water-button",
        label: "冷水按钮",
        kind: "interaction",
        position: [parameters.nozzleSpacing / 2, buttonY, targetZ],
        rotation: [0, 0, 0],
        range: 950,
        featureId: "cold-button",
        tags: ["press", "cold-water"],
      },
    ],
    joints: [],
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
      { device: "desktop", cameraPosition: [1_900, 1_550, 2_500], cameraTarget: [0, 720, 0], background: "light" },
      { device: "mobile", cameraPosition: [1_900, 1_550, 2_500], cameraTarget: [0, 840, 0], background: "light" },
    ],
    tags: ["cyber-factory", "appliance", "water"],
  };
}

export const waterDispenserManifest = createWaterDispenserManifest(defaultWaterDispenserParameters);
