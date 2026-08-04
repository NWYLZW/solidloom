import type { NavigationSurface } from "@solidloom/shared";

export type NavigationPoint = [number, number];
export interface NavigationObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface NavigationPushBody {
  id: string;
  obstacle: NavigationObstacle;
}

type GridPoint = { x: number; z: number };

function gridKey(point: GridPoint) {
  return `${point.x}:${point.z}`;
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
): boolean {
  const [minX, maxX, minZ, maxZ] = surface.bounds;
  if (point[0] < minX || point[0] > maxX || point[1] < minZ || point[1] > maxZ) return false;
  return !obstacles.some((obstacle) => (
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

  for (let index = 0; index < pendingIds.length; index += 1) {
    const body = bodyById.get(pendingIds[index]!)!;
    const proposed: NavigationObstacle = {
      minX: body.obstacle.minX + deltaX,
      maxX: body.obstacle.maxX + deltaX,
      minZ: body.obstacle.minZ + deltaZ,
      maxZ: body.obstacle.maxZ + deltaZ,
    };
    if (proposed.minX < minX || proposed.maxX > maxX || proposed.minZ < minZ || proposed.maxZ > maxZ) return null;
    if (staticObstacles.some((obstacle) => navigationObstaclesOverlap(proposed, obstacle, 8))) return null;
    for (const other of bodies) {
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
  if (!isNavigationPointWalkable(surface, obstacles, startPoint)
    || !isNavigationPointWalkable(surface, obstacles, endPoint)) return [];

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
      if (!isNavigationPointWalkable(surface, obstacles, neighborPoint)) continue;
      if (direction.x !== 0 && direction.z !== 0) {
        const sideX = fromGrid(surface, { x: current.x + direction.x, z: current.z });
        const sideZ = fromGrid(surface, { x: current.x, z: current.z + direction.z });
        if (!isNavigationPointWalkable(surface, obstacles, sideX)
          || !isNavigationPointWalkable(surface, obstacles, sideZ)) continue;
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
