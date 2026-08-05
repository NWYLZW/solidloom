import type { ModelAssetDefinition, ModelAssetManifest, Vector3Tuple } from "@solidloom/shared";
import {
  createLoungeKit,
  defaultLoungeParameters,
  getLoungeLayoutTransforms,
  loungeFeatureIds,
  loungeGroupIds,
  transformLoungePoint,
} from "./model.js";

const defaultGraph = createLoungeKit().featureGraph!;
const allFeatureIds = defaultGraph.features.map((feature) => feature.id);
const featureIdsForMaterial = (material: string) => defaultGraph.features
  .filter((feature) => feature.appearance?.material === material)
  .map((feature) => feature.id);
const silhouetteFeatureIds = [
  loungeFeatureIds.rug,
  loungeFeatureIds.sofaBase,
  loungeFeatureIds.sofaBack,
  loungeFeatureIds.leftChairBase,
  loungeFeatureIds.leftChairBack,
  loungeFeatureIds.rightChairBase,
  loungeFeatureIds.rightChairBack,
  loungeFeatureIds.tableTop,
  loungeFeatureIds.lampBase,
  loungeFeatureIds.lampPole,
  loungeFeatureIds.lampShade,
  loungeFeatureIds.plantPot,
  loungeFeatureIds.plantTrunk,
];
const simplifiedFeatureIds = allFeatureIds.filter((id, index) => (
  !id.includes("-leg-")
  && !id.includes("-pillow-")
  && (!id.includes("plant-leaf") || index % 2 === 0)
));
const transforms = getLoungeLayoutTransforms();
const sofaDepth = 900;
const chairWidth = 790;
const chairDepth = 820;
const tableDepth = Math.max(560, defaultLoungeParameters.tableWidth * 0.62);

function yawRotation(rotationY: number): Vector3Tuple {
  return [0, rotationY, 0];
}

