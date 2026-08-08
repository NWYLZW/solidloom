import { describe, expect, it } from "vitest";
import type { NavigationSurface } from "@solidloom/shared";
import {
  collectNavigationPushChain,
  findNavigationPath,
  findNavigationSupportY,
  isNavigationPointWalkable,
  navigationObstaclesBlockingHeight,
  type NavigationObstacle,
} from "../apps/web/src/navigation";

const surface: NavigationSurface = {
  enabled: true,
  floorY: 0,
  bounds: [0, 1000, 0, 1000],
  cellSize: 100,
  agentRadius: 40,
  agentHeight: 180,
  start: [100, 100],
};

describe("navigation", () => {
  it("pads obstacles by the agent radius", () => {
    const obstacles: NavigationObstacle[] = [{ minX: 400, maxX: 600, minZ: 400, maxZ: 600 }];
    expect(isNavigationPointWalkable(surface, obstacles, [365, 500])).toBe(false);
    expect(isNavigationPointWalkable(surface, obstacles, [300, 500])).toBe(true);
  });

  it("finds a simplified path around a blocking obstacle", () => {
    const obstacles: NavigationObstacle[] = [{ minX: 400, maxX: 600, minZ: 300, maxZ: 700 }];
    const path = findNavigationPath(surface, obstacles, [100, 500], [900, 500]);
    expect(path[0]).toEqual([100, 500]);
    expect(path.at(-1)).toEqual([900, 500]);
    expect(path.length).toBeGreaterThan(2);
    expect(path.every((point) => isNavigationPointWalkable(surface, obstacles, point))).toBe(true);
  });

  it("returns no path for an unreachable destination", () => {
    const obstacles: NavigationObstacle[] = [{ minX: 450, maxX: 550, minZ: 0, maxZ: 1000 }];
    expect(findNavigationPath(surface, obstacles, [100, 500], [900, 500])).toEqual([]);
  });

  it("stops treating a low obstacle as a wall after the agent clears its top", () => {
    const obstacles: NavigationObstacle[] = [{
      minX: 400,
      maxX: 600,
      minY: 0,
      maxY: 120,
      minZ: 400,
      maxZ: 600,
    }];
    expect(navigationObstaclesBlockingHeight(obstacles, 80, surface.agentHeight)).toEqual(obstacles);
    expect(navigationObstaclesBlockingHeight(obstacles, 120, surface.agentHeight)).toEqual([]);
  });

  it("finds the highest model surface below the agent feet", () => {
    const obstacles: NavigationObstacle[] = [
      { minX: 400, maxX: 600, minY: 0, maxY: 120, minZ: 400, maxZ: 600 },
      { minX: 450, maxX: 550, minY: 120, maxY: 180, minZ: 450, maxZ: 550 },
    ];
    expect(findNavigationSupportY(obstacles, [500, 500], surface.agentRadius, 200)).toBe(180);
    expect(findNavigationSupportY(obstacles, [500, 500], surface.agentRadius, 150)).toBe(120);
    expect(findNavigationSupportY(obstacles, [100, 100], surface.agentRadius, 200)).toBeNull();
  });

  it("propagates a push through touching dynamic bodies until a static obstacle blocks the chain", () => {
    const bodies = [
      { id: "chair-a", obstacle: { minX: 100, maxX: 200, minZ: 100, maxZ: 200 } },
      { id: "chair-b", obstacle: { minX: 200, maxX: 300, minZ: 100, maxZ: 200 } },
    ];
    expect(collectNavigationPushChain(surface.bounds, [], bodies, ["chair-a"], [12, 0])).toEqual([
      "chair-a",
      "chair-b",
    ]);
    expect(collectNavigationPushChain(
      surface.bounds,
      [{ minX: 300, maxX: 400, minZ: 100, maxZ: 200 }],
      bodies,
      ["chair-a"],
      [12, 0],
    )).toBeNull();
  });

  it("propagates long push chains across spatial buckets", () => {
    const bodies = Array.from({ length: 12 }, (_, index) => ({
      id: `chair-${index}`,
      obstacle: {
        minX: 100 + index * 50,
        maxX: 150 + index * 50,
        minZ: 200,
        maxZ: 250,
      },
    }));

    expect(collectNavigationPushChain(surface.bounds, [], bodies, ["chair-0"], [8, 0])).toEqual(
      bodies.map((body) => body.id),
    );
    expect(collectNavigationPushChain(
      surface.bounds,
      [{ minX: 695, maxX: 760, minZ: 200, maxZ: 250 }],
      bodies,
      ["chair-0"],
      [8, 0],
    )).toBeNull();
  });
});
