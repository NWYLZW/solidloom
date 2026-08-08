import type { NavigationSurface } from "@solidloom/shared";

export type NavigationPoint = [number, number];
export interface NavigationObstacle {
  minX: number;
  maxX: number;
  minY?: number;
  maxY?: number;
  minZ: number;
  maxZ: number;
}

const NAVIGATION_VERTICAL_EPSILON = 1;

export function navigationObstacleBlocksHeight(
  obstacle: NavigationObstacle,
  agentBottomY: number,
  agentHeight: number,
) {
  if (obstacle.minY === undefined || obstacle.maxY === undefined) return true;
  const agentTopY = agentBottomY + agentHeight;
  return agentBottomY < obstacle.maxY - NAVIGATION_VERTICAL_EPSILON
    && agentTopY > obstacle.minY + NAVIGATION_VERTICAL_EPSILON;
}

export function navigationObstaclesBlockingHeight(
  obstacles: NavigationObstacle[],
  agentBottomY: number,
  agentHeight: number,
) {
  return obstacles.filter((obstacle) => navigationObstacleBlocksHeight(
    obstacle,
    agentBottomY,
    agentHeight,
  ));
}

export function findNavigationSupportY(
  obstacles: NavigationObstacle[],
  point: NavigationPoint,
  agentRadius: number,
  maximumSupportY: number,
) {
  let supportY: number | null = null;
  for (const obstacle of obstacles) {
    if (obstacle.maxY === undefined || obstacle.maxY > maximumSupportY + NAVIGATION_VERTICAL_EPSILON) continue;
    const overlapsFootprint = point[0] >= obstacle.minX - agentRadius
      && point[0] <= obstacle.maxX + agentRadius
      && point[1] >= obstacle.minZ - agentRadius
      && point[1] <= obstacle.maxZ + agentRadius;
    if (!overlapsFootprint || (supportY !== null && obstacle.maxY <= supportY)) continue;
    supportY = obstacle.maxY;
  }
  return supportY;
}

export interface NavigationPushBody {
  id: string;
  obstacle: NavigationObstacle;
}

interface NavigationObstacleIndex {
  buckets: Map<string, NavigationObstacle[]>;
  cellSize: number;
}

type GridPoint = { x: number; z: number };

function gridKey(point: GridPoint) {
  return `${point.x}:${point.z}`;
}

function obstacleCellKey(x: number, z: number) {
  return `${x}:${z}`;
}

function obstacleCellRange(value: number, cellSize: number) {
  return Math.floor(value / cellSize);
}

function createNavigationObstacleIndex(
  obstacles: NavigationObstacle[],
  cellSize: number,
): NavigationObstacleIndex {
  const safeCellSize = Math.max(1, cellSize);
  const buckets = new Map<string, NavigationObstacle[]>();
  for (const obstacle of obstacles) {
    const minX = obstacleCellRange(obstacle.minX, safeCellSize);
    const maxX = obstacleCellRange(obstacle.maxX, safeCellSize);
    const minZ = obstacleCellRange(obstacle.minZ, safeCellSize);
    const maxZ = obstacleCellRange(obstacle.maxZ, safeCellSize);
    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const key = obstacleCellKey(x, z);
        const bucket = buckets.get(key);
        if (bucket) bucket.push(obstacle);
        else buckets.set(key, [obstacle]);
      }
    }
  }
  return { buckets, cellSize: safeCellSize };
}

function queryNavigationObstacleIndex(
  index: NavigationObstacleIndex,
  area: NavigationObstacle,
): NavigationObstacle[] {
  const minX = obstacleCellRange(area.minX, index.cellSize);
  const maxX = obstacleCellRange(area.maxX, index.cellSize);
  const minZ = obstacleCellRange(area.minZ, index.cellSize);
  const maxZ = obstacleCellRange(area.maxZ, index.cellSize);
  const candidates = new Set<NavigationObstacle>();
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (const obstacle of index.buckets.get(obstacleCellKey(x, z)) ?? []) candidates.add(obstacle);
    }
  }
  return [...candidates];
}

