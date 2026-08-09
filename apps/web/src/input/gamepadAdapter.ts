import { gamepadDeviceKey } from "./defaultBindings";
import type {
  ConnectedGamepad,
  CustomGamepadProfile,
  GamepadAxisControl,
  GamepadBinding,
  GamepadButtonControl,
  InputPreferences,
} from "./types";

export const STANDARD_GAMEPAD_BUTTONS: Record<GamepadButtonControl, number> = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  "left-bumper": 4,
  "right-bumper": 5,
  "left-trigger": 6,
  "right-trigger": 7,
  select: 8,
  start: 9,
  "left-stick-button": 10,
  "right-stick-button": 11,
  "dpad-up": 12,
  "dpad-down": 13,
  "dpad-left": 14,
  "dpad-right": 15,
};

export const STANDARD_GAMEPAD_AXES: Record<GamepadAxisControl, number> = {
  "left-x": 0,
  "left-y": 1,
  "right-x": 2,
  "right-y": 3,
};

function resolveProfile(gamepad: Gamepad, preferences: InputPreferences) {
  return gamepad.mapping === "standard"
    ? null
    : preferences.customGamepads[gamepadDeviceKey(gamepad.id)] ?? null;
}

export function describeConnectedGamepad(
  gamepad: Gamepad,
  preferences: InputPreferences,
): ConnectedGamepad {
  const profile = resolveProfile(gamepad, preferences);
  return {
    id: gamepad.id,
    index: gamepad.index,
    mapping: gamepad.mapping === "standard"
      ? "standard"
      : profile ? "custom" : "unconfigured",
  };
}

function buttonIndex(
  control: GamepadButtonControl,
  gamepad: Gamepad,
  profile: CustomGamepadProfile | null,
) {
  return gamepad.mapping === "standard"
    ? STANDARD_GAMEPAD_BUTTONS[control]
    : profile?.buttons[control];
}

function axisMapping(
  control: GamepadAxisControl,
  gamepad: Gamepad,
  profile: CustomGamepadProfile | null,
) {
  return gamepad.mapping === "standard"
    ? { index: STANDARD_GAMEPAD_AXES[control], inverted: false }
    : profile?.axes[control];
}

export function readGamepadAxis(
  gamepad: Gamepad,
  control: GamepadAxisControl,
  preferences: InputPreferences,
) {
  const mapping = axisMapping(control, gamepad, resolveProfile(gamepad, preferences));
  if (!mapping) return 0;
  const value = gamepad.axes[mapping.index] ?? 0;
  return mapping.inverted ? -value : value;
}

export function readGamepadBinding(
  gamepad: Gamepad,
  binding: GamepadBinding | null,
  preferences: InputPreferences,
) {
  if (!binding) return 0;
  const profile = resolveProfile(gamepad, preferences);
  if (binding.kind === "button") {
    const index = buttonIndex(binding.control, gamepad, profile);
    if (index === undefined) return 0;
    const button = gamepad.buttons[index];
    return button ? Math.max(button.value, button.pressed ? 1 : 0) : 0;
  }
  const value = readGamepadAxis(gamepad, binding.control, preferences) * binding.direction;
  return Math.max(0, value);
}

export function applyAxisResponse(
  value: number,
  deadzone: number,
  curve: number,
) {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  const normalized = Math.min(1, (magnitude - deadzone) / Math.max(0.001, 1 - deadzone));
  return Math.sign(value) * Math.pow(normalized, Math.max(0.2, curve));
}

export function standardButtonControl(index: number): GamepadButtonControl | null {
  return (Object.entries(STANDARD_GAMEPAD_BUTTONS) as Array<[GamepadButtonControl, number]>)
    .find(([, buttonIndexValue]) => buttonIndexValue === index)?.[0] ?? null;
}

export function reverseCustomButtonControl(
  profile: CustomGamepadProfile | undefined,
  index: number,
) {
  if (!profile) return null;
  return (Object.entries(profile.buttons) as Array<[GamepadButtonControl, number]>)
    .find(([, buttonIndexValue]) => buttonIndexValue === index)?.[0] ?? null;
}
