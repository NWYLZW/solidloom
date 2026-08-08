import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createNavigationCameraCollisionRuntime } from "./navigationCameraCollisionRuntime";

describe("navigationCameraCollisionRuntime", () => {
  it("moves the camera in front of blocking model geometry", () => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 1));
    wall.position.z = -5;
    const runtime = createNavigationCameraCollisionRuntime([wall]);
    const output = new THREE.Vector3();

    runtime.resolvePosition({
      clearance: 1,
      idealPosition: new THREE.Vector3(0, 0, -10),
      output,
      target: new THREE.Vector3(0, 0, 0),
    });

    expect(output.toArray()).toEqual([0, 0, -3.5]);
    runtime.dispose();
    wall.geometry.dispose();
  });

  it("keeps the ideal camera position when no geometry blocks it", () => {
    const model = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    model.position.x = 8;
    const runtime = createNavigationCameraCollisionRuntime([model]);
    const output = new THREE.Vector3();

    runtime.resolvePosition({
      clearance: 1,
      idealPosition: new THREE.Vector3(0, 0, -10),
      output,
      target: new THREE.Vector3(0, 0, 0),
    });

    expect(output.toArray()).toEqual([0, 0, -10]);
    runtime.dispose();
    model.geometry.dispose();
  });

  it("tracks articulated and translated model geometry", () => {
    const parent = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.5));
    parent.add(panel);
    parent.position.z = -4;
    const runtime = createNavigationCameraCollisionRuntime([panel]);
    const output = new THREE.Vector3();

    runtime.resolvePosition({
      clearance: 0.5,
      idealPosition: new THREE.Vector3(0, 0, -10),
      output,
      target: new THREE.Vector3(0, 0, 0),
    });
    expect(output.z).toBeCloseTo(-3.25, 10);

    parent.position.x = 8;
    runtime.resolvePosition({
      clearance: 0.5,
      idealPosition: new THREE.Vector3(0, 0, -10),
      output,
      target: new THREE.Vector3(0, 0, 0),
    });
    expect(output.z).toBe(-10);

    runtime.dispose();
    panel.geometry.dispose();
  });
});
