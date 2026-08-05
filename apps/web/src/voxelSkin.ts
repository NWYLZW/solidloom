import * as THREE from "three";
import type { ModelFeature, VoxelSkinModel, VoxelSkinPart, VoxelSkinSegment } from "@solidloom/shared";

export const BUILTIN_VOXEL_SKIN_URL = "builtin:solidloom-block-avatar";

export type VoxelSkinFace = "right" | "left" | "top" | "bottom" | "front" | "back";
export type VoxelSkinRegion = readonly [x: number, y: number, width: number, height: number];
export interface VoxelSkinFaceRegion {
  base: VoxelSkinRegion;
  overlay?: VoxelSkinRegion;
}

export interface VoxelSkinMaterialLayers {
  base: THREE.MeshStandardMaterial[];
  overlay: THREE.MeshStandardMaterial[];
}

const FACE_ORDER: VoxelSkinFace[] = ["right", "left", "top", "bottom", "front", "back"];

const CLASSIC_REGIONS: Record<VoxelSkinPart, Record<VoxelSkinFace, VoxelSkinFaceRegion>> = {
  head: {
    right: { base: [0, 8, 8, 8], overlay: [32, 8, 8, 8] },
    left: { base: [16, 8, 8, 8], overlay: [48, 8, 8, 8] },
    top: { base: [8, 0, 8, 8], overlay: [40, 0, 8, 8] },
    bottom: { base: [16, 0, 8, 8], overlay: [48, 0, 8, 8] },
    front: { base: [8, 8, 8, 8], overlay: [40, 8, 8, 8] },
    back: { base: [24, 8, 8, 8], overlay: [56, 8, 8, 8] },
  },
  torso: {
    right: { base: [16, 20, 4, 12], overlay: [16, 36, 4, 12] },
    left: { base: [28, 20, 4, 12], overlay: [28, 36, 4, 12] },
    top: { base: [20, 16, 8, 4], overlay: [20, 32, 8, 4] },
    bottom: { base: [28, 16, 8, 4], overlay: [28, 32, 8, 4] },
    front: { base: [20, 20, 8, 12], overlay: [20, 36, 8, 12] },
    back: { base: [32, 20, 8, 12], overlay: [32, 36, 8, 12] },
  },
  rightArm: {
    right: { base: [40, 20, 4, 12], overlay: [40, 36, 4, 12] },
    left: { base: [48, 20, 4, 12], overlay: [48, 36, 4, 12] },
    top: { base: [44, 16, 4, 4], overlay: [44, 32, 4, 4] },
    bottom: { base: [48, 16, 4, 4], overlay: [48, 32, 4, 4] },
    front: { base: [44, 20, 4, 12], overlay: [44, 36, 4, 12] },
    back: { base: [52, 20, 4, 12], overlay: [52, 36, 4, 12] },
  },
  rightLeg: {
    right: { base: [0, 20, 4, 12], overlay: [0, 36, 4, 12] },
    left: { base: [8, 20, 4, 12], overlay: [8, 36, 4, 12] },
    top: { base: [4, 16, 4, 4], overlay: [4, 32, 4, 4] },
    bottom: { base: [8, 16, 4, 4], overlay: [8, 32, 4, 4] },
    front: { base: [4, 20, 4, 12], overlay: [4, 36, 4, 12] },
    back: { base: [12, 20, 4, 12], overlay: [12, 36, 4, 12] },
  },
  leftArm: {
    right: { base: [32, 52, 4, 12], overlay: [48, 52, 4, 12] },
    left: { base: [40, 52, 4, 12], overlay: [56, 52, 4, 12] },
    top: { base: [36, 48, 4, 4], overlay: [52, 48, 4, 4] },
    bottom: { base: [40, 48, 4, 4], overlay: [56, 48, 4, 4] },
    front: { base: [36, 52, 4, 12], overlay: [52, 52, 4, 12] },
    back: { base: [44, 52, 4, 12], overlay: [60, 52, 4, 12] },
  },
  leftLeg: {
    right: { base: [16, 52, 4, 12], overlay: [0, 52, 4, 12] },
    left: { base: [24, 52, 4, 12], overlay: [8, 52, 4, 12] },
    top: { base: [20, 48, 4, 4], overlay: [4, 48, 4, 4] },
    bottom: { base: [24, 48, 4, 4], overlay: [8, 48, 4, 4] },
    front: { base: [20, 52, 4, 12], overlay: [4, 52, 4, 12] },
    back: { base: [28, 52, 4, 12], overlay: [12, 52, 4, 12] },
  },
};

