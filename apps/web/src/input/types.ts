export type InputContext = "gameplay" | "device" | "menu";

export type InputDeviceKind = "keyboard-mouse" | "gamepad" | "touch";

export type InputDigitalAction =
  | "move-forward"
  | "move-backward"
  | "move-left"
  | "move-right"
  | "jump"
  | "sprint"
  | "crouch"
  | "primary"
  | "secondary"
  | "open-menu"
  | "ui-up"
  | "ui-down"
  | "ui-left"
  | "ui-right"
  | "ui-next"
  | "ui-previous"
  | "ui-confirm"
  | "ui-back"
  | "ui-page-next"
  | "ui-page-previous";

export type InputAction = InputDigitalAction | "move" | "look";

export type GamepadButtonControl =
  | "south"
  | "east"
  | "west"
  | "north"
  | "left-bumper"
  | "right-bumper"
  | "left-trigger"
  | "right-trigger"
  | "select"
  | "start"
  | "left-stick-button"
  | "right-stick-button"
  | "dpad-up"
  | "dpad-down"
  | "dpad-left"
  | "dpad-right";

export type GamepadAxisControl = "left-x" | "left-y" | "right-x" | "right-y";

export interface BindingPair<T> {
  alternate: T | null;
  primary: T | null;
}

export interface GamepadButtonBinding {
  control: GamepadButtonControl;
  kind: "button";
}

export interface GamepadAxisBinding {
  control: GamepadAxisControl;
  direction: -1 | 1;
  kind: "axis";
}

export type GamepadBinding = GamepadButtonBinding | GamepadAxisBinding;

export interface CustomGamepadAxisMapping {
  index: number;
  inverted: boolean;
}

export interface CustomGamepadProfile {
  axes: Partial<Record<GamepadAxisControl, CustomGamepadAxisMapping>>;
  buttons: Partial<Record<GamepadButtonControl, number>>;
  updatedAt: number;
}

export interface InputPreferences {
  customGamepads: Record<string, CustomGamepadProfile>;
  deadzone: number;
  gamepadBindings: Record<InputDigitalAction, BindingPair<GamepadBinding>>;
  invertLookY: boolean;
  keyboardBindings: Record<InputDigitalAction, BindingPair<string>>;
  lookSensitivity: number;
  moveSensitivity: number;
  responseCurve: number;
  uiRepeatDelayMs: number;
  uiRepeatIntervalMs: number;
}

export interface InputActionState {
  held: boolean;
  heldMs: number;
  pressed: boolean;
  released: boolean;
  repeated: boolean;
  value: number;
}

export interface ConnectedGamepad {
  id: string;
  index: number;
  mapping: "custom" | "standard" | "unconfigured";
}

export interface InputDeviceNotice {
  deviceId: string;
  kind: "connected" | "disconnected";
  sequence: number;
}

export interface SemanticInputSnapshot {
  actions: Record<InputDigitalAction, InputActionState>;
  connectedGamepads: ConnectedGamepad[];
  context: InputContext;
  lastActiveDevice: InputDeviceKind;
  look: { x: number; y: number };
  move: { x: number; y: number };
  notice: InputDeviceNotice | null;
  sequence: number;
}

export interface SemanticInputEvent {
  action: InputDigitalAction;
  context: InputContext;
  device: InputDeviceKind;
  phase: "pressed" | "released" | "repeat";
  preventDefault: () => void;
  value: number;
}

export interface ExternalSemanticInputState {
  actions?: Partial<Record<InputDigitalAction, number>>;
  device: InputDeviceKind;
  lookDelta?: { x: number; y: number };
  move?: { x: number; y: number };
}

export type PhysicalInputEvent =
  | {
      code: string;
      device: "keyboard";
    }
  | {
      device: "gamepad";
      deviceId: string;
      index: number;
      kind: "button";
      mapping: Gamepad["mapping"];
    }
  | {
      device: "gamepad";
      deviceId: string;
      index: number;
      kind: "axis";
      mapping: Gamepad["mapping"];
      value: number;
    };

export type InputActionListener = (event: SemanticInputEvent) => void;
export type InputChangeListener = (snapshot: SemanticInputSnapshot) => void;
export type PhysicalInputListener = (event: PhysicalInputEvent) => boolean | void;

export interface SemanticInputRuntime {
  activateContext: (context: Exclude<InputContext, "gameplay">) => () => void;
  clearExternalInput: (sourceId: string) => void;
  consumeLookDelta: () => { x: number; y: number };
  dispose: () => void;
  getPreferences: () => InputPreferences;
  getSnapshot: () => SemanticInputSnapshot;
  setPreferences: (preferences: InputPreferences) => void;
  subscribe: (listener: InputChangeListener) => () => void;
  subscribeAction: (listener: InputActionListener) => () => void;
  subscribePhysicalInput: (listener: PhysicalInputListener) => () => void;
  updateExternalInput: (sourceId: string, state: ExternalSemanticInputState) => void;
}
