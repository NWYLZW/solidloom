import { describe, expect, it } from "vitest";
import type { ConnectedGamepad } from "../../../input";
import {
  adjacentGamepad,
  connectedGamepadKey,
  gamepadDisplayName,
  gamepadVisualFamily,
  selectedConnectedGamepad,
} from "./gamepadPresentation";

function gamepad(id: string, index: number): ConnectedGamepad {
  return { id, index, mapping: "standard" };
}

describe("gamepad presentation", () => {
  it("selects visual families from common browser device identifiers", () => {
    expect(gamepadVisualFamily("Xbox Wireless Controller (XInput STANDARD GAMEPAD)")).toBe("asymmetric");
    expect(gamepadVisualFamily("Wireless Controller (Vendor: 054c Product: 0ce6)")).toBe("symmetric");
    expect(gamepadVisualFamily("Nintendo Switch Pro Controller (Vendor: 057e Product: 2009)")).toBe("split");
    expect(gamepadVisualFamily("USB game controller")).toBe("generic");
  });

  it("keeps a connected selection and falls back to the first device", () => {
    const gamepads = [gamepad("First", 0), gamepad("Second", 1)];
    expect(selectedConnectedGamepad(gamepads, connectedGamepadKey(gamepads[1]!))).toBe(gamepads[1]);
    expect(selectedConnectedGamepad(gamepads, "missing")).toBe(gamepads[0]);
    expect(selectedConnectedGamepad([], null)).toBeNull();
  });

  it("supports wrapping arrow navigation and Home or End", () => {
    const gamepads = [gamepad("First", 0), gamepad("Second", 1), gamepad("Third", 2)];
    expect(adjacentGamepad(gamepads, 0, "ArrowLeft")).toBe(gamepads[2]);
    expect(adjacentGamepad(gamepads, 2, "ArrowRight")).toBe(gamepads[0]);
    expect(adjacentGamepad(gamepads, 1, "Home")).toBe(gamepads[0]);
    expect(adjacentGamepad(gamepads, 1, "End")).toBe(gamepads[2]);
  });

  it("uses a concise browser device name with a fallback", () => {
    expect(gamepadDisplayName(gamepad("Xbox Controller (XInput STANDARD GAMEPAD)", 0), "Gamepad 1"))
      .toBe("Xbox Controller");
    expect(gamepadDisplayName(gamepad("", 0), "Gamepad 1")).toBe("Gamepad 1");
  });
});
