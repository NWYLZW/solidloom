import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createNavigationSeatPoseResolver } from "../apps/web/src/viewport/navigationSeat";

describe("navigation seat pose", () => {
  it("places the avatar above the cushion and follows the chair heading", () => {
    const chair = new THREE.Group();
    chair.position.set(120, 0, -80);
    chair.rotation.y = Math.PI / 2;
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(520, 80, 480));
    cushion.position.set(0, 540, 0);
    chair.add(cushion);

    const pose = createNavigationSeatPoseResolver().resolve({
      agentHeight: 1720,
      fallbackFloorY: 0,
      object: chair,
      obstacle: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
      targetMeshes: [cushion],
    });

    expect(pose.position.x).toBeCloseTo(120);
    expect(pose.position.z).toBeCloseTo(-80);
    expect(pose.position.y).toBeCloseTo(580 + 1720 * 6 / 32);
    expect(pose.rotationY).toBeCloseTo(Math.PI / 2);
  });
});
