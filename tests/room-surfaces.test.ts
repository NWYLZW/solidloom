import { describe, expect, it } from "vitest";
import type { RoomShellSource } from "@solidloom/shared";
import { isPointInsideRoomShell, roomSurfaceVisibilityForCamera } from "../apps/web/src/roomSurfaces";

const room: RoomShellSource = {
  kind: "room-shell",
  size: [9600, 2800, 6000],
  wallThickness: 120,
  floorThickness: 160,
  autoHideSurfaces: true,
  door: { width: 980, height: 2200, offsetZ: 1200 },
  window: { fullWall: true, width: 9360, height: 2480, sillHeight: 0, offsetX: 0 },
};

describe("room surface visibility", () => {
  it("keeps every room surface opaque while the camera is inside", () => {
    expect(isPointInsideRoomShell(room, [0, 1500, 0])).toBe(true);
    expect(roomSurfaceVisibilityForCamera(room, [0, 1500, 0])).toEqual([
      true, true, true, true, true, true,
    ]);
  });

  it("only hides near-facing surfaces for an exterior camera", () => {
    expect(isPointInsideRoomShell(room, [0, 1500, -8000])).toBe(false);
    expect(roomSurfaceVisibilityForCamera(room, [0, 1500, -8000])).toEqual([
      true, true, true, false, true, true,
    ]);
  });

  it("keeps all surfaces visible when automatic exterior cutaway is disabled", () => {
    expect(roomSurfaceVisibilityForCamera(
      { ...room, autoHideSurfaces: false },
      [0, 1500, -8000],
    )).toEqual([true, true, true, true, true, true]);
  });
});
