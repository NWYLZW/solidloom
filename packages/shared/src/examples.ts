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
} from "./types.js";

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

function recessedRoundedPanel(
  id: string,
  name: string,
  size: Vector3Tuple,
  recessSize: Vector3Tuple,
  position: Vector3Tuple,
  rotation: Vector3Tuple,
  outerRadius: number,
  recessRadius: number,
  backFilletRadius: number,
): MeshFeature {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const addTriangle = (a: Vector3Tuple, b: Vector3Tuple, c: Vector3Tuple) => {
    const ab: Vector3Tuple = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac: Vector3Tuple = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross: Vector3Tuple = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.hypot(...cross) || 1;
    const normal = cross.map((value) => value / length) as Vector3Tuple;
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c);
    normals.push(...normal, ...normal, ...normal);
    indices.push(start, start + 1, start + 2);
  };
  const addQuad = (a: Vector3Tuple, b: Vector3Tuple, c: Vector3Tuple, d: Vector3Tuple) => {
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  };
  const addTriangleWithNormals = (
    a: Vector3Tuple,
    normalA: Vector3Tuple,
    b: Vector3Tuple,
    normalB: Vector3Tuple,
    c: Vector3Tuple,
    normalC: Vector3Tuple,
  ) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c);
    normals.push(...normalA, ...normalB, ...normalC);
    indices.push(start, start + 1, start + 2);
  };
  const addQuadWithNormals = (
    a: Vector3Tuple,
    normalA: Vector3Tuple,
    b: Vector3Tuple,
    normalB: Vector3Tuple,
    c: Vector3Tuple,
    normalC: Vector3Tuple,
    d: Vector3Tuple,
    normalD: Vector3Tuple,
  ) => {
    addTriangleWithNormals(a, normalA, b, normalB, c, normalC);
    addTriangleWithNormals(a, normalA, c, normalC, d, normalD);
  };

  const segments = 8;
  const backDepth = -size[2] / 2;
  const frontDepth = size[2] / 2;
  const floorDepth = frontDepth - recessSize[2];
  const outerLoop = roundedRectangleLoop(size[0], size[1], outerRadius, segments);
  const recessLoop = roundedRectangleLoop(recessSize[0], recessSize[1], recessRadius, segments);
  const atDepth = (point: Vector3Tuple, depth: number): Vector3Tuple => [point[0], point[1], depth];

  const horizontalNormal = (point: Vector3Tuple, width: number, height: number, radius: number): Vector3Tuple => {
    const coreX = Math.max(-width / 2 + radius, Math.min(width / 2 - radius, point[0]));
    const coreY = Math.max(-height / 2 + radius, Math.min(height / 2 - radius, point[1]));
    const deltaX = point[0] - coreX;
    const deltaY = point[1] - coreY;
    const length = Math.hypot(deltaX, deltaY) || 1;
    return [deltaX / length, deltaY / length, 0];
  };
  const outerNormals = outerLoop.map((point) => horizontalNormal(point, size[0], size[1], outerRadius));
  const filletRadius = Math.min(
    Math.max(backFilletRadius, 0),
    size[2] / 2,
    outerRadius,
  );
  const sideBackDepth = backDepth + filletRadius;

  for (let index = 0; index < outerLoop.length; index += 1) {
    const next = (index + 1) % outerLoop.length;
    const outerBack = atDepth(outerLoop[index]!, sideBackDepth);
    const outerBackNext = atDepth(outerLoop[next]!, sideBackDepth);
    const outerFront = atDepth(outerLoop[index]!, frontDepth);
    const outerFrontNext = atDepth(outerLoop[next]!, frontDepth);
    const recessFront = atDepth(recessLoop[index]!, frontDepth);
    const recessFrontNext = atDepth(recessLoop[next]!, frontDepth);
    const recessFloor = atDepth(recessLoop[index]!, floorDepth);
    const recessFloorNext = atDepth(recessLoop[next]!, floorDepth);
    addQuadWithNormals(
      outerBack, outerNormals[index]!,
      outerBackNext, outerNormals[next]!,
      outerFrontNext, outerNormals[next]!,
      outerFront, outerNormals[index]!,
    );
    addQuad(outerFront, outerFrontNext, recessFrontNext, recessFront);
    addQuad(recessFront, recessFrontNext, recessFloorNext, recessFloor);
  }

  const filletSegments = 10;
  const filletRings = Array.from({ length: filletSegments + 1 }, (_, segment) => {
    const angle = segment * Math.PI / 2 / filletSegments;
    const inset = filletRadius * (1 - Math.cos(angle));
    const width = size[0] - inset * 2;
    const height = size[1] - inset * 2;
    const radius = Math.max(outerRadius - inset, 0.001);
    const loop = roundedRectangleLoop(width, height, radius, segments);
    const normalScale = Math.cos(angle);
    return {
      depth: backDepth + filletRadius * (1 - Math.sin(angle)),
      loop,
      normals: loop.map((point): Vector3Tuple => {
        const normal = horizontalNormal(point, width, height, radius);
        return [normal[0] * normalScale, normal[1] * normalScale, -Math.sin(angle)];
      }),
    };
  });
  for (let ringIndex = 0; ringIndex < filletRings.length - 1; ringIndex += 1) {
    const ring = filletRings[ringIndex]!;
    const nextRing = filletRings[ringIndex + 1]!;
    for (let index = 0; index < ring.loop.length; index += 1) {
      const next = (index + 1) % ring.loop.length;
      addQuadWithNormals(
        atDepth(ring.loop[index]!, ring.depth), ring.normals[index]!,
        atDepth(nextRing.loop[index]!, nextRing.depth), nextRing.normals[index]!,
        atDepth(nextRing.loop[next]!, nextRing.depth), nextRing.normals[next]!,
        atDepth(ring.loop[next]!, ring.depth), ring.normals[next]!,
      );
    }
  }

  const backLoop = filletRings[filletRings.length - 1]!.loop;
  const backCenter: Vector3Tuple = [0, 0, backDepth];
  const floorCenter: Vector3Tuple = [0, 0, floorDepth];
  for (let index = 0; index < backLoop.length; index += 1) {
    const next = (index + 1) % backLoop.length;
    addTriangleWithNormals(
      backCenter, [0, 0, -1],
      atDepth(backLoop[next]!, backDepth), [0, 0, -1],
      atDepth(backLoop[index]!, backDepth), [0, 0, -1],
    );
  }
  for (let index = 0; index < recessLoop.length; index += 1) {
    const next = (index + 1) % recessLoop.length;
    addTriangle(floorCenter, atDepth(recessLoop[index]!, floorDepth), atDepth(recessLoop[next]!, floorDepth));
  }

  return {
    id,
    name,
    type: "mesh",
    operation: "add",
    position,
    rotation,
    parameters: {
      positions,
      normals,
      indices,
      source: {
        kind: "recessed-panel",
        size: [...size] as Vector3Tuple,
        recessSize: [...recessSize] as Vector3Tuple,
        outlineRadius: outerRadius,
        recessRadius,
        edgeFilletRadius: backFilletRadius,
      },
    },
  };
}