export const loungeManifest: ModelAssetManifest = {
  schemaVersion: 1,
  id: "cyber-factory-lounge-kit",
  displayName: "现代休息区资产套件",
  description: "可组合的沙发、双单椅、茶几、地毯、落地灯和绿植套件，包含独立座位、碰撞和交互语义。",
  version: "1.0.0",
  kind: "scene",
  modelUnit: "mm",
  parameters: [
    {
      id: "sofa-width",
      label: "沙发宽度",
      type: "number",
      defaultValue: defaultLoungeParameters.sofaWidth,
      unit: "mm",
      minimum: 1_800,
      maximum: 2_800,
      step: 20,
    },
    {
      id: "seat-height",
      label: "座面高度",
      type: "number",
      defaultValue: defaultLoungeParameters.seatHeight,
      unit: "mm",
      minimum: 380,
      maximum: 500,
      step: 10,
    },
    {
      id: "table-width",
      label: "茶几宽度",
      type: "number",
      defaultValue: defaultLoungeParameters.tableWidth,
      unit: "mm",
      minimum: 720,
      maximum: 1_400,
      step: 20,
    },
    {
      id: "rug-width",
      label: "地毯宽度",
      type: "number",
      defaultValue: defaultLoungeParameters.rugWidth,
      unit: "mm",
      minimum: 3_200,
      maximum: 4_800,
      step: 40,
    },
    {
      id: "layout",
      label: "组合布局",
      type: "select",
      defaultValue: defaultLoungeParameters.layout,
      options: ["conversation", "linear", "compact"],
    },
    {
      id: "palette",
      label: "织物配色",
      type: "select",
      defaultValue: defaultLoungeParameters.palette,
      options: ["teal", "clay", "sand"],
    },
    {
      id: "lamp-on",
      label: "落地灯状态",
      type: "boolean",
      defaultValue: defaultLoungeParameters.lampOn,
    },
  ],
  materials: [
    {
      id: "lounge-fabric",
      label: "沙发、单椅与软装织物",
      material: "fabric",
      color: "#4B8582",
      featureIds: featureIdsForMaterial("fabric"),
    },
    {
      id: "lounge-table-wood",
      label: "茶几与绿植木材",
      material: "wood",
      color: "#9A6B42",
      featureIds: featureIdsForMaterial("wood"),
    },
    {
      id: "lounge-structure-metal",
      label: "家具支脚与灯具金属",
      material: "metal",
      color: "#313B3D",
      featureIds: featureIdsForMaterial("metal"),
    },
    {
      id: "lounge-glass",
      label: "玻璃置物层与灯光罩",
      material: "glass",
      color: "#B9E3DE",
      featureIds: featureIdsForMaterial("glass"),
    },
    {
      id: "lounge-ceramic",
      label: "陶质花盆",
      material: "default",
      color: "#C77952",
      featureIds: featureIdsForMaterial("default"),
    },
  ],
  placement: {
    upAxis: "y",
    groundY: 0,
    origin: [0, 0, 0],
    defaultScale: [1, 1, 1],
  },
  colliders: [
    {
      id: "lounge-sofa-collider",
      label: "三人沙发碰撞体",
      shape: "box",
      position: transformLoungePoint([0, 440, 0], transforms.sofa),
      rotation: yawRotation(transforms.sofa.rotationY),
      size: [defaultLoungeParameters.sofaWidth, 880, sofaDepth],
      groupId: loungeGroupIds.sofa,
    },
    {
      id: "lounge-left-chair-collider",
      label: "左单椅碰撞体",
      shape: "box",
      position: transformLoungePoint([0, 420, 0], transforms.leftChair),
      rotation: yawRotation(transforms.leftChair.rotationY),
      size: [chairWidth, 840, chairDepth],
      groupId: loungeGroupIds.leftChair,
    },
    {
      id: "lounge-right-chair-collider",
      label: "右单椅碰撞体",
      shape: "box",
      position: transformLoungePoint([0, 420, 0], transforms.rightChair),
      rotation: yawRotation(transforms.rightChair.rotationY),
      size: [chairWidth, 840, chairDepth],
      groupId: loungeGroupIds.rightChair,
    },
    {
      id: "lounge-coffee-table-collider",
      label: "茶几碰撞体",
      shape: "box",
      position: transformLoungePoint([0, 245, 0], transforms.coffeeTable),
      rotation: yawRotation(transforms.coffeeTable.rotationY),
      size: [defaultLoungeParameters.tableWidth, 490, tableDepth],
      groupId: loungeGroupIds.coffeeTable,
    },
    {
      id: "lounge-floor-lamp-collider",
      label: "落地灯碰撞体",
      shape: "cylinder",
      position: transformLoungePoint([0, 900, 0], transforms.floorLamp),
      rotation: [0, 0, 0],
      size: [360, 1_800, 360],
      radius: 180,
      height: 1_800,
      groupId: loungeGroupIds.floorLamp,
    },
    {
      id: "lounge-plant-collider",
      label: "绿植碰撞体",
      shape: "cylinder",
      position: transformLoungePoint([0, 720, 0], transforms.plant),
      rotation: [0, 0, 0],
      size: [500, 1_440, 500],
      radius: 250,
      height: 1_440,
      groupId: loungeGroupIds.plant,
    },
  ],
  anchors: [
    ...[-1, 0, 1].map((column, index) => ({
      id: `lounge-sofa-seat-${index + 1}`,
      label: `沙发座位 ${index + 1}`,
      kind: "seat" as const,
      position: transformLoungePoint([column * defaultLoungeParameters.sofaWidth * 0.29, defaultLoungeParameters.seatHeight, 100], transforms.sofa),
      rotation: yawRotation(transforms.sofa.rotationY),
      range: 760,
      groupId: loungeGroupIds.sofa,
      tags: ["sit", "sofa", `seat-${index + 1}`],
    })),
    {
      id: "lounge-left-chair-seat",
      label: "左单椅座位",
      kind: "seat",
      position: transformLoungePoint([0, defaultLoungeParameters.seatHeight, 70], transforms.leftChair),
      rotation: yawRotation(transforms.leftChair.rotationY),
      range: 720,
      groupId: loungeGroupIds.leftChair,
      tags: ["sit", "armchair", "left"],
    },
    {
      id: "lounge-right-chair-seat",
      label: "右单椅座位",
      kind: "seat",
      position: transformLoungePoint([0, defaultLoungeParameters.seatHeight, 70], transforms.rightChair),
      rotation: yawRotation(transforms.rightChair.rotationY),
      range: 720,
      groupId: loungeGroupIds.rightChair,
      tags: ["sit", "armchair", "right"],
    },
    {
      id: "lounge-front-approach",
      label: "休息区正面接近位",
      kind: "approach",
      position: [0, 0, defaultLoungeParameters.rugWidth * 0.34 + 720],
      rotation: [0, 180, 0],
      range: 1_200,
      groupId: loungeGroupIds.rug,
      tags: ["navigation", "front", "lounge"],
    },
    {
      id: "lounge-coffee-table-use",
      label: "使用茶几",
      kind: "interaction",
      position: transformLoungePoint([0, 540, 0], transforms.coffeeTable),
      rotation: yawRotation(transforms.coffeeTable.rotationY),
      range: 760,
      groupId: loungeGroupIds.coffeeTable,
      tags: ["table", "place-item", "pickup-item"],
    },
    {
      id: "lounge-floor-lamp-toggle",
      label: "切换落地灯",
      kind: "interaction",
      position: transformLoungePoint([0, 1_150, 180], transforms.floorLamp),
      rotation: [0, 180, 0],
      range: 720,
      featureId: loungeFeatureIds.lampLight,
      groupId: loungeGroupIds.floorLamp,
      tags: ["power", "light", "toggle"],
    },
  ],
  joints: [],
  lod: [
    {
      device: "desktop",
      levels: [
        { id: "lounge-desktop-full", maximumDistance: 8_000, featureIds: allFeatureIds, triangleBudget: 4_600 },
        { id: "lounge-desktop-medium", maximumDistance: 16_000, featureIds: simplifiedFeatureIds, triangleBudget: 2_200 },
        { id: "lounge-desktop-silhouette", maximumDistance: 30_000, featureIds: silhouetteFeatureIds, triangleBudget: 760 },
      ],
    },
    {
      device: "mobile",
      levels: [
        { id: "lounge-mobile-near", maximumDistance: 7_500, featureIds: simplifiedFeatureIds, triangleBudget: 1_900 },
        { id: "lounge-mobile-silhouette", maximumDistance: 18_000, featureIds: silhouetteFeatureIds, triangleBudget: 620 },
      ],
    },
  ],
  previews: [
    {
      device: "desktop",
      cameraPosition: [4_500, 2_800, 5_250],
      cameraTarget: [0, 570, 0],
      background: "dark",
    },
    {
      device: "mobile",
      cameraPosition: [5_200, 3_050, 6_150],
      cameraTarget: [0, 540, 0],
      background: "dark",
    },
  ],
  tags: ["cyber-factory", "office", "lounge", "seating", "furniture", "planned"],
};

export const loungeDefinition: ModelAssetDefinition = {
  manifest: loungeManifest,
  createModel: () => createLoungeKit(),
};
