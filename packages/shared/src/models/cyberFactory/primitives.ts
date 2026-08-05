import type {
  BoxFeature,
  CornerAlgorithm,
  CreateModelInput,
  CylinderFeature,
  FeatureMaterialPreset,
  FeatureGroup,
  MeshFeature,
  ModelFeature,
  ModelReferenceInstance,
  ModelVariable,
  ProceduralMeshSource,
  RoomShellSource,
  Vector3Tuple,
} from "../../types.js";

const origin: Vector3Tuple = [0, 0, 0];

function withAppearance<T extends ModelFeature>(
  feature: T,
  material: FeatureMaterialPreset,
  color: string,
): T {
  return {
    ...feature,
    appearance: { material, color },
  };
}

type AppearanceDefinition = { material: FeatureMaterialPreset; color: string };

function withFeatureAppearances<T extends ModelFeature>(
  features: T[],
  defaultAppearance: AppearanceDefinition,
  overrides: Record<string, AppearanceDefinition> = {},
): T[] {
  return features.map((feature) => {
    const appearance = overrides[feature.id] ?? defaultAppearance;
    return withAppearance(feature, appearance.material, appearance.color);
  });
}

function withParameterExpressions<T extends ModelFeature>(
  feature: T,
  parameterExpressions: Record<string, string>,
): T {
  return { ...feature, parameterExpressions };
}

function box(
  id: string,
  name: string,
  size: Vector3Tuple,
  position: Vector3Tuple,
  rotation: Vector3Tuple = origin,
  rounding?: { radius: number; algorithm: CornerAlgorithm },
): BoxFeature {
  return {
    id,
    name,
    type: "box",
    operation: "add",
    position,
    rotation,
    parameters: {
      width: size[0],
      height: size[1],
      depth: size[2],
      ...(rounding ? { cornerRadius: rounding.radius, cornerAlgorithm: rounding.algorithm } : {}),
    },
  };
}

function cylinder(
  id: string,
  name: string,
  radius: number,
  height: number,
  position: Vector3Tuple,
  rotation: Vector3Tuple = origin,
): CylinderFeature {
  return {
    id,
    name,
    type: "cylinder",
    operation: "add",
    position,
    rotation,
    parameters: { radius, height },
  };
}

function ellipsoid(
  id: string,
  name: string,
  radii: Vector3Tuple,
  position: Vector3Tuple,
  widthSegments = 24,
  heightSegments = 16,
): MeshFeature {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let verticalIndex = 0; verticalIndex <= heightSegments; verticalIndex += 1) {
    const phi = verticalIndex / heightSegments * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    for (let horizontalIndex = 0; horizontalIndex <= widthSegments; horizontalIndex += 1) {
      const theta = horizontalIndex / widthSegments * Math.PI * 2;
      const normal: Vector3Tuple = [
        sinPhi * Math.cos(theta),
        cosPhi,
        sinPhi * Math.sin(theta),
      ];
      positions.push(normal[0] * radii[0], normal[1] * radii[1], normal[2] * radii[2]);
      const scaledNormal: Vector3Tuple = [
        normal[0] / radii[0],
        normal[1] / radii[1],
        normal[2] / radii[2],
      ];
      const normalLength = Math.hypot(...scaledNormal) || 1;
      normals.push(
        scaledNormal[0] / normalLength,
        scaledNormal[1] / normalLength,
        scaledNormal[2] / normalLength,
      );
    }
  }
  const rowSize = widthSegments + 1;
  for (let verticalIndex = 0; verticalIndex < heightSegments; verticalIndex += 1) {
    for (let horizontalIndex = 0; horizontalIndex < widthSegments; horizontalIndex += 1) {
      const topLeft = verticalIndex * rowSize + horizontalIndex;
      const bottomLeft = topLeft + rowSize;
      const bottomRight = bottomLeft + 1;
      const topRight = topLeft + 1;
      if (verticalIndex !== 0) indices.push(topLeft, topRight, bottomLeft);
      if (verticalIndex !== heightSegments - 1) indices.push(topRight, bottomRight, bottomLeft);
    }
  }
  return {
    id,
    name,
    type: "mesh",
    operation: "add",
    position,
    rotation: origin,
    parameters: { positions, normals, indices },
  };
}

function sphere(
  id: string,
  name: string,
  radius: number,
  position: Vector3Tuple,
  widthSegments = 24,
  heightSegments = 16,
): MeshFeature {
  return ellipsoid(id, name, [radius, radius, radius], position, widthSegments, heightSegments);
}

function group(id: string, name: string, features: ModelFeature[]): FeatureGroup {
  return {
    id,
    name,
    featureIds: features.map((feature) => feature.id),
    position: origin,
    rotation: origin,
  };
}

function model(name: string, description: string, features: ModelFeature[], groups: FeatureGroup[]): CreateModelInput {
  return {
    name,
    description,
    unit: "mm",
    featureGraph: { version: 1, features, groups },
  };
}

function offsetWithXRotation(
  center: Vector3Tuple,
  offset: Vector3Tuple,
  rotationX: number,
): Vector3Tuple {
  const radians = rotationX * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    center[0] + offset[0],
    center[1] + offset[1] * cosine - offset[2] * sine,
    center[2] + offset[1] * sine + offset[2] * cosine,
  ];
}

function roundedRectangleLoop(width: number, height: number, radius: number, segments: number) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cornerRadius = Math.min(Math.max(radius, 0), halfWidth, halfHeight);
  const corners = [
    [halfWidth - cornerRadius, halfHeight - cornerRadius, 0],
    [-halfWidth + cornerRadius, halfHeight - cornerRadius, 90],
    [-halfWidth + cornerRadius, -halfHeight + cornerRadius, 180],
    [halfWidth - cornerRadius, -halfHeight + cornerRadius, 270],
  ] as const;
  return corners.flatMap(([centerX, centerY, startAngle]) => (
    Array.from({ length: segments + 1 }, (_, index): Vector3Tuple => {
      const angle = (startAngle + index * 90 / segments) * Math.PI / 180;
      return [
        centerX + Math.cos(angle) * cornerRadius,
        centerY + Math.sin(angle) * cornerRadius,
        0,
      ];
    })
  ));
}

export {
  box,
  cylinder,
  ellipsoid,
  group,
  model,
  offsetWithXRotation,
  origin,
  roundedRectangleLoop,
  sphere,
  withAppearance,
  withFeatureAppearances,
  withParameterExpressions,
};
export type { AppearanceDefinition };