function toGrid(surface: NavigationSurface, point: NavigationPoint): GridPoint {
  const [minX, , minZ] = surface.bounds;
  return {
    x: Math.round((point[0] - minX) / surface.cellSize),
    z: Math.round((point[1] - minZ) / surface.cellSize),
  };
}

function fromGrid(surface: NavigationSurface, point: GridPoint): NavigationPoint {
  const [minX, , minZ] = surface.bounds;
  return [minX + point.x * surface.cellSize, minZ + point.z * surface.cellSize];
}

export function isNavigationPointWalkable(
  surface: NavigationSurface,
  obstacles: NavigationObstacle[],
  point: NavigationPoint,
  obstacleIndex?: NavigationObstacleIndex,
): boolean {
  const [minX, maxX, minZ, maxZ] = surface.bounds;
  if (point[0] < minX || point[0] > maxX || point[1] < minZ || point[1] > maxZ) return false;
  const nearbyObstacles = obstacleIndex
    ? queryNavigationObstacleIndex(obstacleIndex, {
        minX: point[0] - surface.agentRadius,
        maxX: point[0] + surface.agentRadius,
        minZ: point[1] - surface.agentRadius,
        maxZ: point[1] + surface.agentRadius,
      })
    : obstacles;
  return !nearbyObstacles.some((obstacle) => (
    point[0] >= obstacle.minX - surface.agentRadius
    && point[0] <= obstacle.maxX + surface.agentRadius
    && point[1] >= obstacle.minZ - surface.agentRadius
    && point[1] <= obstacle.maxZ + surface.agentRadius
  ));
}

function navigationObstaclesOverlap(first: NavigationObstacle, second: NavigationObstacle, inset = 0) {
  return first.minX < second.maxX - inset
    && first.maxX > second.minX + inset
    && first.minZ < second.maxZ - inset
    && first.maxZ > second.minZ + inset;
}

export function collectNavigationPushChain(
  bounds: NavigationSurface["bounds"],
  staticObstacles: NavigationObstacle[],
  bodies: NavigationPushBody[],
  initialBodyIds: string[],
  delta: NavigationPoint,
): string[] | null {
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const pendingIds = initialBodyIds.filter((id, index) => bodyById.has(id) && initialBodyIds.indexOf(id) === index);
  if (pendingIds.length === 0) return null;
  const movingIds = new Set(pendingIds);
  const [deltaX, deltaZ] = delta;
  const [minX, maxX, minZ, maxZ] = bounds;
  const indexCellSize = Math.max(32, ...bodies.map((body) => Math.max(
    body.obstacle.maxX - body.obstacle.minX,
    body.obstacle.maxZ - body.obstacle.minZ,
  )));
  const bodyIndex = createNavigationObstacleIndex(bodies.map((body) => body.obstacle), indexCellSize);
  const bodyByObstacle = new Map(bodies.map((body) => [body.obstacle, body]));
  const staticIndex = createNavigationObstacleIndex(staticObstacles, indexCellSize);

  for (let index = 0; index < pendingIds.length; index += 1) {
    const body = bodyById.get(pendingIds[index]!)!;
    const proposed: NavigationObstacle = {
      minX: body.obstacle.minX + deltaX,
      maxX: body.obstacle.maxX + deltaX,
      minZ: body.obstacle.minZ + deltaZ,
      maxZ: body.obstacle.maxZ + deltaZ,
    };
    if (proposed.minX < minX || proposed.maxX > maxX || proposed.minZ < minZ || proposed.maxZ > maxZ) return null;
    if (queryNavigationObstacleIndex(staticIndex, proposed)
      .some((obstacle) => navigationObstaclesOverlap(proposed, obstacle, 8))) return null;
    for (const otherObstacle of queryNavigationObstacleIndex(bodyIndex, proposed)) {
      const other = bodyByObstacle.get(otherObstacle);
      if (!other) continue;
      if (movingIds.has(other.id) || !navigationObstaclesOverlap(proposed, other.obstacle)) continue;
      movingIds.add(other.id);
      pendingIds.push(other.id);
    }
  }
  return pendingIds;
}

