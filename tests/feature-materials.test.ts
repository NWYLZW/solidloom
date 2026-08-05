import { afterEach, describe, expect, it } from "vitest";
import * as THREE from "three";
import type { BoxFeature } from "@solidloom/shared";
import { createFeatureMaterial, disposeFeatureMaterial, resolveFeatureColor } from "../apps/web/src/featureMaterials.js";

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
  for (const material of materials.splice(0)) disposeFeatureMaterial(material);
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

  it("distinguishes woven fabric from matte rubber", () => {
    const fabric = createFeatureMaterial(feature({ material: "fabric" }));
    const rubber = createFeatureMaterial(feature({ material: "rubber" }));
    materials.push(fabric, rubber);

    expect(fabric.map).toBeInstanceOf(THREE.DataTexture);
    expect(fabric.roughness).toBeGreaterThan(0.9);
    expect(rubber.map).toBeNull();
    expect(rubber.roughness).toBeGreaterThan(0.8);
    expect(rubber.metalness).toBeLessThan(0.1);
  });

  it("reuses bounded procedural textures across repeated materials", () => {
    const firstWood = createFeatureMaterial(feature({ material: "wood" }));
    const secondWood = createFeatureMaterial(feature({ material: "wood", color: "#654321" }));
    const firstFabric = createFeatureMaterial(feature({ material: "fabric" }));
    const secondFabric = createFeatureMaterial(feature({ material: "fabric", color: "#445566" }));
    materials.push(firstWood, secondWood, firstFabric, secondFabric);

    expect(firstWood.map).toBe(secondWood.map);
    expect(firstFabric.map).toBe(secondFabric.map);
  });
});
