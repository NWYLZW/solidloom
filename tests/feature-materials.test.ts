import { afterEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import type { BoxFeature } from "@solidloom/shared";
import { createFeatureMaterial, resolveFeatureColor } from "../apps/web/src/featureMaterials.js";

const materials: THREE.Material[] = [];
const feature = (appearance?: BoxFeature["appearance"]): BoxFeature => ({
  id: "surface",
  name: "表面",
  type: "box",
  operation: "add",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  parameters: { width: 10, depth: 10, height: 10 },
  appearance,
});

afterEach(() => {
  for (const material of materials.splice(0)) {
    if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
    material.dispose();
  }
});

describe("feature materials", () => {
  it("uses preset surface properties and allows a color override", () => {
    const wood = createFeatureMaterial(feature({ material: "wood", color: "#804020" }));
    const metal = createFeatureMaterial(feature({ material: "metal" }));
    materials.push(wood, metal);

    expect(resolveFeatureColor(feature({ material: "wood", color: "#804020" }))).toBe("#804020");
    expect(wood.color.getHexString()).toBe("804020");
    expect(wood.map).toBeInstanceOf(THREE.DataTexture);
    expect(metal.metalness).toBeGreaterThan(0.8);
  });

  it("creates a transparent physical glass material", () => {
    const glass = createFeatureMaterial(feature({ material: "glass" }));
    materials.push(glass);

    expect(glass).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(glass.transparent).toBe(true);
    expect(glass.depthWrite).toBe(false);
    expect((glass as THREE.MeshPhysicalMaterial).transmission).toBeGreaterThan(0.5);
  });
});