function recessedLaptopDeck(
  id: string,
  name: string,
  size: Vector3Tuple,
  position: Vector3Tuple,
  recesses: Array<{ center: [number, number]; size: [number, number]; depth: number }>,
  outerRadius: number,
  bottomFilletRadius: number,
): MeshFeature {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const addTriangle = (a: Vector3Tuple, b: Vector3Tuple, c: Vector3Tuple) => {
    const ab: Vector3Tuple = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac: Vector3Tuple = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cross: Vector3Tuple = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const length = Math.hypot(...cross) || 1;
    const normal = cross.map((value) => value / length) as Vector3Tuple;
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c);
    normals.push(...normal, ...normal, ...normal);
    indices.push(start, start + 1, start + 2);
  };
  const addQuad = (a: Vector3Tuple, b: Vector3Tuple, c: Vector3Tuple, d: Vector3Tuple) => {
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  };
  const addTriangleWithNormals = (
    a: Vector3Tuple,
    normalA: Vector3Tuple,
    b: Vector3Tuple,
    normalB: Vector3Tuple,
    c: Vector3Tuple,
    normalC: Vector3Tuple,
  ) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c);
    normals.push(...normalA, ...normalB, ...normalC);
    indices.push(start, start + 1, start + 2);
  };
  const addQuadWithNormals = (
    a: Vector3Tuple,
    normalA: Vector3Tuple,
    b: Vector3Tuple,
    normalB: Vector3Tuple,
    c: Vector3Tuple,
    normalC: Vector3Tuple,
    d: Vector3Tuple,
    normalD: Vector3Tuple,
  ) => {
    addTriangleWithNormals(a, normalA, b, normalB, c, normalC);
    addTriangleWithNormals(a, normalA, c, normalC, d, normalD);
  };
  const addHorizontalQuad = (xMin: number, xMax: number, zMin: number, zMax: number, y: number) => {
    addQuad([xMin, y, zMin], [xMin, y, zMax], [xMax, y, zMax], [xMax, y, zMin]);
  };

  const halfWidth = size[0] / 2;
  const halfHeight = size[1] / 2;
  const halfDepth = size[2] / 2;
  const radius = Math.min(outerRadius, halfWidth, halfDepth);
  const innerHalfWidth = halfWidth - radius;
  const innerHalfDepth = halfDepth - radius;
  const topY = halfHeight;
  const bottomY = -halfHeight;
  const bounds = recesses.map((recess) => ({
    xMin: recess.center[0] - recess.size[0] / 2,
    xMax: recess.center[0] + recess.size[0] / 2,
    zMin: recess.center[1] - recess.size[1] / 2,
    zMax: recess.center[1] + recess.size[1] / 2,
    floorY: topY - recess.depth,
  }));
  const xCoordinates = [...new Set([
    -innerHalfWidth,
    innerHalfWidth,
    ...bounds.flatMap((recess) => [recess.xMin, recess.xMax]),
  ])].sort((left, right) => left - right);
  const zCoordinates = [...new Set([
    -halfDepth,
    halfDepth,
    ...bounds.flatMap((recess) => [recess.zMin, recess.zMax]),
  ])].sort((left, right) => left - right);

  for (let xIndex = 0; xIndex < xCoordinates.length - 1; xIndex += 1) {
    for (let zIndex = 0; zIndex < zCoordinates.length - 1; zIndex += 1) {
      const xMin = xCoordinates[xIndex]!;
      const xMax = xCoordinates[xIndex + 1]!;
      const zMin = zCoordinates[zIndex]!;
      const zMax = zCoordinates[zIndex + 1]!;
      const centerX = (xMin + xMax) / 2;
      const centerZ = (zMin + zMax) / 2;
      if (bounds.some((recess) => centerX > recess.xMin && centerX < recess.xMax && centerZ > recess.zMin && centerZ < recess.zMax)) continue;
      addHorizontalQuad(xMin, xMax, zMin, zMax, topY);
    }
  }

  addHorizontalQuad(-halfWidth, -innerHalfWidth, -innerHalfDepth, innerHalfDepth, topY);
  addHorizontalQuad(innerHalfWidth, halfWidth, -innerHalfDepth, innerHalfDepth, topY);
  const cornerSegments = 10;
  for (const startAngle of [0, 90, 180, 270]) {
    const centerX = Math.cos((startAngle + 45) * Math.PI / 180) > 0 ? innerHalfWidth : -innerHalfWidth;
    const centerZ = Math.sin((startAngle + 45) * Math.PI / 180) > 0 ? innerHalfDepth : -innerHalfDepth;
    const center: Vector3Tuple = [centerX, topY, centerZ];
    for (let segment = 0; segment < cornerSegments; segment += 1) {
      const firstAngle = (startAngle + segment * 90 / cornerSegments) * Math.PI / 180;
      const secondAngle = (startAngle + (segment + 1) * 90 / cornerSegments) * Math.PI / 180;
      const first: Vector3Tuple = [centerX + Math.cos(firstAngle) * radius, topY, centerZ + Math.sin(firstAngle) * radius];
      const second: Vector3Tuple = [centerX + Math.cos(secondAngle) * radius, topY, centerZ + Math.sin(secondAngle) * radius];
      addTriangle(center, second, first);
    }
  }

  for (const recess of bounds) {
    addHorizontalQuad(recess.xMin, recess.xMax, recess.zMin, recess.zMax, recess.floorY);
    addQuad(
      [recess.xMin, topY, recess.zMin],
      [recess.xMin, recess.floorY, recess.zMin],
      [recess.xMax, recess.floorY, recess.zMin],
      [recess.xMax, topY, recess.zMin],
    );
    addQuad(
      [recess.xMin, topY, recess.zMax],
      [recess.xMax, topY, recess.zMax],
      [recess.xMax, recess.floorY, recess.zMax],
      [recess.xMin, recess.floorY, recess.zMax],
    );
    addQuad(
      [recess.xMin, topY, recess.zMin],
      [recess.xMin, topY, recess.zMax],
      [recess.xMin, recess.floorY, recess.zMax],
      [recess.xMin, recess.floorY, recess.zMin],
    );
    addQuad(
      [recess.xMax, topY, recess.zMin],
      [recess.xMax, recess.floorY, recess.zMin],
      [recess.xMax, recess.floorY, recess.zMax],
      [recess.xMax, topY, recess.zMax],
    );
  }

  const horizontalNormal = (point: Vector3Tuple, width: number, depth: number, loopRadius: number): Vector3Tuple => {
    const x = point[0];
    const z = point[1];
    const coreX = Math.max(-width / 2 + loopRadius, Math.min(width / 2 - loopRadius, x));
    const coreZ = Math.max(-depth / 2 + loopRadius, Math.min(depth / 2 - loopRadius, z));
    const deltaX = x - coreX;
    const deltaZ = z - coreZ;
    const length = Math.hypot(deltaX, deltaZ) || 1;
    return [deltaX / length, 0, deltaZ / length];
  };
  const outerLoop = roundedRectangleLoop(size[0], size[2], radius, cornerSegments);
  const outerNormals = outerLoop.map((point) => horizontalNormal(point, size[0], size[2], radius));
  const filletRadius = Math.min(Math.max(bottomFilletRadius, 0), halfHeight, radius);
  const sideBottomY = bottomY + filletRadius;
  for (let index = 0; index < outerLoop.length; index += 1) {
    const next = (index + 1) % outerLoop.length;
    const current = outerLoop[index]!;
    const following = outerLoop[next]!;
    addQuadWithNormals(
      [current[0], topY, current[1]], outerNormals[index]!,
      [following[0], topY, following[1]], outerNormals[next]!,
      [following[0], sideBottomY, following[1]], outerNormals[next]!,
      [current[0], sideBottomY, current[1]], outerNormals[index]!,
    );
  }

  const filletSegments = 10;
  const filletRings = Array.from({ length: filletSegments + 1 }, (_, segment) => {
    const angle = segment * Math.PI / 2 / filletSegments;
    const inset = filletRadius * (1 - Math.cos(angle));
    const y = bottomY + filletRadius * (1 - Math.sin(angle));
    const width = size[0] - inset * 2;
    const depth = size[2] - inset * 2;
    const loopRadius = Math.max(radius - inset, 0.001);
    const loop = roundedRectangleLoop(width, depth, loopRadius, cornerSegments);
    const normalScale = Math.cos(angle);
    return {
      loop,
      normals: loop.map((point): Vector3Tuple => {
        const normal = horizontalNormal(point, width, depth, loopRadius);
        return [normal[0] * normalScale, -Math.sin(angle), normal[2] * normalScale];
      }),
      y,
    };
  });
  for (let ringIndex = 0; ringIndex < filletRings.length - 1; ringIndex += 1) {
    const ring = filletRings[ringIndex]!;
    const nextRing = filletRings[ringIndex + 1]!;
    for (let index = 0; index < ring.loop.length; index += 1) {
      const next = (index + 1) % ring.loop.length;
      const current = ring.loop[index]!;
      const following = ring.loop[next]!;
      const nextCurrent = nextRing.loop[index]!;
      const nextFollowing = nextRing.loop[next]!;
      addQuadWithNormals(
        [current[0], ring.y, current[1]], ring.normals[index]!,
        [following[0], ring.y, following[1]], ring.normals[next]!,
        [nextFollowing[0], nextRing.y, nextFollowing[1]], nextRing.normals[next]!,
        [nextCurrent[0], nextRing.y, nextCurrent[1]], nextRing.normals[index]!,
      );
    }
  }

  const bottomLoop = filletRings[filletRings.length - 1]!.loop;
  const bottomCenter: Vector3Tuple = [0, bottomY, 0];
  const bottomNormal: Vector3Tuple = [0, -1, 0];
  for (let index = 0; index < bottomLoop.length; index += 1) {
    const next = (index + 1) % bottomLoop.length;
    const current = bottomLoop[index]!;
    const following = bottomLoop[next]!;
    addTriangleWithNormals(
      bottomCenter, bottomNormal,
      [current[0], bottomY, current[1]], bottomNormal,
      [following[0], bottomY, following[1]], bottomNormal,
    );
  }

  return {
    id,
    name,
    type: "mesh",
    operation: "add",
    position,
    rotation: origin,
    parameters: {
      positions,
      normals,
      indices,
      source: {
        kind: "recessed-deck",
        size: [...size] as Vector3Tuple,
        recesses: recesses.map((recess) => ({
          center: [...recess.center] as [number, number],
          size: [...recess.size] as [number, number],
          depth: recess.depth,
        })),
        outlineRadius: outerRadius,
        edgeFilletRadius: bottomFilletRadius,
      },
    },
  };
}