function slimArmRegions(part: "leftArm" | "rightArm"): Record<VoxelSkinFace, VoxelSkinFaceRegion> {
  if (part === "rightArm") {
    return {
      right: { base: [40, 20, 4, 12], overlay: [40, 36, 4, 12] },
      left: { base: [47, 20, 4, 12], overlay: [47, 36, 4, 12] },
      top: { base: [44, 16, 3, 4], overlay: [44, 32, 3, 4] },
      bottom: { base: [47, 16, 3, 4], overlay: [47, 32, 3, 4] },
      front: { base: [44, 20, 3, 12], overlay: [44, 36, 3, 12] },
      back: { base: [51, 20, 3, 12], overlay: [51, 36, 3, 12] },
    };
  }
  return {
    right: { base: [32, 52, 4, 12], overlay: [48, 52, 4, 12] },
    left: { base: [39, 52, 4, 12], overlay: [55, 52, 4, 12] },
    top: { base: [36, 48, 3, 4], overlay: [52, 48, 3, 4] },
    bottom: { base: [39, 48, 3, 4], overlay: [55, 48, 3, 4] },
    front: { base: [36, 52, 3, 12], overlay: [52, 52, 3, 12] },
    back: { base: [43, 52, 3, 12], overlay: [59, 52, 3, 12] },
  };
}

function cropRegionToSegment(region: VoxelSkinRegion, segment: Exclude<VoxelSkinSegment, "full">): VoxelSkinRegion {
  const [x, y, width, height] = region;
  const unit = height / 12;
  if (segment === "upper") return [x, y, width, unit * 6];
  if (segment === "lower") return [x, y + unit * 6, width, unit * 6];
  return [x, y + unit * 10, width, unit * 2];
}

function cropLegRegions(
  regions: Record<VoxelSkinFace, VoxelSkinFaceRegion>,
  segment: Exclude<VoxelSkinSegment, "full">,
): Record<VoxelSkinFace, VoxelSkinFaceRegion> {
  return Object.fromEntries(FACE_ORDER.map((face) => {
    const region = regions[face];
    if (face === "top" || face === "bottom") return [face, region];
    return [face, {
      base: cropRegionToSegment(region.base, segment),
      overlay: region.overlay ? cropRegionToSegment(region.overlay, segment) : undefined,
    }];
  })) as Record<VoxelSkinFace, VoxelSkinFaceRegion>;
}

export function resolveVoxelSkinFaceRegions(
  part: VoxelSkinPart,
  model: VoxelSkinModel,
  segment: VoxelSkinSegment = "full",
) {
  const regions = model === "slim" && (part === "leftArm" || part === "rightArm")
    ? slimArmRegions(part)
    : CLASSIC_REGIONS[part];
  return segment !== "full" && (part === "leftLeg" || part === "rightLeg")
    ? cropLegRegions(regions, segment)
    : regions;
}

function paintRegion(context: CanvasRenderingContext2D, region: VoxelSkinRegion, color: string) {
  context.fillStyle = color;
  context.fillRect(...region);
}

function createBuiltInSkinAtlas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.clearRect(0, 0, 64, 64);

  const colors: Record<VoxelSkinPart, string> = {
    head: "#C98F68",
    torso: "#2E8D9D",
    leftArm: "#B87858",
    rightArm: "#B87858",
    leftLeg: "#273A68",
    rightLeg: "#273A68",
  };
  for (const part of Object.keys(CLASSIC_REGIONS) as VoxelSkinPart[]) {
    const regions = CLASSIC_REGIONS[part];
    FACE_ORDER.forEach((face, index) => {
      const [x, y, width, height] = regions[face].base;
      const shade = index === 2 ? "#E3AF84" : index === 3 ? "#1D2C52" : colors[part];
      paintRegion(context, [x, y, width, height], part === "head" && index !== 3 ? shade : part === "head" ? "#A86F52" : shade);
    });
  }

  const headFront = CLASSIC_REGIONS.head.front.base;
  context.fillStyle = "#4B3028";
  context.fillRect(headFront[0], headFront[1], headFront[2], 2);
  context.fillRect(headFront[0], headFront[1] + 2, 1, 2);
  context.fillRect(headFront[0] + 7, headFront[1] + 2, 1, 2);
  context.fillStyle = "#EAF5F2";
  context.fillRect(headFront[0] + 1, headFront[1] + 3, 2, 1);
  context.fillRect(headFront[0] + 5, headFront[1] + 3, 2, 1);
  context.fillStyle = "#23384A";
  context.fillRect(headFront[0] + 2, headFront[1] + 3, 1, 1);
  context.fillRect(headFront[0] + 5, headFront[1] + 3, 1, 1);
  context.fillStyle = "#8A4F45";
  context.fillRect(headFront[0] + 3, headFront[1] + 6, 2, 1);

  const torsoFront = CLASSIC_REGIONS.torso.front.base;
  context.fillStyle = "#54C4C2";
  context.fillRect(torsoFront[0], torsoFront[1], torsoFront[2], 2);
  context.fillStyle = "#193D54";
  context.fillRect(torsoFront[0] + 3, torsoFront[1] + 2, 2, 8);
  context.fillStyle = "#A9D632";
  context.fillRect(torsoFront[0] + 3, torsoFront[1] + 4, 2, 2);

  for (const part of ["leftArm", "rightArm"] as const) {
    const front = CLASSIC_REGIONS[part].front.base;
    context.fillStyle = "#2E8D9D";
    context.fillRect(front[0], front[1], front[2], 4);
  }
  return canvas;
}