function heuristic(a: GridPoint, b: GridPoint) {
  const dx = Math.abs(a.x - b.x);
  const dz = Math.abs(a.z - b.z);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

function simplifyPath(path: NavigationPoint[]): NavigationPoint[] {
  if (path.length < 3) return path;
  const result = [path[0]!];
  let previousDirection: NavigationPoint | null = null;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]!;
    const current = path[index]!;
    const direction: NavigationPoint = [Math.sign(current[0] - previous[0]), Math.sign(current[1] - previous[1])];
    if (previousDirection && (direction[0] !== previousDirection[0] || direction[1] !== previousDirection[1])) {
      result.push(previous);
    }
    previousDirection = direction;
  }
  result.push(path[path.length - 1]!);
  return result;
}

export function findNavigationPath(
  surface: NavigationSurface,
  obstacles: NavigationObstacle[],
  startPoint: NavigationPoint,
  endPoint: NavigationPoint,
): NavigationPoint[] {
  const obstacleIndex = createNavigationObstacleIndex(
    obstacles,
    Math.max(surface.cellSize * 2, surface.agentRadius * 2, 1),
  );
  const isWalkable = (point: NavigationPoint) => isNavigationPointWalkable(
    surface,
    obstacles,
    point,
    obstacleIndex,
  );
  if (!isWalkable(startPoint) || !isWalkable(endPoint)) return [];

  const start = toGrid(surface, startPoint);
  const end = toGrid(surface, endPoint);
  const open = new Map<string, GridPoint>([[gridKey(start), start]]);
  const cameFrom = new Map<string, GridPoint>();
  const gScore = new Map<string, number>([[gridKey(start), 0]]);
  const fScore = new Map<string, number>([[gridKey(start), heuristic(start, end)]]);
  const directions = [
    { x: 1, z: 0, cost: 1 }, { x: -1, z: 0, cost: 1 },
    { x: 0, z: 1, cost: 1 }, { x: 0, z: -1, cost: 1 },
    { x: 1, z: 1, cost: Math.SQRT2 }, { x: 1, z: -1, cost: Math.SQRT2 },
    { x: -1, z: 1, cost: Math.SQRT2 }, { x: -1, z: -1, cost: Math.SQRT2 },
  ];

  while (open.size > 0) {
    let current = [...open.values()][0]!;
    for (const candidate of open.values()) {
      if ((fScore.get(gridKey(candidate)) ?? Infinity) < (fScore.get(gridKey(current)) ?? Infinity)) current = candidate;
    }
    const currentKey = gridKey(current);
    if (current.x === end.x && current.z === end.z) {
      const gridPath = [current];
      while (cameFrom.has(gridKey(gridPath[0]!))) gridPath.unshift(cameFrom.get(gridKey(gridPath[0]!))!);
      const points = gridPath.map((point) => fromGrid(surface, point));
      points[0] = startPoint;
      points[points.length - 1] = endPoint;
      return simplifyPath(points);
    }
    open.delete(currentKey);

    for (const direction of directions) {
      const neighbor = { x: current.x + direction.x, z: current.z + direction.z };
      const neighborPoint = fromGrid(surface, neighbor);
      if (!isWalkable(neighborPoint)) continue;
      if (direction.x !== 0 && direction.z !== 0) {
        const sideX = fromGrid(surface, { x: current.x + direction.x, z: current.z });
        const sideZ = fromGrid(surface, { x: current.x, z: current.z + direction.z });
        if (!isWalkable(sideX) || !isWalkable(sideZ)) continue;
      }
      const neighborKey = gridKey(neighbor);
      const tentativeScore = (gScore.get(currentKey) ?? Infinity) + direction.cost;
      if (tentativeScore >= (gScore.get(neighborKey) ?? Infinity)) continue;
      cameFrom.set(neighborKey, current);
      gScore.set(neighborKey, tentativeScore);
      fScore.set(neighborKey, tentativeScore + heuristic(neighbor, end));
      open.set(neighborKey, neighbor);
    }
  }
  return [];
}
