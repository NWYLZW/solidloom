import type { Vector3Tuple } from "@solidloom/shared";
import type { RestroomAccessibleTransferSide } from "./accessible.js";
import { restroomAssetIds } from "./model.js";

const sideWallThickness = 70;
const sideWallDepth = 2_050;
const sideWallX = 2_930;
const sideWallZ = -260;
const fixtureCenterZ = -370;
const wallClearance = 8;
const stallLeftBoundaryX = -2_320;
const stallWidth = 950;
const womenStallCount = 5;

export type RestroomPreviewRoomType = "men" | "women" | "accessible";
export type RestroomPreviewAssetId = (typeof restroomAssetIds)[keyof typeof restroomAssetIds];
export const restroomPreviewWallColor = 0xe1e6e4;
export const restroomPreviewRoomHeightLimits = {
  minimum: 2_200,
  maximum: 3_500,
  step: 50,
  defaultValue: 2_650,
} as const;

function normalizeRestroomPreviewRoomHeight(roomHeight: number) {
  if (!Number.isFinite(roomHeight)
    || roomHeight < restroomPreviewRoomHeightLimits.minimum
    || roomHeight > restroomPreviewRoomHeightLimits.maximum) {
    throw new Error(`roomHeight 必须位于 ${restroomPreviewRoomHeightLimits.minimum}–${restroomPreviewRoomHeightLimits.maximum} mm。`);
  }
  return roomHeight;
}

export interface RestroomPreviewComposition {
  roomType: RestroomPreviewRoomType;
  assetIds: RestroomPreviewAssetId[];
  stallControlsEnabled: boolean;
  urinalControlsEnabled: boolean;
}

export function createRestroomPreviewComposition(
  roomType: RestroomPreviewRoomType,
): RestroomPreviewComposition {
  if (roomType === "accessible") {
    return {
      roomType,
      assetIds: [
        restroomAssetIds.accessibleDoor,
        restroomAssetIds.toilet,
        restroomAssetIds.accessibleVanity,
        restroomAssetIds.mirror,
        restroomAssetIds.accessibilitySupport,
      ],
      stallControlsEnabled: false,
      urinalControlsEnabled: false,
    };
  }
  const assetIds: RestroomPreviewAssetId[] = [
    restroomAssetIds.partition,
    restroomAssetIds.stallDoor,
    restroomAssetIds.toilet,
    restroomAssetIds.vanity,
    restroomAssetIds.mirror,
  ];
  const urinalControlsEnabled = roomType === "men";
  if (urinalControlsEnabled) assetIds.splice(3, 0, restroomAssetIds.urinalBank);

  return { roomType, assetIds, stallControlsEnabled: true, urinalControlsEnabled };
}

export interface RestroomPreviewStallLayout {
  stallCount: number;
  stallWidth: number;
  partitionXs: number[];
  stallCenterXs: number[];
  partitionZ: number;
  doorZ: number;
  toiletZ: number;
  labelPosition: Vector3Tuple;
}

export function createRestroomPreviewStallLayout(
  roomType: RestroomPreviewRoomType,
  roomHeight: number = restroomPreviewRoomHeightLimits.defaultValue,
): RestroomPreviewStallLayout {
  const normalizedRoomHeight = normalizeRestroomPreviewRoomHeight(roomHeight);
  const stallCount = roomType === "accessible" ? 0 : roomType === "women" ? womenStallCount : 2;
  const resolvedStallWidth = roomType === "women"
    ? (sideWallX - stallLeftBoundaryX) / womenStallCount
    : stallWidth;
  const partitionXs = Array.from(
    { length: stallCount + 1 },
    (_, index) => stallLeftBoundaryX + index * resolvedStallWidth,
  );
  const stallCenterXs = Array.from(
    { length: stallCount },
    (_, index) => stallLeftBoundaryX + resolvedStallWidth * (index + 0.5),
  );
  const labelCenterX = (partitionXs[0]! + partitionXs.at(-1)!) / 2;

  return {
    stallCount,
    stallWidth: resolvedStallWidth,
    partitionXs,
    stallCenterXs,
    partitionZ: -920,
    doorZ: -20,
    toiletZ: -1_120,
    labelPosition: [labelCenterX, normalizedRoomHeight - 270, -700],
  };
}

export interface RestroomPreviewAccessibleLayout {
  transferSide: RestroomAccessibleTransferSide;
  room: {
    width: number;
    depth: number;
    wallHeight: number;
    wallThickness: number;
    backWall: { position: Vector3Tuple; size: Vector3Tuple };
    sideWalls: Array<{ position: Vector3Tuple; size: Vector3Tuple }>;
    frontWalls: Array<{ position: Vector3Tuple; size: Vector3Tuple }>;
  };
  door: {
    position: Vector3Tuple;
    rotationY: number;
    openingWidth: number;
  };
  toilet: { position: Vector3Tuple };
  support: { position: Vector3Tuple; transferSide: RestroomAccessibleTransferSide };
  vanity: {
    position: Vector3Tuple;
    rotationY: number;
    width: number;
    depth: number;
    counterHeight: number;
  };
  mirror: {
    position: Vector3Tuple;
    rotationY: number;
    width: number;
    bottomHeight: number;
  };
  labelPosition: Vector3Tuple;
}

