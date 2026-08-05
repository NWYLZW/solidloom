import type {
  BoxFeature,
  CreateModelInput,
  ModelFeature,
  ModelVariable,
  RoomShellSource,
  Vector3Tuple,
} from "../../types.js";
import {
  box,
  cylinder,
  ellipsoid,
  group,
  model,
  normalizeRoomShellSource,
  offsetWithXRotation,
  origin,
  proceduralRoomShell,
  recessedLaptopDeck,
  recessedRoundedPanel,
  sphere,
  withAppearance,
  withFeatureAppearances,
  withParameterExpressions,
  type AppearanceDefinition,
} from "./factory.js";

function roomAssemblyFeatures(source: RoomShellSource): ModelFeature[] {
  const normalized = normalizeRoomShellSource(source);
  const [width, , depth] = normalized.size;
  const wall = normalized.wallThickness;
  const floor = normalized.floorThickness;
  const doorGap = Math.min(16, normalized.door.width / 12, normalized.door.height / 20);
  const doorThickness = Math.max(24, wall * 0.42);
  const doorCenterY = floor + normalized.door.height / 2;
  const doorCenterX = -width / 2 + wall / 2;
  const door = withAppearance(
    box(
      "cyber-room-door",
      "房门",
      [doorThickness, normalized.door.height - doorGap * 2, normalized.door.width - doorGap * 2],
      [doorCenterX, doorCenterY, normalized.door.offsetZ],
      origin,
      { radius: Math.min(12, doorGap), algorithm: "smooth" },
    ),
    "wood",
    "#8B5A3C",
  );
  const handleLength = Math.max(54, wall * 0.52);
  const handle = withAppearance(
    cylinder(
      "cyber-room-door-handle",
      "门把手",
      38,
      handleLength,
      [-width / 2 + wall + handleLength / 2, floor + normalized.door.height * 0.52, normalized.door.offsetZ + normalized.door.width * 0.33],
      [0, 0, 90],
    ),
    "metal",
    "#6F777C",
  );

  const windowCenterY = floor + normalized.window.sillHeight + normalized.window.height / 2;
  const windowCenterZ = -depth / 2 + wall / 2;
  const glassInset = normalized.window.fullWall
    ? 0
    : Math.min(10, normalized.window.width / 24, normalized.window.height / 24);
  const glass = withAppearance(
    box(
      "cyber-room-window-glass",
      "落地窗玻璃",
      [normalized.window.width - glassInset * 2, normalized.window.height - glassInset * 2, Math.max(10, wall * 0.16)],
      [normalized.window.offsetX, windowCenterY, windowCenterZ],
    ),
    "glass",
    "#78B5C7",
  );
  const frameThickness = wall;
  const frameDepth = wall;
  const frameCenterZ = -depth / 2 + wall / 2;
  const frame = [
    box("cyber-room-window-frame-left", "窗框左沿", [frameThickness, normalized.window.height, frameDepth], [normalized.window.offsetX - normalized.window.width / 2 - frameThickness / 2, windowCenterY, frameCenterZ]),
    box("cyber-room-window-frame-right", "窗框右沿", [frameThickness, normalized.window.height, frameDepth], [normalized.window.offsetX + normalized.window.width / 2 + frameThickness / 2, windowCenterY, frameCenterZ]),
  ].map((feature) => withAppearance(feature, "metal", "#646D72"));
  const glassWidth = "var(--room-width) - 2 * var(--wall-thickness)";
  const glassHeight = "var(--room-height) - 2 * var(--floor-thickness)";
  const glassDepth = "max(10, var(--wall-thickness) * 0.16)";
  const frameDepthExpression = "var(--wall-thickness)";
  const frameZ = "-var(--room-depth) / 2 + var(--wall-thickness) / 2";
  const doorGapExpression = "min(16, var(--door-width) / 12, var(--door-height) / 20)";
  const expressionsByFeatureId: Record<string, Record<string, string>> = {
    "cyber-room-door": {
      "parameters.width": "max(24, var(--wall-thickness) * 0.42)",
      "parameters.height": `var(--door-height) - 2 * ${doorGapExpression}`,
      "parameters.depth": `var(--door-width) - 2 * ${doorGapExpression}`,
      "position.0": "-var(--room-width) / 2 + var(--wall-thickness) / 2",
      "position.1": "var(--floor-thickness) + var(--door-height) / 2",
      "position.2": "var(--door-offset-z)",
    },
    "cyber-room-door-handle": {
      "parameters.height": "max(54, var(--wall-thickness) * 0.52)",
      "position.0": "-var(--room-width) / 2 + var(--wall-thickness) + max(54, var(--wall-thickness) * 0.52) / 2",
      "position.1": "var(--floor-thickness) + var(--door-height) * 0.52",
      "position.2": "var(--door-offset-z) + var(--door-width) * 0.33",
    },
    "cyber-room-window-glass": {
      "parameters.width": glassWidth,
      "parameters.height": glassHeight,
      "parameters.depth": glassDepth,
      "position.0": "0",
      "position.1": "var(--room-height) / 2",
      "position.2": "-var(--room-depth) / 2 + var(--wall-thickness) / 2",
    },
    "cyber-room-window-frame-left": {
      "parameters.width": "var(--wall-thickness)",
      "parameters.height": glassHeight,
      "parameters.depth": frameDepthExpression,
      "position.0": `-((${glassWidth}) + var(--wall-thickness)) / 2`,
      "position.1": "var(--room-height) / 2",
      "position.2": frameZ,
    },
    "cyber-room-window-frame-right": {
      "parameters.width": "var(--wall-thickness)",
      "parameters.height": glassHeight,
      "parameters.depth": frameDepthExpression,
      "position.0": `((${glassWidth}) + var(--wall-thickness)) / 2`,
      "position.1": "var(--room-height) / 2",
      "position.2": frameZ,
    },
  };
  return [door, handle, glass, ...frame].map((feature) => (
    withParameterExpressions(feature, expressionsByFeatureId[feature.id] ?? {})
  ));
}

