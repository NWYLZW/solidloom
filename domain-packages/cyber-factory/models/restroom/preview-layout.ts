import type { Vector3Tuple } from "@solidloom/shared";
import type { RestroomAccessibleTransferSide } from "./accessible.js";
import { restroomAssetIds } from "./model.js";

const sideWallSize: Vector3Tuple = [70, 2_650, 2_050];
const sideWallPosition: Vector3Tuple = [2_930, 1_325, -260];
const fixtureCenterZ = -370;
const wallClearance = 8;
const stallLeftBoundaryX = -2_320;
const stallWidth = 950;
const womenStallCount = 5;

export type RestroomPreviewRoomType = "men" | "women" | "accessible";
export type RestroomPreviewAssetId = (typeof restroomAssetIds)[keyof typeof restroomAssetIds];

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
): RestroomPreviewStallLayout {
  const stallCount = roomType === "accessible" ? 0 : roomType === "women" ? womenStallCount : 2;
  const resolvedStallWidth = roomType === "women"
    ? (sideWallPosition[0] - stallLeftBoundaryX) / womenStallCount
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
    labelPosition: [labelCenterX, 2_380, -700],
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
): RestroomPreviewAccessibleLayout {
  const roomWidth = 4_200;
  const backWallZ = -1_870;
  const frontWallZ = 1_450;
  const roomDepth = frontWallZ - backWallZ;
  const wallHeight = 2_650;
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
    labelPosition: [0, 2_420, -650],
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

export function createRestroomPreviewFixtureLayout(): RestroomPreviewFixtureLayout {
  const vanityWidth = 1_600;
  const vanityDepth = 560;
  const mirrorWidth = 1_600;
  const wallFrontX = sideWallPosition[0] + sideWallSize[0] / 2;
  const fixtureMountX = wallFrontX + wallClearance;

  return {
    sideWall: {
      position: sideWallPosition,
      size: sideWallSize,
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