function createFaceTexture(source: CanvasImageSource, region: VoxelSkinRegion): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = region[2];
  canvas.height = region[3];
  const context = canvas.getContext("2d");
  if (context) {
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, ...region, 0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function applySkinSource(
  layers: VoxelSkinMaterialLayers,
  source: CanvasImageSource,
  part: VoxelSkinPart,
  model: VoxelSkinModel,
  segment: VoxelSkinSegment,
) {
  const regions = resolveVoxelSkinFaceRegions(part, model, segment);
  FACE_ORDER.forEach((face, index) => {
    const region = regions[face];
    const baseMaterial = layers.base[index];
    const overlayMaterial = layers.overlay[index];
    if (baseMaterial) {
      baseMaterial.map?.dispose();
      baseMaterial.map = createFaceTexture(source, region.base);
      baseMaterial.needsUpdate = true;
    }
    if (overlayMaterial && region.overlay) {
      overlayMaterial.map?.dispose();
      overlayMaterial.map = createFaceTexture(source, region.overlay);
      overlayMaterial.needsUpdate = true;
    }
  });
}

const skinImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadSkinImage(url: string): Promise<HTMLImageElement> {
  const existing = skinImageCache.get(url);
  if (existing) return existing;
  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (!url.startsWith("data:") && !url.startsWith("blob:")) image.crossOrigin = "anonymous";
    image.onload = () => image.naturalWidth >= 64 && image.naturalHeight >= 64
      ? resolve(image)
      : reject(new Error("皮肤图片必须至少为 64×64。"));
    image.onerror = () => reject(new Error("皮肤图片加载失败。"));
    image.src = url;
  });
  skinImageCache.set(url, request);
  return request;
}

export function resolveVoxelSkinOverlayDimensions(feature: ModelFeature): [number, number, number] | null {
  const skin = feature.appearance?.voxelSkin;
  if (!skin || feature.type !== "box" || feature.operation !== "add") return null;
  const segmentHeight = skin.segment && skin.segment !== "full"
    ? skin.segment === "foot" ? 2 : 6
    : 12;
  const nominalDimensions: [number, number, number] = skin.part === "head"
    ? [8, 8, 8]
    : skin.part === "torso"
      ? [8, 12, 4]
      : skin.part === "leftArm" || skin.part === "rightArm"
        ? [skin.model === "slim" ? 3 : 4, 12, 4]
        : [4, segmentHeight, 4];
  const pixelSizes = [
    feature.parameters.width / nominalDimensions[0],
    feature.parameters.height / nominalDimensions[1],
    feature.parameters.depth / nominalDimensions[2],
  ].sort((left, right) => left - right);
  const pixelSize = pixelSizes[1] ?? pixelSizes[0] ?? 0;
  const dilation = pixelSize * (skin.part === "head" ? 0.5 : 0.25);
  return [
    feature.parameters.width + dilation * 2,
    feature.parameters.height + dilation * 2,
    feature.parameters.depth + dilation * 2,
  ];
}

export function createVoxelSkinMaterialLayers(feature: ModelFeature, onReady?: () => void): VoxelSkinMaterialLayers | null {
  const skin = feature.appearance?.voxelSkin;
  if (!skin || feature.type !== "box" || feature.operation !== "add" || typeof document === "undefined") return null;
  const base = FACE_ORDER.map(() => new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.92,
    metalness: 0,
  }));
  const overlay = FACE_ORDER.map(() => new THREE.MeshStandardMaterial({
    alphaTest: 0.01,
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: 0.92,
    metalness: 0,
    transparent: true,
  }));
  const layers = { base, overlay };
  const segment = skin.segment ?? "full";
  applySkinSource(layers, createBuiltInSkinAtlas(), skin.part, skin.model, segment);
  if (skin.url !== BUILTIN_VOXEL_SKIN_URL) {
    void loadSkinImage(skin.url).then((image) => {
      applySkinSource(layers, image, skin.part, skin.model, segment);
      onReady?.();
    }).catch(() => undefined);
  }
  return layers;
}
