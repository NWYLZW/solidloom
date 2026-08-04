import { describe, expect, it } from "vitest";
import type { NavigationSurface } from "@solidloom/shared";
import {
  collectNavigationPushChain,
  findNavigationPath,
  isNavigationPointWalkable,
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
});
