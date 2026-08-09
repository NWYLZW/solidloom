import type { ConnectedGamepad } from "../../../input";

export type GamepadVisualFamily = "asymmetric" | "generic" | "split" | "symmetric";

export function connectedGamepadKey(gamepad: ConnectedGamepad) {
  return `${gamepad.index}:${gamepad.id}`;
}

export function gamepadVisualFamily(id: string): GamepadVisualFamily {
  const normalized = id.toLowerCase();
  if (/playstation|dualsense|dualshock|sony|vendor:\s*054c/.test(normalized)) return "symmetric";
  if (/nintendo|switch|joy-?con|vendor:\s*057e/.test(normalized)) return "split";
  if (/xbox|xinput|microsoft|vendor:\s*045e/.test(normalized)) return "asymmetric";
  return "generic";
}

export function gamepadDisplayName(gamepad: ConnectedGamepad, fallback: string) {
  const name = gamepad.id
    .replace(/\s*\((?:standard gamepad|xinput standard gamepad).*\)$/i, "")
    .replace(/\s*\(vendor:[^)]+\)$/i, "")
    .trim();
  return name || fallback;
}

export function selectedConnectedGamepad(
  gamepads: readonly ConnectedGamepad[],
  selectedKey: string | null,
) {
  return gamepads.find((gamepad) => connectedGamepadKey(gamepad) === selectedKey)
    ?? gamepads[0]
    ?? null;
}

export function adjacentGamepad(
  gamepads: readonly ConnectedGamepad[],
  currentIndex: number,
  key: string,
) {
  if (gamepads.length === 0) return null;
  if (key === "Home") return gamepads[0];
  if (key === "End") return gamepads[gamepads.length - 1];
  if (key === "ArrowLeft") return gamepads[(currentIndex - 1 + gamepads.length) % gamepads.length];
  if (key === "ArrowRight") return gamepads[(currentIndex + 1) % gamepads.length];
  return null;
}
