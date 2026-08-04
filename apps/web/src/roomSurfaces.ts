import type { RoomShellSource, Vector3Tuple } from "@solidloom/shared";

export type RoomSurfaceVisibility = [boolean, boolean, boolean, boolean, boolean, boolean];

const ALL_ROOM_SURFACES_VISIBLE: RoomSurfaceVisibility = [true, true, true, true, true, true];

export function isPointInsideRoomShell(source: RoomShellSource, point: Vector3Tuple): boolean {
  const [width, height, depth] = source.size;
  const tolerance = Math.max(1, Math.max(width, height, depth) * 0.0001);
  return point[0] >= -width / 2 - tolerance
    && point[0] <= width / 2 + tolerance
    && point[1] >= -tolerance
    && point[1] <= height + tolerance
    && point[2] >= -depth / 2 - tolerance
    && point[2] <= depth / 2 + tolerance;
}

export function roomSurfaceVisibilityForCamera(
  source: RoomShellSource,
  cameraPoint: Vector3Tuple,
): RoomSurfaceVisibility {
  if (!source.autoHideSurfaces || isPointInsideRoomShell(source, cameraPoint)) {
    return [...ALL_ROOM_SURFACES_VISIBLE];
  }

  const direction: Vector3Tuple = [
    cameraPoint[0],
    cameraPoint[1] - source.size[1] / 2,
    cameraPoint[2],
  ];
  const length = Math.hypot(...direction);
  if (length <= 0.000001) return [...ALL_ROOM_SURFACES_VISIBLE];

  const normalized = direction.map((value) => value / length) as Vector3Tuple;
  const visibility: RoomSurfaceVisibility = [...ALL_ROOM_SURFACES_VISIBLE];
  if (Math.abs(normalized[1]) > 0.12) visibility[normalized[1] > 0 ? 1 : 0] = false;
  if (Math.abs(normalized[2]) > 0.12) visibility[normalized[2] > 0 ? 2 : 3] = false;
  if (Math.abs(normalized[0]) > 0.12) visibility[normalized[0] > 0 ? 5 : 4] = false;
  return visibility;
}
