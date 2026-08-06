import type { ModelAssetDefinition, ModelAssetManifest, Vector3Tuple } from "@solidloom/shared";
import {
  createLoungeKit,
  defaultLoungeParameters,
  getLoungeLayoutTransforms,
  getLoungeSofaSeatX,
  loungeDimensions,
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
const tableDepth = Math.max(
  loungeDimensions.coffeeTable.minimumDepth,
  defaultLoungeParameters.tableWidth * loungeDimensions.coffeeTable.depthRatio,
);

function yawRotation(rotationY: number): Vector3Tuple {
  return [0, rotationY, 0];
}

export const loungeManifest: ModelAssetManifest = {
  schemaVersion: 1,
  id: "cyber-factory-lounge-kit",
  displayName: "现代休息区资产套件",
  description: "可组合的沙发、双单椅、茶几、地毯、落地灯和绿植套件，包含独立座位、碰撞和交互语义。",
  version: "1.1.0",
  kind: "scene",
  modelUnit: "mm",
  parameters: [
    {
      id: "sofa-width",
      label: "沙发宽度",
      type: "number",
      defaultValue: defaultLoungeParameters.sofaWidth,
      unit: "mm",
      minimum: 2_400,
      maximum: 3_400,
      step: 20,
    },
    {
      id: "seat-height",
      label: "座面高度",
      type: "number",
      defaultValue: defaultLoungeParameters.seatHeight,
      unit: "mm",
      minimum: 380,
      maximum: 470,
      step: 10,
    },
    {
      id: "table-width",
      label: "茶几宽度",
      type: "number",
      defaultValue: defaultLoungeParameters.tableWidth,
      unit: "mm",
      minimum: 900,
      maximum: 1_600,
      step: 20,
    },
    {
      id: "rug-width",
      label: "地毯宽度",
      type: "number",
      defaultValue: defaultLoungeParameters.rugWidth,
      unit: "mm",
      minimum: 4_600,
      maximum: 6_200,
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
      position: transformLoungePoint([0, loungeDimensions.sofa.overallHeight / 2, 0], transforms.sofa),
      rotation: yawRotation(transforms.sofa.rotationY),
      size: [defaultLoungeParameters.sofaWidth, loungeDimensions.sofa.overallHeight, loungeDimensions.sofa.depth],
      groupId: loungeGroupIds.sofa,
    },
    {
      id: "lounge-left-chair-collider",
      label: "左单椅碰撞体",
      shape: "box",
      position: transformLoungePoint([0, loungeDimensions.armchair.overallHeight / 2, 0], transforms.leftChair),
      rotation: yawRotation(transforms.leftChair.rotationY),
      size: [loungeDimensions.armchair.width, loungeDimensions.armchair.overallHeight, loungeDimensions.armchair.depth],
      groupId: loungeGroupIds.leftChair,
    },
    {
      id: "lounge-right-chair-collider",
      label: "右单椅碰撞体",
      shape: "box",
      position: transformLoungePoint([0, loungeDimensions.armchair.overallHeight / 2, 0], transforms.rightChair),
      rotation: yawRotation(transforms.rightChair.rotationY),
      size: [loungeDimensions.armchair.width, loungeDimensions.armchair.overallHeight, loungeDimensions.armchair.depth],
      groupId: loungeGroupIds.rightChair,
    },
    {
      id: "lounge-coffee-table-collider",
      label: "茶几碰撞体",
      shape: "box",
      position: transformLoungePoint([0, loungeDimensions.coffeeTable.height / 2, 0], transforms.coffeeTable),
      rotation: yawRotation(transforms.coffeeTable.rotationY),
      size: [defaultLoungeParameters.tableWidth, loungeDimensions.coffeeTable.height, tableDepth],
      groupId: loungeGroupIds.coffeeTable,
    },
    {
      id: "lounge-floor-lamp-collider",
      label: "落地灯碰撞体",
      shape: "cylinder",
      position: transformLoungePoint([0, loungeDimensions.floorLamp.height / 2, 0], transforms.floorLamp),
      rotation: [0, 0, 0],
      size: [loungeDimensions.floorLamp.shadeRadius * 2, loungeDimensions.floorLamp.height, loungeDimensions.floorLamp.shadeRadius * 2],
      radius: loungeDimensions.floorLamp.shadeRadius,
      height: loungeDimensions.floorLamp.height,
      groupId: loungeGroupIds.floorLamp,
    },
    {
      id: "lounge-plant-collider",
      label: "绿植碰撞体",
      shape: "cylinder",
      position: transformLoungePoint([0, loungeDimensions.plant.colliderHeight / 2, 0], transforms.plant),
      rotation: [0, 0, 0],
      size: [loungeDimensions.plant.colliderRadius * 2, loungeDimensions.plant.colliderHeight, loungeDimensions.plant.colliderRadius * 2],
      radius: loungeDimensions.plant.colliderRadius,
      height: loungeDimensions.plant.colliderHeight,
      groupId: loungeGroupIds.plant,
    },
  ],
  anchors: [
    ...[-1, 0, 1].map((column, index) => ({
      id: `lounge-sofa-seat-${index + 1}`,
      label: `沙发座位 ${index + 1}`,
      kind: "seat" as const,
      position: transformLoungePoint([getLoungeSofaSeatX(defaultLoungeParameters.sofaWidth, column as -1 | 0 | 1), defaultLoungeParameters.seatHeight, 55], transforms.sofa),
      rotation: yawRotation(transforms.sofa.rotationY),
      range: 760,
      groupId: loungeGroupIds.sofa,
      tags: ["sit", "sofa", `seat-${index + 1}`],
    })),
    {
      id: "lounge-left-chair-seat",
      label: "左单椅座位",
      kind: "seat",
      position: transformLoungePoint([0, defaultLoungeParameters.seatHeight, 55], transforms.leftChair),
      rotation: yawRotation(transforms.leftChair.rotationY),
      range: 720,
      groupId: loungeGroupIds.leftChair,
      tags: ["sit", "armchair", "left"],
    },
    {
      id: "lounge-right-chair-seat",
      label: "右单椅座位",
      kind: "seat",
      position: transformLoungePoint([0, defaultLoungeParameters.seatHeight, 55], transforms.rightChair),
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
      position: transformLoungePoint([0, loungeDimensions.coffeeTable.height + 100, 0], transforms.coffeeTable),
      rotation: yawRotation(transforms.coffeeTable.rotationY),
      range: 760,
      groupId: loungeGroupIds.coffeeTable,
      tags: ["table", "place-item", "pickup-item"],
    },
    {
      id: "lounge-floor-lamp-toggle",
      label: "切换落地灯",
      kind: "interaction",
      position: transformLoungePoint([0, 1_080, loungeDimensions.floorLamp.baseRadius + 80], transforms.floorLamp),
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
        { id: "lounge-desktop-full", maximumDistance: 9_000, featureIds: allFeatureIds, triangleBudget: 4_600 },
        { id: "lounge-desktop-medium", maximumDistance: 18_000, featureIds: simplifiedFeatureIds, triangleBudget: 2_200 },
        { id: "lounge-desktop-silhouette", maximumDistance: 32_000, featureIds: silhouetteFeatureIds, triangleBudget: 760 },
      ],
    },
    {
      device: "mobile",
      levels: [
        { id: "lounge-mobile-near", maximumDistance: 8_500, featureIds: simplifiedFeatureIds, triangleBudget: 1_900 },
        { id: "lounge-mobile-silhouette", maximumDistance: 20_000, featureIds: silhouetteFeatureIds, triangleBudget: 620 },
      ],
    },
  ],
  previews: [
    {
      device: "desktop",
      cameraPosition: [5_600, 3_000, 6_600],
      cameraTarget: [0, 560, 0],
      background: "dark",
    },
    {
      device: "mobile",
      cameraPosition: [6_900, 3_650, 8_100],
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