export function synchronizeRoomAssemblyFeatures(features: ModelFeature[], source: RoomShellSource): ModelFeature[] {
  const replacements = new Map(roomAssemblyFeatures(source).map((feature) => [feature.id, feature]));
  return features.map((feature) => {
    const replacement = replacements.get(feature.id);
    if (!replacement) return feature;
    return {
      ...replacement,
      name: feature.name,
      ...(feature.appearance ? { appearance: feature.appearance } : {}),
      ...(feature.parameterExpressions ? { parameterExpressions: feature.parameterExpressions } : {}),
    };
  });
}

export function createRoom(): CreateModelInput {
  const variables: ModelVariable[] = [
    { id: "--room-width", label: "整体宽度", value: 9600, unit: "mm" },
    { id: "--room-height", label: "整体高度", value: 2800, unit: "mm" },
    { id: "--room-depth", label: "整体深度", value: 6000, unit: "mm" },
    { id: "--wall-thickness", label: "墙体厚度", value: 120, unit: "mm" },
    { id: "--floor-thickness", label: "地板与天花板厚度", value: 160, unit: "mm" },
    { id: "--door-width", label: "门宽", value: 920, unit: "mm" },
    { id: "--door-height", label: "门高", value: 2100, unit: "mm" },
    { id: "--door-offset-z", label: "门位置 Z", value: -650, unit: "mm" },
  ];
  const source: RoomShellSource = {
    kind: "room-shell",
    size: [9600, 2800, 6000],
    wallThickness: 120,
    floorThickness: 160,
    autoHideSurfaces: false,
    door: { width: 920, height: 2100, offsetZ: -650 },
    window: { fullWall: true, width: 9360, height: 2480, sillHeight: 0, offsetX: 0 },
  };
  const shell = withParameterExpressions(
    withAppearance(
      proceduralRoomShell(
        "cyber-room-shell",
        "房间壳体",
        origin,
        source,
      ),
      "default",
      "#D8D2C6",
    ),
    {
      "parameters.source.size.0": "var(--room-width)",
      "parameters.source.size.1": "var(--room-height)",
      "parameters.source.size.2": "var(--room-depth)",
      "parameters.source.wallThickness": "var(--wall-thickness)",
      "parameters.source.floorThickness": "var(--floor-thickness)",
      "parameters.source.door.width": "var(--door-width)",
      "parameters.source.door.height": "var(--door-height)",
      "parameters.source.door.offsetZ": "var(--door-offset-z)",
    },
  );
  const parts = roomAssemblyFeatures(source);
  const door = parts.filter((feature) => feature.id === "cyber-room-door" || feature.id === "cyber-room-door-handle");
  const window = parts.filter((feature) => feature.id.startsWith("cyber-room-window-"));
  const features = [shell, ...parts];
  const room = model(
    "房间",
    "带房门和整面玻璃幕墙的完整六面体程序化房间，可统一调整尺寸和结构厚度，并按视角自动剖视近侧表面。",
    features,
    [
      group("cyber-room-structure", "房间结构", [shell]),
      group("cyber-room-door-group", "门组件", door),
      group("cyber-room-window-group", "玻璃幕墙组件", window),
    ],
  );
  if (room.featureGraph) room.featureGraph.variables = variables;
  return room;
}