export function createRestroomPreviewAccessibleLayout(
  transferSide: RestroomAccessibleTransferSide,
  roomHeight: number = restroomPreviewRoomHeightLimits.defaultValue,
): RestroomPreviewAccessibleLayout {
  const normalizedRoomHeight = normalizeRestroomPreviewRoomHeight(roomHeight);
  const roomWidth = 4_200;
  const backWallZ = -1_870;
  const frontWallZ = 1_450;
  const roomDepth = frontWallZ - backWallZ;
  const wallHeight = normalizedRoomHeight;
  const wallThickness = 70;
  const roomHalfWidth = roomWidth / 2;
  const wallCenterZ = (backWallZ + frontWallZ) / 2;
  const doorOpeningWidth = 1_050;
  const frontWallWidth = (roomWidth - doorOpeningWidth) / 2;
  const frontWallCenterX = doorOpeningWidth / 2 + frontWallWidth / 2;
  const transferSign = transferSide === "left" ? -1 : 1;
  const cutawaySide = -transferSign;
  const cutawayWallHeight = 1_000;
  const toiletX = -transferSign * 850;
  const vanityWallX = transferSign * (roomHalfWidth - wallThickness / 2);
  const vanityRotationY = transferSide === "left" ? 90 : -90;

  return {
    transferSide,
    room: {
      width: roomWidth,
      depth: roomDepth,
      wallHeight,
      wallThickness,
      backWall: {
        position: [0, wallHeight / 2, backWallZ],
        size: [roomWidth, wallHeight, wallThickness],
      },
      sideWalls: [-1, 1].map((side) => ({
        position: [side * roomHalfWidth, (side === cutawaySide ? cutawayWallHeight : wallHeight) / 2, wallCenterZ] as Vector3Tuple,
        size: [wallThickness, side === cutawaySide ? cutawayWallHeight : wallHeight, roomDepth] as Vector3Tuple,
      })),
      frontWalls: [-1, 1].map((side) => ({
        position: [side * frontWallCenterX, cutawayWallHeight / 2, frontWallZ] as Vector3Tuple,
        size: [frontWallWidth, cutawayWallHeight, wallThickness] as Vector3Tuple,
      })),
    },
    door: {
      position: [0, 0, frontWallZ],
      rotationY: 0,
      openingWidth: doorOpeningWidth,
    },
    toilet: { position: [toiletX, 0, -1_050] },
    support: { position: [toiletX, 0, -1_050], transferSide },
    vanity: {
      position: [vanityWallX, 0, -40],
      rotationY: vanityRotationY,
      width: 820,
      depth: 520,
      counterHeight: 800,
    },
    mirror: {
      position: [vanityWallX, 0, -40],
      rotationY: vanityRotationY,
      width: 820,
      bottomHeight: 900,
    },
    labelPosition: [0, wallHeight - 230, -650],
  };
}

export interface RestroomPreviewFixtureLayout {
  sideWall: {
    position: Vector3Tuple;
    size: Vector3Tuple;
    frontX: number;
  };
  vanity: {
    position: Vector3Tuple;
    rotationY: number;
    width: number;
    depth: number;
    wallClearance: number;
  };
  mirror: {
    position: Vector3Tuple;
    rotationY: number;
    width: number;
    wallClearance: number;
  };
}

export function createRestroomPreviewFixtureLayout(
  roomHeight: number = restroomPreviewRoomHeightLimits.defaultValue,
): RestroomPreviewFixtureLayout {
  const normalizedRoomHeight = normalizeRestroomPreviewRoomHeight(roomHeight);
  const vanityWidth = 1_600;
  const vanityDepth = 560;
  const mirrorWidth = 1_600;
  const wallFrontX = sideWallX + sideWallThickness / 2;
  const fixtureMountX = wallFrontX + wallClearance;

  return {
    sideWall: {
      position: [sideWallX, normalizedRoomHeight / 2, sideWallZ],
      size: [sideWallThickness, normalizedRoomHeight, sideWallDepth],
      frontX: wallFrontX,
    },
    vanity: {
      position: [fixtureMountX + vanityDepth / 2, 0, fixtureCenterZ],
      rotationY: 90,
      width: vanityWidth,
      depth: vanityDepth,
      wallClearance,
    },
    mirror: {
      position: [fixtureMountX, 0, fixtureCenterZ],
      rotationY: 90,
      width: mirrorWidth,
      wallClearance,
    },
  };
}