function normalizeRoomShellSource(source: RoomShellSource): RoomShellSource {
  const size = source.size.map((value) => Math.max(1, value)) as Vector3Tuple;
  const wallThickness = Math.min(Math.max(0.1, source.wallThickness), size[0] / 2, size[2] / 2);
  const floorThickness = Math.min(Math.max(0.1, source.floorThickness), size[1] / 2);
  const clearHeight = Math.max(0.1, size[1] - floorThickness * 2);
  const clearWidth = Math.max(0.1, size[0] - wallThickness * 2);
  const clearDepth = Math.max(0.1, size[2] - wallThickness * 2);
  const openingMargin = Math.max(0.01, Math.min(40, clearWidth / 4, clearDepth / 4, clearHeight / 4));
  const doorWidth = Math.min(Math.max(0.1, source.door.width), clearDepth - openingMargin * 2);
  const doorHeight = Math.min(Math.max(0.1, source.door.height), clearHeight - openingMargin);
  const fullWallWindow = source.window.fullWall === true;
  const windowWidth = fullWallWindow
    ? clearWidth
    : Math.min(Math.max(0.1, source.window.width), clearWidth - openingMargin * 2);
  const windowHeight = fullWallWindow
    ? clearHeight
    : Math.min(Math.max(0.1, source.window.height), clearHeight - openingMargin * 2);
  return {
    ...source,
    size,
    wallThickness,
    floorThickness,
    door: {
      width: doorWidth,
      height: doorHeight,
      offsetZ: Math.max(-(clearDepth - doorWidth) / 2, Math.min((clearDepth - doorWidth) / 2, source.door.offsetZ)),
    },
    window: {
      fullWall: fullWallWindow,
      width: windowWidth,
      height: windowHeight,
      sillHeight: fullWallWindow
        ? 0
        : Math.max(openingMargin, Math.min(clearHeight - windowHeight - openingMargin, source.window.sillHeight)),
      offsetX: fullWallWindow
        ? 0
        : Math.max(-(clearWidth - windowWidth) / 2, Math.min((clearWidth - windowWidth) / 2, source.window.offsetX)),
    },
  };
}

