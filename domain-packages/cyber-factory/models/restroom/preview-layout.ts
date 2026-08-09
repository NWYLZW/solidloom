import type { Vector3Tuple } from "@solidloom/shared";

const sideWallSize: Vector3Tuple = [70, 2_650, 2_050];
const sideWallPosition: Vector3Tuple = [2_930, 1_325, -260];
const fixtureCenterZ = -370;
const wallClearance = 8;

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
