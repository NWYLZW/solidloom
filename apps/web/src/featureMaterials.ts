import * as THREE from "three";
import type { FeatureMaterialPreset, ModelFeature } from "@solidloom/shared";
import { createVoxelSkinMaterialLayers } from "./voxelSkin";

export const FEATURE_MATERIAL_COLORS: Record<FeatureMaterialPreset, string> = {
  default: "#b9c9ad",
  wood: "#a8754f",
  metal: "#aab2b8",
  plastic: "#7f9278",
  glass: "#9ccfd5",
  fabric: "#71858a",
  rubber: "#303638",
};

const sharedFeatureTextures = new Set<THREE.Texture>();
let woodGrainTexture: THREE.DataTexture | null = null;
let fabricWeaveTexture: THREE.DataTexture | null = null;

export function resolveFeatureColor(feature: ModelFeature) {
  return feature.appearance?.color
    ?? FEATURE_MATERIAL_COLORS[feature.appearance?.material ?? "default"];
}

function createWoodGrainTexture() {
  if (woodGrainTexture) return woodGrainTexture;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const wave = Math.sin(y * 0.38 + Math.sin(x * 0.13) * 1.9);
      const fineGrain = Math.sin(y * 1.55 + x * 0.07);
      const shade = Math.round(224 + wave * 15 + fineGrain * 6);
      const offset = (y * size + x) * 4;
      data[offset] = shade;
      data[offset + 1] = shade;
      data[offset + 2] = shade;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 1.5);
  texture.needsUpdate = true;
  woodGrainTexture = texture;
  sharedFeatureTextures.add(texture);
  return woodGrainTexture;
}

function createFabricWeaveTexture() {
  if (fabricWeaveTexture) return fabricWeaveTexture;
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const warp = x % 4 < 2 ? 9 : -7;
      const weft = y % 4 < 2 ? 7 : -5;
      const shade = 224 + warp + weft;
      const offset = (y * size + x) * 4;
      data[offset] = shade;
      data[offset + 1] = shade;
      data[offset + 2] = shade;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;
  fabricWeaveTexture = texture;
  sharedFeatureTextures.add(texture);
  return fabricWeaveTexture;
}

export function disposeFeatureMaterial(material: THREE.Material) {
  if (material instanceof THREE.MeshStandardMaterial
    && material.map
    && !sharedFeatureTextures.has(material.map)) material.map.dispose();
  material.dispose();
}

export function createFeatureMaterial(feature: ModelFeature): THREE.MeshStandardMaterial {
  if (feature.operation === "cut") {
    return new THREE.MeshStandardMaterial({
      color: 0xc77867,
      transparent: true,
      opacity: 0.32,
      wireframe: true,
      depthWrite: false,
    });
  }

  const preset = feature.appearance?.material ?? "default";
  const color = resolveFeatureColor(feature);
  const common = {
    color,
    emissive: 0x000000,
    emissiveIntensity: 0,
  };

  if (preset === "wood") {
    return new THREE.MeshStandardMaterial({
      ...common,
      map: createWoodGrainTexture(),
      roughness: 0.78,
      metalness: 0,
    });
  }
  if (preset === "metal") {
    return new THREE.MeshStandardMaterial({
      ...common,
      roughness: 0.24,
      metalness: 0.88,
    });
  }
  if (preset === "plastic") {
    return new THREE.MeshPhysicalMaterial({
      ...common,
      roughness: 0.34,
      metalness: 0,
      clearcoat: 0.28,
      clearcoatRoughness: 0.38,
    });
  }
  if (preset === "glass") {
    return new THREE.MeshPhysicalMaterial({
      ...common,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.38,
      transmission: 0.56,
      thickness: 2.5,
      ior: 1.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }
  if (preset === "fabric") {
    return new THREE.MeshStandardMaterial({
      ...common,
      map: createFabricWeaveTexture(),
      roughness: 0.94,
      metalness: 0,
    });
  }
  if (preset === "rubber") {
    return new THREE.MeshStandardMaterial({
      ...common,
      roughness: 0.88,
      metalness: 0.02,
    });
  }
  return new THREE.MeshStandardMaterial({
    ...common,
    roughness: 0.62,
    metalness: 0.04,
  });
}

export function createFeatureMaterialSet(
  feature: ModelFeature,
  onTextureReady?: () => void,
): {
  base: THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
  overlay?: THREE.MeshStandardMaterial[];
} {
  const skinLayers = createVoxelSkinMaterialLayers(feature, onTextureReady);
  return skinLayers
    ? skinLayers
    : { base: createFeatureMaterial(feature) };
}