function proceduralRoomShell(
  id: string,
  name: string,
  position: Vector3Tuple,
  source: RoomShellSource,
): MeshFeature {
  const normalized = normalizeRoomShellSource(source);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const addQuad = (
    a: Vector3Tuple,
    b: Vector3Tuple,
    c: Vector3Tuple,
    d: Vector3Tuple,
    normal: Vector3Tuple,
  ) => {
    const start = positions.length / 3;
    positions.push(...a, ...b, ...c, ...d);
    normals.push(...normal, ...normal, ...normal, ...normal);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  const addBox = (boxSize: Vector3Tuple, center: Vector3Tuple) => {
    const xMin = center[0] - boxSize[0] / 2;
    const xMax = center[0] + boxSize[0] / 2;
    const yMin = center[1] - boxSize[1] / 2;
    const yMax = center[1] + boxSize[1] / 2;
    const zMin = center[2] - boxSize[2] / 2;
    const zMax = center[2] + boxSize[2] / 2;
    addQuad([xMax, yMin, zMin], [xMax, yMax, zMin], [xMax, yMax, zMax], [xMax, yMin, zMax], [1, 0, 0]);
    addQuad([xMin, yMin, zMax], [xMin, yMax, zMax], [xMin, yMax, zMin], [xMin, yMin, zMin], [-1, 0, 0]);
    addQuad([xMin, yMax, zMin], [xMin, yMax, zMax], [xMax, yMax, zMax], [xMax, yMax, zMin], [0, 1, 0]);
    addQuad([xMin, yMin, zMax], [xMin, yMin, zMin], [xMax, yMin, zMin], [xMax, yMin, zMax], [0, -1, 0]);
    addQuad([xMax, yMin, zMax], [xMax, yMax, zMax], [xMin, yMax, zMax], [xMin, yMin, zMax], [0, 0, 1]);
    addQuad([xMin, yMin, zMin], [xMin, yMax, zMin], [xMax, yMax, zMin], [xMax, yMin, zMin], [0, 0, -1]);
  };

  const [width, height, depth] = normalized.size;
  const wall = normalized.wallThickness;
  const floor = normalized.floorThickness;
  const wallHeight = Math.max(0.1, height - floor * 2);
  const sideDepth = Math.max(0.1, depth - wall * 2);
  const clearWidth = Math.max(0.1, width - wall * 2);
  const addPositiveBox = (boxSize: Vector3Tuple, center: Vector3Tuple) => {
    if (boxSize.every((value) => value > 0.001)) addBox(boxSize, center);
  };

  // Surface order and segment counts are stable and used by the viewport:
  // floor (1), ceiling (1), back (1), front/window wall (0 for glass curtain wall, otherwise 4),
  // left/door wall (3), right (1).
  addBox([width, floor, depth], [0, floor / 2, 0]);
  addBox([width, floor, depth], [0, height - floor / 2, 0]);
  addBox([width, wallHeight, wall], [0, height / 2, depth / 2 - wall / 2]);

  const windowXMin = normalized.window.offsetX - normalized.window.width / 2;
  const windowXMax = normalized.window.offsetX + normalized.window.width / 2;
  const windowYMin = floor + normalized.window.sillHeight;
  const windowYMax = windowYMin + normalized.window.height;
  const roomXMin = -clearWidth / 2;
  const roomXMax = clearWidth / 2;
  addPositiveBox([windowXMin - roomXMin, wallHeight, wall], [(roomXMin + windowXMin) / 2, height / 2, -depth / 2 + wall / 2]);
  addPositiveBox([roomXMax - windowXMax, wallHeight, wall], [(windowXMax + roomXMax) / 2, height / 2, -depth / 2 + wall / 2]);
  addPositiveBox([normalized.window.width, windowYMin - floor, wall], [normalized.window.offsetX, (floor + windowYMin) / 2, -depth / 2 + wall / 2]);
  addPositiveBox([normalized.window.width, height - floor - windowYMax, wall], [normalized.window.offsetX, (windowYMax + height - floor) / 2, -depth / 2 + wall / 2]);

  const doorZMin = normalized.door.offsetZ - normalized.door.width / 2;
  const doorZMax = normalized.door.offsetZ + normalized.door.width / 2;
  const roomZMin = -sideDepth / 2;
  const roomZMax = sideDepth / 2;
  addPositiveBox([wall, wallHeight, doorZMin - roomZMin], [-width / 2 + wall / 2, height / 2, (roomZMin + doorZMin) / 2]);
  addPositiveBox([wall, wallHeight, roomZMax - doorZMax], [-width / 2 + wall / 2, height / 2, (doorZMax + roomZMax) / 2]);
  addPositiveBox([wall, wallHeight - normalized.door.height, normalized.door.width], [-width / 2 + wall / 2, floor + normalized.door.height + (wallHeight - normalized.door.height) / 2, normalized.door.offsetZ]);

  addBox([wall, wallHeight, sideDepth], [width / 2 - wall / 2, height / 2, 0]);

  return {
    id,
    name,
    type: "mesh",
    operation: "add",
    position,
    rotation: origin,
    parameters: {
      positions,
      normals,
      indices,
      source: normalized,
    },
  };
}

export function regenerateProceduralMeshFeature(feature: MeshFeature, source: ProceduralMeshSource): MeshFeature {
  const normalized: ProceduralMeshSource = source.kind === "recessed-deck"
    ? (() => {
      const size = source.size.map((value) => Math.max(0.01, value)) as Vector3Tuple;
      const outlineRadius = Math.min(Math.max(0, source.outlineRadius), size[0] / 2, size[2] / 2);
      return {
        ...source,
        size,
        outlineRadius,
        edgeFilletRadius: Math.min(Math.max(0, source.edgeFilletRadius), size[1] / 2, outlineRadius),
        recesses: source.recesses.map((recess) => ({
          center: [...recess.center] as [number, number],
          size: [
            Math.min(Math.max(0.01, recess.size[0]), size[0]),
            Math.min(Math.max(0.01, recess.size[1]), size[2]),
          ],
          depth: Math.min(Math.max(0, recess.depth), size[1]),
        })),
      };
    })()
    : source.kind === "recessed-panel"
      ? (() => {
        const size = source.size.map((value) => Math.max(0.01, value)) as Vector3Tuple;
        const outlineRadius = Math.min(Math.max(0, source.outlineRadius), size[0] / 2, size[1] / 2);
        return {
          ...source,
          size,
          recessSize: [
            Math.min(Math.max(0.01, source.recessSize[0]), size[0]),
            Math.min(Math.max(0.01, source.recessSize[1]), size[1]),
            Math.min(Math.max(0, source.recessSize[2]), size[2]),
          ],
          outlineRadius,
          recessRadius: Math.min(Math.max(0, source.recessRadius), size[0] / 2, size[1] / 2),
          edgeFilletRadius: Math.min(Math.max(0, source.edgeFilletRadius), size[2] / 2, outlineRadius),
        };
      })()
      : normalizeRoomShellSource(source);
  const regenerated = normalized.kind === "recessed-deck"
    ? recessedLaptopDeck(
      feature.id,
      feature.name,
      normalized.size,
      feature.position,
      normalized.recesses,
      normalized.outlineRadius,
      normalized.edgeFilletRadius,
    )
    : normalized.kind === "recessed-panel"
      ? recessedRoundedPanel(
        feature.id,
        feature.name,
        normalized.size,
        normalized.recessSize,
        feature.position,
        feature.rotation,
        normalized.outlineRadius,
        normalized.recessRadius,
        normalized.edgeFilletRadius,
      )
      : proceduralRoomShell(
        feature.id,
        feature.name,
        feature.position,
        normalized,
      );
  return {
    ...feature,
    parameters: regenerated.parameters,
  };
}

function createDesk(): CreateModelInput {
  const surface = withFeatureAppearances([
    box("cyber-desk-top", "桌面", [1600, 34, 760], [0, 743, 0]),
    cylinder("cyber-desk-grommet-left", "左穿线孔", 34, 10, [-520, 765, 255]),
    cylinder("cyber-desk-grommet-right", "右穿线孔", 34, 10, [520, 765, 255]),
  ], { material: "wood", color: "#76513B" }, {
    "cyber-desk-grommet-left": { material: "metal", color: "#273137" },
    "cyber-desk-grommet-right": { material: "metal", color: "#273137" },
  });
  const frame = withFeatureAppearances([
    box("cyber-desk-leg-fl", "左前桌腿", [54, 720, 54], [-710, 360, -300]),
    box("cyber-desk-leg-fr", "右前桌腿", [54, 720, 54], [710, 360, -300]),
    box("cyber-desk-leg-bl", "左后桌腿", [54, 720, 54], [-710, 360, 300]),
    box("cyber-desk-leg-br", "右后桌腿", [54, 720, 54], [710, 360, 300]),
    box("cyber-desk-crossbar", "后横梁", [1420, 70, 42], [0, 590, 300]),
    box("cyber-desk-modesty", "挡板", [1120, 300, 20], [0, 445, 315]),
  ], { material: "metal", color: "#4B5960" }, {
    "cyber-desk-modesty": { material: "metal", color: "#5C686E" },
  });
  const accessories = withFeatureAppearances([
    box("cyber-desk-cable-tray", "线缆托盘", [1080, 70, 120], [0, 635, 240]),
    box("cyber-desk-control-rail", "控制导轨", [360, 42, 54], [420, 705, -350]),
    cylinder("cyber-desk-height-button", "升降按钮", 18, 22, [540, 704, -386], [90, 0, 0]),
  ], { material: "metal", color: "#38464D" }, {
    "cyber-desk-height-button": { material: "plastic", color: "#B7D83A" },
  });
  const features = [...surface, ...frame, ...accessories];
  return model("办公桌", "赛博工厂工作站使用的宽幅办公桌，包含穿线孔、线缆托盘和控制导轨。", features, [
    group("cyber-desk-surface", "桌面组件", surface),
    group("cyber-desk-frame", "支撑框架", frame),
    group("cyber-desk-accessories", "线缆管理", accessories),
  ]);
}

function createMonitor(): CreateModelInput {
  const display = withFeatureAppearances([
    box("cyber-monitor-shell", "显示器外壳", [670, 400, 34], [0, 500, 0]),
    box("cyber-monitor-panel", "显示面板", [628, 354, 8], [0, 500, 21]),
    box("cyber-monitor-camera", "顶部摄像头", [72, 24, 26], [0, 718, -8]),
    cylinder("cyber-monitor-camera-lens", "摄像头镜头", 8, 8, [0, 718, 25], [90, 0, 0]),
  ], { material: "plastic", color: "#263138" }, {
    "cyber-monitor-panel": { material: "glass", color: "#173A49" },
    "cyber-monitor-camera": { material: "plastic", color: "#151C20" },
    "cyber-monitor-camera-lens": { material: "glass", color: "#58BFD4" },
  });
  const stand = withFeatureAppearances([
    cylinder("cyber-monitor-hinge", "俯仰转轴", 38, 110, [0, 330, -8], [0, 0, 90]),
    box("cyber-monitor-neck", "升降支柱", [68, 270, 54], [0, 205, -34]),
    box("cyber-monitor-base", "稳定底座", [360, 22, 235], [0, 11, 45]),
    box("cyber-monitor-base-bevel", "底座前沿", [300, 18, 60], [0, 24, -70], [8, 0, 0]),
  ], { material: "metal", color: "#748188" });
  const accents = withFeatureAppearances([
    box("cyber-monitor-light-left", "左氛围灯", [10, 280, 12], [-314, 500, 19]),
    box("cyber-monitor-light-right", "右氛围灯", [10, 280, 12], [314, 500, 19]),
    cylinder("cyber-monitor-control", "控制旋钮", 16, 14, [260, 306, 25], [90, 0, 0]),
  ], { material: "plastic", color: "#71D7DE" }, {
    "cyber-monitor-control": { material: "metal", color: "#B5C0C5" },
  });
  const features = [...display, ...stand, ...accents];
  return model("电脑显示器", "带摄像头、升降支架和双侧氛围灯的赛博风显示器。", features, [
    group("cyber-monitor-display", "显示组件", display),
    group("cyber-monitor-stand", "显示器支架", stand),
    group("cyber-monitor-accents", "交互细节", accents),
  ]);
}

function createTower(): CreateModelInput {
  const chassis = withFeatureAppearances([
    box("cyber-tower-chassis", "机箱背板", [260, 504, 14], [0, 270, -228]),
    box("cyber-tower-bottom-frame", "底部框架", [260, 18, 470], [0, 9, 0]),
    box("cyber-tower-top-frame", "顶部框架", [260, 18, 470], [0, 531, 0]),
    box("cyber-tower-left-panel", "左侧板", [14, 504, 442], [-123, 270, 0]),
    box("cyber-tower-side-panel", "右侧玻璃面板", [8, 496, 438], [126, 270, 0]),
    box("cyber-tower-front-panel", "前置面板", [220, 470, 18], [0, 292, 244]),
  ], { material: "metal", color: "#354047" }, {
    "cyber-tower-side-panel": { material: "glass", color: "#5B8FA1" },
    "cyber-tower-front-panel": { material: "plastic", color: "#20282D" },
  });
  const rawCooling: ModelFeature[] = [-145, 0, 145].map((offset, index) => (
    cylinder(`cyber-tower-fan-${index + 1}`, `前置风扇 ${index + 1}`, 62, 12, [0, 292 + offset, 258], [90, 0, 0])
  ));
  rawCooling.push(
    cylinder("cyber-tower-rear-fan", "后置风扇", 54, 12, [0, 390, -241], [90, 0, 0]),
  );
  const cooling = withFeatureAppearances(rawCooling, { material: "plastic", color: "#34434B" });
  const controls = withFeatureAppearances([
    cylinder("cyber-tower-power", "电源按钮", 18, 14, [78, 510, 225], [90, 0, 0]),
  ], { material: "plastic", color: "#252E33" }, {
    "cyber-tower-power": { material: "plastic", color: "#C8E94B" },
  });
  const features = [...chassis, ...cooling, ...controls];
  return model("主机箱", "采用空心金属框架、右侧玻璃面板和三风扇散热的赛博工厂计算主机。", features, [
    group("cyber-tower-chassis-group", "机箱结构", chassis),
    group("cyber-tower-cooling", "散热系统", cooling),
    group("cyber-tower-controls", "控制组件", controls),
  ]);
}

function createLaptop(): CreateModelInput {
  // The screen's lower-front edge is anchored to the base's rear-right edge;
  // its thinner shell extends behind the deck instead of into it.
  const screenCenter: Vector3Tuple = [0, 135.42, -150.45];
  const screenRotation: Vector3Tuple = [-12, 0, 0];
  const screenPosition = (offset: Vector3Tuple) => offsetWithXRotation(screenCenter, offset, screenRotation[0]);
  const base = [
    withAppearance(
      recessedLaptopDeck(
        "cyber-laptop-base",
        "机身底座",
        [380, 9, 260],
        [0, 4.5, 10],
        [
          { center: [0, -35], size: [326, 122], depth: 2.2 },
          { center: [0, 90], size: [136, 70], depth: 2.2 },
        ],
        10,
        3.6,
      ),
      "metal",
      "#97A2AA",
    ),
    withAppearance(
      box("cyber-laptop-keyboard", "键盘面板", [320, 1.2, 116], [0, 7.7, -25], origin, { radius: 2, algorithm: "smooth" }),
      "plastic",
      "#30383D",
    ),
    withAppearance(
      box("cyber-laptop-trackpad", "触控板", [130, 1.2, 64], [0, 7.7, 100], origin, { radius: 2, algorithm: "smooth" }),
      "glass",
      "#5F7380",
    ),
  ];
  const screen = [
    withAppearance(
      recessedRoundedPanel(
        "cyber-laptop-screen-shell",
        "屏幕外壳",
        [380, 260, 7],
        [370, 250, 3],
        screenCenter,
        screenRotation,
        6,
        3,
        3,
      ),
      "metal",
      "#87949E",
    ),
    withAppearance(
      box("cyber-laptop-screen-panel", "显示屏", [368, 248, 1], screenPosition([0, 0, 1]), screenRotation, { radius: 0.5, algorithm: "smooth" }),
      "glass",
      "#102A38",
    ),
    withAppearance(
      box("cyber-laptop-camera", "屏幕摄像头", [18, 3.5, 0.6], screenPosition([0, 127.25, 1.8]), screenRotation, { radius: 0.3, algorithm: "circular" }),
      "plastic",
      "#11171B",
    ),
  ];
  const features = [...base, ...screen];
  const laptop = model("笔记本", "带可调屏幕转轴的轻薄赛博笔记本，包含内嵌简化键盘、前置触控板和窄边框内嵌显示屏。", features, [
    group("cyber-laptop-base-group", "键盘底座", base),
    group("cyber-laptop-screen-group", "屏幕组件", screen),
  ]);
  laptop.featureGraph!.joints = [{
    id: "cyber-laptop-screen-hinge",
    name: "屏幕转轴",
    type: "revolute",
    groupId: "cyber-laptop-screen-group",
    pivot: [0, 9, -120],
    axis: [-1, 0, 0],
    value: 102,
    restValue: 102,
    min: 0,
    max: 135,
  }];
  return laptop;
}

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

function createRoom(): CreateModelInput {
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

function createChair(): CreateModelInput {
  const base = withFeatureAppearances([
    cylinder("cyber-chair-column", "升降气杆", 38, 420, [0, 275, 0]),
    cylinder("cyber-chair-hub", "五星脚中心", 86, 55, [0, 72, 0]),
    ...[0, 72, 144, 216, 288].flatMap((angle, index) => {
      const radians = angle * Math.PI / 180;
      const x = Math.cos(radians) * 150;
      const z = Math.sin(radians) * 150;
      const wheelX = Math.cos(radians) * 305;
      const wheelZ = Math.sin(radians) * 305;
      return [
        box(`cyber-chair-leg-${index + 1}`, `五星脚 ${index + 1}`, [330, 34, 54], [x, 68, z], [0, -angle, 0]),
        cylinder(`cyber-chair-wheel-${index + 1}`, `脚轮 ${index + 1}`, 38, 28, [wheelX, 38, wheelZ], [90, 0, angle]),
      ];
    }),
  ], { material: "metal", color: "#657279" }, Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => [
      `cyber-chair-wheel-${index + 1}`,
      { material: "rubber", color: "#262C2F" } satisfies AppearanceDefinition,
    ]),
  ));
  const seat = withFeatureAppearances([
    box("cyber-chair-seat", "坐垫", [520, 78, 480], [0, 525, -5], [-4, 0, 0]),
    box("cyber-chair-seat-front", "瀑布前沿", [480, 92, 90], [0, 510, 220], [8, 0, 0]),
    box("cyber-chair-back", "人体工学靠背", [500, 650, 74], [0, 875, -205], [-8, 0, 0]),
    box("cyber-chair-lumbar", "腰部支撑", [380, 125, 54], [0, 760, -155], [-8, 0, 0]),
    box("cyber-chair-headrest", "头枕", [330, 135, 68], [0, 1235, -250], [-10, 0, 0]),
  ], { material: "fabric", color: "#627780" }, {
    "cyber-chair-seat": { material: "fabric", color: "#71868E" },
    "cyber-chair-seat-front": { material: "fabric", color: "#71868E" },
    "cyber-chair-lumbar": { material: "fabric", color: "#82969D" },
  });
  const arms = withFeatureAppearances([
    box("cyber-chair-arm-post-left", "左扶手立柱", [42, 280, 42], [-310, 690, -5]),
    box("cyber-chair-arm-post-right", "右扶手立柱", [42, 280, 42], [310, 690, -5]),
    box("cyber-chair-arm-left", "左扶手", [92, 42, 330], [-310, 835, -45]),
    box("cyber-chair-arm-right", "右扶手", [92, 42, 330], [310, 835, -45]),
    cylinder("cyber-chair-recline", "后仰调节旋钮", 44, 36, [292, 520, -130], [0, 0, 90]),
  ], { material: "plastic", color: "#37444A" }, {
    "cyber-chair-arm-post-left": { material: "metal", color: "#66757B" },
    "cyber-chair-arm-post-right": { material: "metal", color: "#66757B" },
    "cyber-chair-recline": { material: "plastic", color: "#AECF42" },
  });
  const features = [...base, ...seat, ...arms];
  return model("简易人体工学椅", "带五星脚、腰托、头枕和可调扶手的简易人体工学椅。", features, [
    group("cyber-chair-base-group", "移动底座", base),
    group("cyber-chair-seat-group", "坐垫与靠背", seat),
    group("cyber-chair-arm-group", "扶手与调节", arms),
  ]);
}

