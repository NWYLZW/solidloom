import type { Vector3Tuple } from "@solidloom/shared";
import { restroomAssetIds } from "./model.js";

const sideWallSize: Vector3Tuple = [70, 2_650, 2_050];
const sideWallPosition: Vector3Tuple = [2_930, 1_325, -260];
const fixtureCenterZ = -370;
const wallClearance = 8;
const stallLeftBoundaryX = -2_320;
const stallWidth = 950;

export type RestroomPreviewRoomType = "men" | "women";
export type RestroomPreviewAssetId = (typeof restroomAssetIds)[keyof typeof restroomAssetIds];

export interface RestroomPreviewComposition {
  roomType: RestroomPreviewRoomType;
  assetIds: RestroomPreviewAssetId[];
  urinalControlsEnabled: boolean;
}

export function createRestroomPreviewComposition(
  roomType: RestroomPreviewRoomType,
): RestroomPreviewComposition {
  const assetIds: RestroomPreviewAssetId[] = [
    restroomAssetIds.partition,
    restroomAssetIds.stallDoor,
    restroomAssetIds.toilet,
    restroomAssetIds.vanity,
    restroomAssetIds.mirror,
  ];
  const urinalControlsEnabled = roomType === "men";
  if (urinalControlsEnabled) assetIds.splice(3, 0, restroomAssetIds.urinalBank);

  return { roomType, assetIds, urinalControlsEnabled };
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
  const stallCount = roomType === "women" ? 4 : 2;
  const partitionXs = Array.from(
    { length: stallCount + 1 },
    (_, index) => stallLeftBoundaryX + index * stallWidth,
  );
  const stallCenterXs = Array.from(
    { length: stallCount },
    (_, index) => stallLeftBoundaryX + stallWidth * (index + 0.5),
  );
  const labelCenterX = (partitionXs[0]! + partitionXs.at(-1)!) / 2;

  return {
    stallCount,
    stallWidth,
    partitionXs,
    stallCenterXs,
    partitionZ: -920,
    doorZ: -20,
    toiletZ: -1_120,
    labelPosition: [labelCenterX, 2_380, -700],
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
