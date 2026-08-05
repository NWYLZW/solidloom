import type { MeshFeature, RoomShellSource, Vector3Tuple } from "../../types.js";
import { origin } from "./primitives.js";

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

export { normalizeRoomShellSource, proceduralRoomShell };