function createFigure(): CreateModelInput {
  const body = withFeatureAppearances([
    sphere("cyber-figure-head", "头部", 110, [0, 1660, 0]),
    cylinder("cyber-figure-torso", "躯干中轴", 30, 560, [0, 1280, 0]),
  ], { material: "plastic", color: "#A9B9B5" }, {
    "cyber-figure-head": { material: "plastic", color: "#C1CDC9" },
  });
  const leftShoulder = withFeatureAppearances([
    cylinder("cyber-figure-upper-arm-left", "左上臂", 26, 320, [-82.5, 1342, 0], [0, 0, -31]),
  ], { material: "metal", color: "#8EA3A3" });
  const rightShoulder = withFeatureAppearances([
    cylinder("cyber-figure-upper-arm-right", "右上臂", 26, 320, [82.5, 1342, 0], [0, 0, 31]),
  ], { material: "metal", color: "#8EA3A3" });
  const leftHip = withFeatureAppearances([
    cylinder("cyber-figure-upper-leg-left", "左大腿", 30, 475, [-38.75, 764, 0], [0, 0, -10]),
  ], { material: "metal", color: "#8EA3A3" });
  const rightHip = withFeatureAppearances([
    cylinder("cyber-figure-upper-leg-right", "右大腿", 30, 475, [38.75, 764, 0], [0, 0, 10]),
  ], { material: "metal", color: "#8EA3A3" });
  const leftElbow = withFeatureAppearances([
    cylinder("cyber-figure-forearm-left", "左前臂", 26, 320, [-247.5, 1068, 0], [0, 0, -31]),
    sphere("cyber-figure-hand-left", "左手", 48, [-330, 931, 0]),
  ], { material: "metal", color: "#8EA3A3" });
  const rightElbow = withFeatureAppearances([
    cylinder("cyber-figure-forearm-right", "右前臂", 26, 320, [247.5, 1068, 0], [0, 0, 31]),
    sphere("cyber-figure-hand-right", "右手", 48, [330, 931, 0]),
  ], { material: "metal", color: "#8EA3A3" });
  const leftKnee = withFeatureAppearances([
    cylinder("cyber-figure-lower-leg-left", "左小腿", 30, 475, [-121.25, 296, 0], [0, 0, -10]),
    ellipsoid("cyber-figure-foot-left", "左脚", [78, 42, 138], [-162, 50, 55]),
  ], { material: "metal", color: "#8EA3A3" });
  const rightKnee = withFeatureAppearances([
    cylinder("cyber-figure-lower-leg-right", "右小腿", 30, 475, [121.25, 296, 0], [0, 0, 10]),
    ellipsoid("cyber-figure-foot-right", "右脚", [78, 42, 138], [162, 50, 55]),
  ], { material: "metal", color: "#8EA3A3" });
  const features = [...body, ...leftShoulder, ...rightShoulder, ...leftHip, ...rightHip, ...leftElbow, ...rightElbow, ...leftKnee, ...rightKnee];
  const figure = model("极简风小人", "由球形头部、躯干中轴、可弯曲四肢和圆润端点构成的关节火柴人，用于空间尺度、姿态和场景角色参考。", features, [
    group("cyber-figure-body-group", "身体中轴", body),
    group("cyber-figure-left-shoulder-group", "左肩以下", leftShoulder),
    group("cyber-figure-right-shoulder-group", "右肩以下", rightShoulder),
    group("cyber-figure-left-elbow-group", "左肘以下", leftElbow),
    group("cyber-figure-right-elbow-group", "右肘以下", rightElbow),
    group("cyber-figure-left-hip-group", "左髋以下", leftHip),
    group("cyber-figure-right-hip-group", "右髋以下", rightHip),
    group("cyber-figure-left-knee-group", "左膝以下", leftKnee),
    group("cyber-figure-right-knee-group", "右膝以下", rightKnee),
  ]);
  figure.featureGraph!.joints = [
    { id: "cyber-figure-left-shoulder", name: "左肩", type: "revolute", groupId: "cyber-figure-left-shoulder-group", pivot: [0, 1479, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -130, max: 65 },
    { id: "cyber-figure-right-shoulder", name: "右肩", type: "revolute", groupId: "cyber-figure-right-shoulder-group", pivot: [0, 1479, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -130, max: 65 },
    { id: "cyber-figure-left-elbow", name: "左手肘", type: "revolute", groupId: "cyber-figure-left-elbow-group", parentJointId: "cyber-figure-left-shoulder", pivot: [-165, 1205, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -135, max: 25 },
    { id: "cyber-figure-right-elbow", name: "右手肘", type: "revolute", groupId: "cyber-figure-right-elbow-group", parentJointId: "cyber-figure-right-shoulder", pivot: [165, 1205, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -135, max: 25 },
    { id: "cyber-figure-left-hip", name: "左髋", type: "revolute", groupId: "cyber-figure-left-hip-group", pivot: [0, 998, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -65, max: 45 },
    { id: "cyber-figure-right-hip", name: "右髋", type: "revolute", groupId: "cyber-figure-right-hip-group", pivot: [0, 998, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -65, max: 45 },
    { id: "cyber-figure-left-knee", name: "左膝", type: "revolute", groupId: "cyber-figure-left-knee-group", parentJointId: "cyber-figure-left-hip", pivot: [-80, 530, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: 0, max: 120 },
    { id: "cyber-figure-right-knee", name: "右膝", type: "revolute", groupId: "cyber-figure-right-knee-group", parentJointId: "cyber-figure-right-hip", pivot: [80, 530, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: 0, max: 120 },
  ];
  figure.featureGraph!.poses = [
    { id: "cyber-figure-pose-stand", name: "站立", durationMs: 650, jointValues: { "cyber-figure-left-shoulder": 0, "cyber-figure-right-shoulder": 0, "cyber-figure-left-elbow": 0, "cyber-figure-right-elbow": 0, "cyber-figure-left-hip": 0, "cyber-figure-right-hip": 0, "cyber-figure-left-knee": 0, "cyber-figure-right-knee": 0 } },
    { id: "cyber-figure-pose-wave", name: "招手", durationMs: 720, jointValues: { "cyber-figure-left-shoulder": -118, "cyber-figure-right-shoulder": 0, "cyber-figure-left-elbow": -72, "cyber-figure-right-elbow": 0, "cyber-figure-left-hip": 0, "cyber-figure-right-hip": 0, "cyber-figure-left-knee": 0, "cyber-figure-right-knee": 0 } },
    { id: "cyber-figure-pose-crouch", name: "屈膝", durationMs: 820, jointValues: { "cyber-figure-left-shoulder": -18, "cyber-figure-right-shoulder": -18, "cyber-figure-left-elbow": -28, "cyber-figure-right-elbow": -28, "cyber-figure-left-hip": -20, "cyber-figure-right-hip": -20, "cyber-figure-left-knee": 72, "cyber-figure-right-knee": 72 } },
  ];
  figure.featureGraph!.animations = [
    {
      id: "cyber-figure-animation-walk",
      name: "走路",
      durationMs: 1_080,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "cyber-figure-left-shoulder": 24, "cyber-figure-right-shoulder": -26, "cyber-figure-left-elbow": -14, "cyber-figure-right-elbow": -20, "cyber-figure-left-hip": -28, "cyber-figure-right-hip": 22, "cyber-figure-left-knee": 6, "cyber-figure-right-knee": 18 } },
        { offset: 0.25, jointValues: { "cyber-figure-left-shoulder": 2, "cyber-figure-right-shoulder": -4, "cyber-figure-left-elbow": -18, "cyber-figure-right-elbow": -24, "cyber-figure-left-hip": 5, "cyber-figure-right-hip": -8, "cyber-figure-left-knee": 10, "cyber-figure-right-knee": 58 } },
        { offset: 0.5, jointValues: { "cyber-figure-left-shoulder": -26, "cyber-figure-right-shoulder": 24, "cyber-figure-left-elbow": -20, "cyber-figure-right-elbow": -14, "cyber-figure-left-hip": 22, "cyber-figure-right-hip": -28, "cyber-figure-left-knee": 18, "cyber-figure-right-knee": 6 } },
        { offset: 0.75, jointValues: { "cyber-figure-left-shoulder": -4, "cyber-figure-right-shoulder": 2, "cyber-figure-left-elbow": -24, "cyber-figure-right-elbow": -18, "cyber-figure-left-hip": -8, "cyber-figure-right-hip": 5, "cyber-figure-left-knee": 58, "cyber-figure-right-knee": 10 } },
        { offset: 1, jointValues: { "cyber-figure-left-shoulder": 24, "cyber-figure-right-shoulder": -26, "cyber-figure-left-elbow": -14, "cyber-figure-right-elbow": -20, "cyber-figure-left-hip": -28, "cyber-figure-right-hip": 22, "cyber-figure-left-knee": 6, "cyber-figure-right-knee": 18 } },
      ],
    },
    {
      id: "cyber-figure-animation-run",
      name: "奔跑",
      durationMs: 640,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "cyber-figure-left-shoulder": 38, "cyber-figure-right-shoulder": -46, "cyber-figure-left-elbow": -58, "cyber-figure-right-elbow": -72, "cyber-figure-left-hip": -46, "cyber-figure-right-hip": 32, "cyber-figure-left-knee": 12, "cyber-figure-right-knee": 68 } },
        { offset: 0.25, jointValues: { "cyber-figure-left-shoulder": 4, "cyber-figure-right-shoulder": -8, "cyber-figure-left-elbow": -64, "cyber-figure-right-elbow": -78, "cyber-figure-left-hip": 8, "cyber-figure-right-hip": -24, "cyber-figure-left-knee": 42, "cyber-figure-right-knee": 96 } },
        { offset: 0.5, jointValues: { "cyber-figure-left-shoulder": -46, "cyber-figure-right-shoulder": 38, "cyber-figure-left-elbow": -72, "cyber-figure-right-elbow": -58, "cyber-figure-left-hip": 32, "cyber-figure-right-hip": -46, "cyber-figure-left-knee": 68, "cyber-figure-right-knee": 12 } },
        { offset: 0.75, jointValues: { "cyber-figure-left-shoulder": -8, "cyber-figure-right-shoulder": 4, "cyber-figure-left-elbow": -78, "cyber-figure-right-elbow": -64, "cyber-figure-left-hip": -24, "cyber-figure-right-hip": 8, "cyber-figure-left-knee": 96, "cyber-figure-right-knee": 42 } },
        { offset: 1, jointValues: { "cyber-figure-left-shoulder": 38, "cyber-figure-right-shoulder": -46, "cyber-figure-left-elbow": -58, "cyber-figure-right-elbow": -72, "cyber-figure-left-hip": -46, "cyber-figure-right-hip": 32, "cyber-figure-left-knee": 12, "cyber-figure-right-knee": 68 } },
      ],
    },
  ];
  figure.featureGraph!.locomotion = {
    id: "cyber-figure-locomotion",
    name: "移动速度",
    walkAnimationId: "cyber-figure-animation-walk",
    runAnimationId: "cyber-figure-animation-run",
    defaultSpeed: 0,
    minimumSpeed: 0,
    maximumSpeed: 5,
    walkReferenceSpeed: 1.4,
    runReferenceSpeed: 3.6,
    transitionStartSpeed: 1.7,
    transitionEndSpeed: 2.7,
    transitionDurationMs: 420,
  };
  return figure;
}

function createBlockAvatar(): CreateModelInput {
  const pixel = 56.25;
  const skinUrl = "builtin:solidloom-block-avatar";
  const skinnedBox = (
    id: string,
    name: string,
    size: Vector3Tuple,
    position: Vector3Tuple,
    part: NonNullable<NonNullable<ModelFeature["appearance"]>["voxelSkin"]>["part"],
    segment?: NonNullable<NonNullable<ModelFeature["appearance"]>["voxelSkin"]>["segment"],
  ): BoxFeature => {
    const fallbackAppearance: Record<typeof part, AppearanceDefinition> = {
      head: { color: "#C98F68", material: "plastic" },
      torso: { color: "#2E8D9D", material: "fabric" },
      leftArm: { color: "#2E8D9D", material: "fabric" },
      rightArm: { color: "#2E8D9D", material: "fabric" },
      leftLeg: { color: "#273A68", material: "fabric" },
      rightLeg: { color: "#273A68", material: "fabric" },
    };
    return {
      ...box(id, name, size, position),
      appearance: {
        ...fallbackAppearance[part],
        voxelSkin: {
          model: "classic",
          part,
          ...(segment ? { segment } : {}),
          url: skinUrl,
        },
      },
    };
  };

  const head = [skinnedBox(
    "block-avatar-head",
    "头部",
    [8 * pixel, 8 * pixel, 8 * pixel],
    [0, 28 * pixel, 0],
    "head",
  )];
  const torso = [skinnedBox(
    "block-avatar-torso",
    "躯干",
    [8 * pixel, 12 * pixel, 4 * pixel],
    [0, 18 * pixel, 0],
    "torso",
  )];
  const leftArm = [skinnedBox(
    "block-avatar-left-arm",
    "左臂",
    [4 * pixel, 12 * pixel, 4 * pixel],
    [-6 * pixel, 18 * pixel, 0],
    "leftArm",
  )];
  const rightArm = [skinnedBox(
    "block-avatar-right-arm",
    "右臂",
    [4 * pixel, 12 * pixel, 4 * pixel],
    [6 * pixel, 18 * pixel, 0],
    "rightArm",
  )];
  const leftUpperLeg = [skinnedBox(
    "block-avatar-left-upper-leg",
    "左大腿",
    [4 * pixel, 6 * pixel, 4 * pixel],
    [-2 * pixel, 9 * pixel, 0],
    "leftLeg",
    "upper",
  )];
  const leftLowerLeg = [skinnedBox(
    "block-avatar-left-lower-leg",
    "左小腿",
    [4 * pixel, 6 * pixel, 4 * pixel],
    [-2 * pixel, 3 * pixel, 0],
    "leftLeg",
    "lower",
  )];
  const rightUpperLeg = [skinnedBox(
    "block-avatar-right-upper-leg",
    "右大腿",
    [4 * pixel, 6 * pixel, 4 * pixel],
    [2 * pixel, 9 * pixel, 0],
    "rightLeg",
    "upper",
  )];
  const rightLowerLeg = [skinnedBox(
    "block-avatar-right-lower-leg",
    "右小腿",
    [4 * pixel, 6 * pixel, 4 * pixel],
    [2 * pixel, 3 * pixel, 0],
    "rightLeg",
    "lower",
  )];
  const features = [
    ...head,
    ...torso,
    ...leftArm,
    ...rightArm,
    ...leftUpperLeg,
    ...leftLowerLeg,
    ...rightUpperLeg,
    ...rightLowerLeg,
  ];
  const avatar = model(
    "原创方块角色",
    "兼容通用 64×64 像素皮肤布局的原创方块角色，支持 Classic、Slim 手臂、用户本地 PNG 皮肤和关节动画。",
    features,
    [
      group("block-avatar-head-group", "头部", head),
      group("block-avatar-torso-group", "躯干", torso),
      group("block-avatar-left-arm-group", "左臂", leftArm),
      group("block-avatar-right-arm-group", "右臂", rightArm),
      group("block-avatar-left-upper-leg-group", "左大腿", leftUpperLeg),
      group("block-avatar-left-lower-leg-group", "左小腿", leftLowerLeg),
      group("block-avatar-right-upper-leg-group", "右大腿", rightUpperLeg),
      group("block-avatar-right-lower-leg-group", "右小腿", rightLowerLeg),
    ],
  );
  avatar.featureGraph!.joints = [
    { id: "block-avatar-torso-joint", name: "躯干", type: "revolute", groupId: "block-avatar-torso-group", pivot: [0, 12 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -35, max: 35 },
    { id: "block-avatar-head-joint", name: "颈部", type: "revolute", groupId: "block-avatar-head-group", parentJointId: "block-avatar-torso-joint", pivot: [0, 24 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -45, max: 45 },
    { id: "block-avatar-left-arm-joint", name: "左肩", type: "revolute", groupId: "block-avatar-left-arm-group", parentJointId: "block-avatar-torso-joint", pivot: [-4 * pixel, 24 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -160, max: 160 },
    { id: "block-avatar-right-arm-joint", name: "右肩", type: "revolute", groupId: "block-avatar-right-arm-group", parentJointId: "block-avatar-torso-joint", pivot: [4 * pixel, 24 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -160, max: 160 },
    { id: "block-avatar-left-leg-joint", name: "左髋", type: "revolute", groupId: "block-avatar-left-upper-leg-group", pivot: [-2 * pixel, 12 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -120, max: 120 },
    { id: "block-avatar-left-knee-joint", name: "左膝", type: "revolute", groupId: "block-avatar-left-lower-leg-group", parentJointId: "block-avatar-left-leg-joint", pivot: [-2 * pixel, 6 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: 0, max: 120 },
    { id: "block-avatar-right-leg-joint", name: "右髋", type: "revolute", groupId: "block-avatar-right-upper-leg-group", pivot: [2 * pixel, 12 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: -120, max: 120 },
    { id: "block-avatar-right-knee-joint", name: "右膝", type: "revolute", groupId: "block-avatar-right-lower-leg-group", parentJointId: "block-avatar-right-leg-joint", pivot: [2 * pixel, 6 * pixel, 0], axis: [1, 0, 0], value: 0, restValue: 0, min: 0, max: 120 },
  ];
  avatar.featureGraph!.poses = [
    { id: "block-avatar-pose-stand", name: "站立", durationMs: 420, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 0, "block-avatar-right-arm-joint": 0, "block-avatar-left-leg-joint": 0, "block-avatar-left-knee-joint": 0, "block-avatar-right-leg-joint": 0, "block-avatar-right-knee-joint": 0 } },
    { id: "block-avatar-pose-wave", name: "招手", durationMs: 520, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": -8, "block-avatar-left-arm-joint": -145, "block-avatar-right-arm-joint": 0, "block-avatar-left-leg-joint": 0, "block-avatar-left-knee-joint": 0, "block-avatar-right-leg-joint": 0, "block-avatar-right-knee-joint": 0 } },
    { id: "block-avatar-pose-sneak", name: "潜行", durationMs: 460, jointValues: { "block-avatar-torso-joint": 24, "block-avatar-head-joint": -18, "block-avatar-left-arm-joint": 12, "block-avatar-right-arm-joint": -12, "block-avatar-left-leg-joint": -30, "block-avatar-left-knee-joint": 48, "block-avatar-right-leg-joint": -30, "block-avatar-right-knee-joint": 48 } },
    { id: "block-avatar-pose-sit", name: "坐下", durationMs: 620, jointValues: { "block-avatar-torso-joint": 4, "block-avatar-head-joint": -4, "block-avatar-left-arm-joint": -8, "block-avatar-right-arm-joint": -8, "block-avatar-left-leg-joint": -90, "block-avatar-left-knee-joint": 90, "block-avatar-right-leg-joint": -90, "block-avatar-right-knee-joint": 90 } },
  ];
  avatar.featureGraph!.animations = [
    {
      id: "block-avatar-animation-walk",
      name: "走路",
      durationMs: 920,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 32, "block-avatar-right-arm-joint": -32, "block-avatar-left-leg-joint": -34, "block-avatar-left-knee-joint": 10, "block-avatar-right-leg-joint": 34, "block-avatar-right-knee-joint": 38 } },
        { offset: 0.5, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": -32, "block-avatar-right-arm-joint": 32, "block-avatar-left-leg-joint": 34, "block-avatar-left-knee-joint": 38, "block-avatar-right-leg-joint": -34, "block-avatar-right-knee-joint": 10 } },
        { offset: 1, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 32, "block-avatar-right-arm-joint": -32, "block-avatar-left-leg-joint": -34, "block-avatar-left-knee-joint": 10, "block-avatar-right-leg-joint": 34, "block-avatar-right-knee-joint": 38 } },
      ],
    },
    {
      id: "block-avatar-animation-run",
      name: "奔跑",
      durationMs: 560,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 55, "block-avatar-right-arm-joint": -55, "block-avatar-left-leg-joint": -58, "block-avatar-left-knee-joint": 18, "block-avatar-right-leg-joint": 58, "block-avatar-right-knee-joint": 66 } },
        { offset: 0.5, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": -55, "block-avatar-right-arm-joint": 55, "block-avatar-left-leg-joint": 58, "block-avatar-left-knee-joint": 66, "block-avatar-right-leg-joint": -58, "block-avatar-right-knee-joint": 18 } },
        { offset: 1, jointValues: { "block-avatar-torso-joint": 0, "block-avatar-head-joint": 0, "block-avatar-left-arm-joint": 55, "block-avatar-right-arm-joint": -55, "block-avatar-left-leg-joint": -58, "block-avatar-left-knee-joint": 18, "block-avatar-right-leg-joint": 58, "block-avatar-right-knee-joint": 66 } },
      ],
    },
    {
      id: "block-avatar-animation-sneak",
      name: "潜行移动",
      durationMs: 1_180,
      loop: true,
      keyframes: [
        { offset: 0, jointValues: { "block-avatar-torso-joint": 24, "block-avatar-head-joint": -18, "block-avatar-left-arm-joint": 12, "block-avatar-right-arm-joint": -12, "block-avatar-left-leg-joint": -36, "block-avatar-left-knee-joint": 54, "block-avatar-right-leg-joint": -26, "block-avatar-right-knee-joint": 42 } },
        { offset: 0.5, jointValues: { "block-avatar-torso-joint": 24, "block-avatar-head-joint": -18, "block-avatar-left-arm-joint": -12, "block-avatar-right-arm-joint": 12, "block-avatar-left-leg-joint": -26, "block-avatar-left-knee-joint": 42, "block-avatar-right-leg-joint": -36, "block-avatar-right-knee-joint": 54 } },
        { offset: 1, jointValues: { "block-avatar-torso-joint": 24, "block-avatar-head-joint": -18, "block-avatar-left-arm-joint": 12, "block-avatar-right-arm-joint": -12, "block-avatar-left-leg-joint": -36, "block-avatar-left-knee-joint": 54, "block-avatar-right-leg-joint": -26, "block-avatar-right-knee-joint": 42 } },
      ],
    },
  ];
  avatar.featureGraph!.locomotion = {
    id: "block-avatar-locomotion",
    name: "移动速度",
    walkAnimationId: "block-avatar-animation-walk",
    runAnimationId: "block-avatar-animation-run",
    defaultSpeed: 0,
    minimumSpeed: 0,
    maximumSpeed: 5,
    walkReferenceSpeed: 1.4,
    runReferenceSpeed: 3.6,
    transitionStartSpeed: 1.7,
    transitionEndSpeed: 2.7,
    transitionDurationMs: 420,
  };
  return avatar;
}

export const cyberFactoryModels: CreateModelInput[] = [
  createDesk(),
  createMonitor(),
  createTower(),
  createLaptop(),
  createRoom(),
  createChair(),
  createFigure(),
  createBlockAvatar(),
];

export interface CyberOfficeSpaceModelIds {
  roomId: string;
  deskId: string;
  monitorId: string;
  laptopId: string;
  chairId: string;
}

export function createCyberOfficeSpaceModel(ids: CyberOfficeSpaceModelIds): CreateModelInput {
  const floorThickness = 160;
  const finishedFloorY = 0;
  const deskSurfaceY = finishedFloorY + 760;
  const laptopClearance = 10;
  const stationCount = 4;
  const deskScale: Vector3Tuple = [1.25, 1, 1.1];
  const connectedDeskWidth = 2000;
  const connectedDeskDepth = 836;
  const stationVariations = [
    { laptopX: -185, laptopZ: 32, laptopYaw: -9, laptopAngle: 0, chairX: 105, chairZ: 55, chairYaw: -13, monitorXs: [-30], monitorYaw: 4 },
    { laptopX: 150, laptopZ: -18, laptopYaw: 7, laptopAngle: 78, chairX: -75, chairZ: -35, chairYaw: 10, monitorXs: [-390, 350], monitorYaw: -2 },
    { laptopX: -95, laptopZ: 44, laptopYaw: -5, laptopAngle: 112, chairX: 135, chairZ: -60, chairYaw: -8, monitorXs: [145], monitorYaw: -5 },
    { laptopX: 205, laptopZ: 8, laptopYaw: 11, laptopAngle: 94, chairX: -120, chairZ: 72, chairYaw: 15, monitorXs: [-335, 405], monitorYaw: 3 },
    { laptopX: 175, laptopZ: -38, laptopYaw: -10, laptopAngle: 0, chairX: -95, chairZ: 48, chairYaw: 12, monitorXs: [-120], monitorYaw: 5 },
    { laptopX: -145, laptopZ: 24, laptopYaw: 6, laptopAngle: 126, chairX: 125, chairZ: -75, chairYaw: -14, monitorXs: [-410, 330], monitorYaw: -3 },
    { laptopX: 75, laptopZ: -46, laptopYaw: -7, laptopAngle: 68, chairX: -145, chairZ: 30, chairYaw: 9, monitorXs: [110], monitorYaw: 6 },
    { laptopX: -210, laptopZ: 15, laptopYaw: 9, laptopAngle: 104, chairX: 80, chairZ: 68, chairYaw: -11, monitorXs: [-360, 385], monitorYaw: 2 },
  ] as const;
  const rowReferences = [
    {
      rowNumber: 1,
      deskZ: connectedDeskDepth / 2,
      deskRotation: [0, 180, 0] as Vector3Tuple,
      laptopZOffset: 170,
      laptopRotation: [0, 0, 0] as Vector3Tuple,
      chairZOffset: 1070,
      chairRotation: [0, 180, 0] as Vector3Tuple,
    },
    {
      rowNumber: 2,
      deskZ: -connectedDeskDepth / 2,
      deskRotation: [0, 0, 0] as Vector3Tuple,
      laptopZOffset: -170,
      laptopRotation: [0, 180, 0] as Vector3Tuple,
      chairZOffset: -1070,
      chairRotation: [0, 0, 0] as Vector3Tuple,
    },
  ];
  const stationReferences = rowReferences.flatMap((row) => (
    Array.from({ length: stationCount }, (_, index): ModelReferenceInstance[] => {
      const stationNumber = index + 1;
      const centerX = (index - (stationCount - 1) / 2) * connectedDeskWidth;
      const instanceSuffix = `${row.rowNumber}-${stationNumber}`;
      const displayPrefix = `第 ${row.rowNumber} 排 · 工位 ${stationNumber}`;
      const variation = stationVariations[(row.rowNumber - 1) * stationCount + index]!;
      const rowFacingSign = row.rowNumber === 1 ? 1 : -1;
      const monitorReferences: ModelReferenceInstance[] = variation.monitorXs.map((monitorX, monitorIndex) => {
        const inwardYaw = variation.monitorXs.length === 1
          ? variation.monitorYaw
          : (monitorX < 0 ? 7 : -7) * rowFacingSign + variation.monitorYaw;
        return {
          id: `cyber-office-monitor-${instanceSuffix}-${monitorIndex + 1}-reference`,
          name: `${displayPrefix} · 显示器 ${monitorIndex + 1}`,
          modelId: ids.monitorId,
          position: [
            centerX + monitorX,
            deskSurfaceY,
            row.deskZ - rowFacingSign * (145 + monitorIndex * 16),
          ],
          rotation: [0, row.laptopRotation[1] + inwardYaw, 0],
          scale: [0.88, 0.88, 0.88],
          interactions: [{
            id: "display-power",
            kind: "power",
            range: 1350,
            targetFeatureIds: ["cyber-monitor-panel", "cyber-monitor-light-left", "cyber-monitor-light-right"],
          }],
        };
      });
      return [
        {
          id: `cyber-office-desk-${instanceSuffix}-reference`,
          name: `${displayPrefix} · 办公桌`,
          modelId: ids.deskId,
          position: [centerX, finishedFloorY, row.deskZ],
          rotation: row.deskRotation,
          scale: deskScale,
        },
        {
          id: `cyber-office-laptop-${instanceSuffix}-reference`,
          name: `${displayPrefix} · 笔记本`,
          modelId: ids.laptopId,
          position: [
            centerX + variation.laptopX,
            deskSurfaceY + laptopClearance,
            row.deskZ + row.laptopZOffset + variation.laptopZ,
          ],
          rotation: [0, row.laptopRotation[1] + variation.laptopYaw, 0],
          scale: [1, 1, 1],
          jointValues: { "cyber-laptop-screen-hinge": variation.laptopAngle },
          interactions: [{
            id: "computer-power",
            kind: "articulation",
            range: 1050,
            targetFeatureIds: [
              "cyber-laptop-screen-shell",
              "cyber-laptop-screen-panel",
              "cyber-laptop-camera",
            ],
            jointId: "cyber-laptop-screen-hinge",
            closedValue: 0,
            openValue: 102,
          }],
        },
        ...monitorReferences,
        {
          id: `cyber-office-chair-${instanceSuffix}-reference`,
          name: `${displayPrefix} · 人体工学椅`,
          modelId: ids.chairId,
          position: [
            centerX + variation.chairX,
            finishedFloorY,
            row.deskZ + row.chairZOffset + variation.chairZ,
          ],
          rotation: [0, row.chairRotation[1] + variation.chairYaw, 0],
          scale: [1, 1, 1],
          physics: {
            bodyType: "dynamic",
            mass: 16,
            friction: 0.42,
            linearDamping: 2.8,
          },
          interactions: [{
            id: "seat",
            kind: "seat",
            range: 680,
            targetFeatureIds: ["cyber-chair-seat"],
          }],
        },
      ];
    }).flat()
  ));
  const references: ModelReferenceInstance[] = [{
    id: "cyber-office-room-reference",
    name: "房间 · 引用",
    modelId: ids.roomId,
    position: [0, -floorThickness, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    roomSurfaceMode: "interior",
    interactions: [{
      id: "door",
      kind: "door",
      range: 920,
      targetFeatureIds: ["cyber-room-door", "cyber-room-door-handle"],
      openAngle: 88,
    }],
  }, ...stationReferences];
  return {
    name: "赛博办公空间",
    description: "通过实时模型引用组成的两排八工位办公空间；连续桌面上的笔记本、显示器和椅子采用可复现的自然错落布局，并始终使用源模型的最新修订。",
    unit: "mm",
    featureGraph: {
      version: 1,
      features: [],
      groups: [],
      references,
      navigation: {
        enabled: true,
        floorY: 0,
        bounds: [-4680, 4680, -2880, 2880],
        cellSize: 160,
        agentRadius: 260,
        agentHeight: 1720,
        start: [-3900, 2100],
      },
    },
  };
}
