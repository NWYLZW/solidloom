import type {
  GamepadAxisControl,
  GamepadBinding,
  GamepadButtonControl,
  InputContext,
  InputDigitalAction,
  InputPreferences,
} from "./types";

const keyPair = (primary: string | null, alternate: string | null = null) => ({
  alternate,
  primary,
});

const buttonPair = (
  primary: GamepadButtonControl | null,
  alternate: GamepadButtonControl | null = null,
) => ({
  alternate: alternate ? { control: alternate, kind: "button" as const } : null,
  primary: primary ? { control: primary, kind: "button" as const } : null,
});

const axisPair = (
  primary: GamepadAxisControl,
  direction: -1 | 1,
): { alternate: null; primary: GamepadBinding } => ({
  alternate: null,
  primary: { control: primary, direction, kind: "axis" },
});

export const INPUT_ACTIONS: InputDigitalAction[] = [
  "move-forward",
  "move-backward",
  "move-left",
  "move-right",
  "jump",
  "sprint",
  "crouch",
  "primary",
  "secondary",
  "open-menu",
  "ui-up",
  "ui-down",
  "ui-left",
  "ui-right",
  "ui-next",
  "ui-previous",
  "ui-confirm",
  "ui-back",
  "ui-page-next",
  "ui-page-previous",
];

export const REPEATABLE_UI_ACTIONS = new Set<InputDigitalAction>([
  "ui-up",
  "ui-down",
  "ui-left",
  "ui-right",
  "ui-next",
  "ui-previous",
  "ui-page-next",
  "ui-page-previous",
]);

export const ACTION_CONTEXTS: Record<InputDigitalAction, InputContext[]> = {
  "move-forward": ["gameplay", "device"],
  "move-backward": ["gameplay", "device"],
  "move-left": ["gameplay", "device"],
  "move-right": ["gameplay", "device"],
  jump: ["gameplay"],
  sprint: ["gameplay"],
  crouch: ["gameplay"],
  primary: ["gameplay"],
  secondary: ["gameplay"],
  "open-menu": ["gameplay", "menu"],
  "ui-up": ["device", "menu"],
  "ui-down": ["device", "menu"],
  "ui-left": ["device", "menu"],
  "ui-right": ["device", "menu"],
  "ui-next": ["device", "menu"],
  "ui-previous": ["device", "menu"],
  "ui-confirm": ["device", "menu"],
  "ui-back": ["device", "menu"],
  "ui-page-next": ["device", "menu"],
  "ui-page-previous": ["device", "menu"],
};

export const DEFAULT_INPUT_PREFERENCES: InputPreferences = {
  customGamepads: {},
  deadzone: 0.16,
  gamepadBindings: {
    "move-forward": axisPair("left-y", -1),
    "move-backward": axisPair("left-y", 1),
    "move-left": axisPair("left-x", -1),
    "move-right": axisPair("left-x", 1),
    jump: buttonPair("right-bumper"),
    sprint: buttonPair("left-stick-button"),
    crouch: buttonPair("right-stick-button"),
    primary: buttonPair("south"),
    secondary: buttonPair("west"),
    "open-menu": buttonPair("start"),
    "ui-up": buttonPair("dpad-up"),
    "ui-down": buttonPair("dpad-down"),
    "ui-left": buttonPair("dpad-left"),
    "ui-right": buttonPair("dpad-right"),
    "ui-next": buttonPair("right-bumper"),
    "ui-previous": buttonPair("left-bumper"),
    "ui-confirm": buttonPair("south"),
    "ui-back": buttonPair("east"),
    "ui-page-next": buttonPair("right-trigger"),
    "ui-page-previous": buttonPair("left-trigger"),
  },
  invertLookY: false,
  keyboardBindings: {
    "move-forward": keyPair("KeyW"),
    "move-backward": keyPair("KeyS"),
    "move-left": keyPair("KeyA"),
    "move-right": keyPair("KeyD"),
    jump: keyPair("Space"),
    sprint: keyPair("ShiftLeft", "ShiftRight"),
    crouch: keyPair("ControlLeft", "ControlRight"),
    primary: keyPair("KeyE", "Enter"),
    secondary: keyPair("KeyF"),
    "open-menu": keyPair("Escape"),
    "ui-up": keyPair("ArrowUp"),
    "ui-down": keyPair("ArrowDown"),
    "ui-left": keyPair("ArrowLeft"),
    "ui-right": keyPair("ArrowRight"),
    "ui-next": keyPair("Tab"),
    "ui-previous": keyPair("Shift+Tab"),
    "ui-confirm": keyPair("Enter", "KeyE"),
    "ui-back": keyPair("Escape"),
    "ui-page-next": keyPair("PageDown"),
    "ui-page-previous": keyPair("PageUp"),
  },
  lookSensitivity: 1,
  moveSensitivity: 1,
  responseCurve: 1.45,
  uiRepeatDelayMs: 360,
  uiRepeatIntervalMs: 105,
};

export function cloneInputPreferences(
  preferences: InputPreferences = DEFAULT_INPUT_PREFERENCES,
): InputPreferences {
  return {
    ...preferences,
    customGamepads: Object.fromEntries(Object.entries(preferences.customGamepads).map(([id, profile]) => [
      id,
      {
        ...profile,
        axes: { ...profile.axes },
        buttons: { ...profile.buttons },
      },
    ])),
    gamepadBindings: Object.fromEntries(INPUT_ACTIONS.map((action) => [
      action,
      {
        alternate: preferences.gamepadBindings[action].alternate
          ? { ...preferences.gamepadBindings[action].alternate }
          : null,
        primary: preferences.gamepadBindings[action].primary
          ? { ...preferences.gamepadBindings[action].primary }
          : null,
      },
    ])) as InputPreferences["gamepadBindings"],
    keyboardBindings: Object.fromEntries(INPUT_ACTIONS.map((action) => [
      action,
      { ...preferences.keyboardBindings[action] },
    ])) as InputPreferences["keyboardBindings"],
  };
}

export function gamepadDeviceKey(id: string) {
  return id.trim().toLowerCase().replace(/\s+/g, " ");
}
