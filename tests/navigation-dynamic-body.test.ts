import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { findNavigationSupportY, navigationObstaclesBlockingHeight } from "../apps/web/src/navigation";
import { collectNavigationMeshCollisionObstacles } from "../apps/web/src/viewport/navigationDynamicBody";

function createFeatureBox(
  size: [number, number, number],
  position: [number, number, number],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
  mesh.position.set(...position);
  mesh.userData.feature = { type: "box" };
  return mesh;
}

describe("navigation dynamic body collisions", () => {
  it("keeps a cart deck and its tall handle as separate collision volumes", () => {
    const cart = new THREE.Group();
    cart.add(createFeatureBox([850, 72, 1180], [0, 310, 0]));
    cart.add(createFeatureBox([42, 800, 42], [-404, 710, 548]));
    cart.add(createFeatureBox([42, 800, 42], [404, 710, 548]));

    const collisions = collectNavigationMeshCollisionObstacles(cart);
    const obstacles = collisions.map(({ obstacle }) => obstacle);
    const deckTop = 346;

    expect(collisions).toHaveLength(3);
    expect(findNavigationSupportY(obstacles, [0, 0], 120, 500)).toBeCloseTo(deckTop);
    expect(navigationObstaclesBlockingHeight(obstacles, deckTop, 1720)).toHaveLength(2);
    expect(navigationObstaclesBlockingHeight(obstacles, 0, 1720)).toHaveLength(3);
  });
});
