import {
  ACTION_CONTEXTS,
  DEFAULT_INPUT_PREFERENCES,
  INPUT_ACTIONS,
  REPEATABLE_UI_ACTIONS,
  cloneInputPreferences,
} from "./defaultBindings";
import {
  applyAxisResponse,
  describeConnectedGamepad,
  readGamepadAxis,
  readGamepadBinding,
} from "./gamepadAdapter";
import type {
  InputActionListener,
  InputActionState,
  InputChangeListener,
  InputContext,
  InputDeviceKind,
  InputDigitalAction,
  InputPreferences,
  PhysicalInputListener,
  SemanticInputRuntime,
  SemanticInputSnapshot,
} from "./types";

function emptyActionStates() {
  return Object.fromEntries(INPUT_ACTIONS.map((action) => [action, {
    held: false,
    heldMs: 0,
    pressed: false,
    released: false,
    repeated: false,
    value: 0,
  } satisfies InputActionState])) as Record<InputDigitalAction, InputActionState>;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function sameConnectedGamepads(
  first: SemanticInputSnapshot["connectedGamepads"],
  second: SemanticInputSnapshot["connectedGamepads"],
) {
  return first.length === second.length && first.every((gamepad, index) => {
    const candidate = second[index];
    return candidate?.id === gamepad.id
      && candidate.index === gamepad.index
      && candidate.mapping === gamepad.mapping;
  });
}

function nativeControlConsumesKey(target: EventTarget | null, code: string) {
  if (!(target instanceof HTMLElement) || code === "Escape") return false;
  const control = target.closest<HTMLElement>("input, textarea, select, [contenteditable='true']");
  if (!control) return false;
  if (control instanceof HTMLTextAreaElement || control.isContentEditable) return true;
  if (control instanceof HTMLSelectElement) {
    return ["ArrowUp", "ArrowDown", "Home", "End", "Enter", "Space"].includes(code);
  }
  if (!(control instanceof HTMLInputElement)) return false;
  if (["text", "search", "email", "url", "tel", "number", "password"].includes(control.type)) {
    return true;
  }
  if (control.type === "range") {
    return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(code);
  }
  return (control.type === "checkbox" || control.type === "radio") && code === "Space";
}

function keyboardBindingActive(binding: string | null, pressedCodes: ReadonlySet<string>) {
  if (!binding) return false;
  if (binding === "Shift+Tab") {
    return pressedCodes.has("Tab")
      && (pressedCodes.has("ShiftLeft") || pressedCodes.has("ShiftRight"));
  }
  if (binding === "Tab") {
    return pressedCodes.has("Tab")
      && !pressedCodes.has("ShiftLeft")
      && !pressedCodes.has("ShiftRight");
  }
  return pressedCodes.has(binding);
}

interface RawGamepadState {
  axes: number[];
  buttons: number[];
  id: string;
}

export class BrowserInputRuntime implements SemanticInputRuntime {
  private actionListeners = new Set<InputActionListener>();
  private attached = false;
  private changeListeners = new Set<InputChangeListener>();
  private contextStack: Array<{ context: Exclude<InputContext, "gameplay">; token: symbol }> = [];
  private frameRequest = 0;
  private gamepads: Gamepad[] = [];
  private heldSince = new Map<InputDigitalAction, number>();
  private keyboardCodes = new Set<string>();
  private lastActiveDevice: InputDeviceKind = "keyboard-mouse";
  private lastGamepadStates = new Map<number, RawGamepadState>();
  private nativeEvent: Event | null = null;
  private nextNoticeSequence = 1;
  private nextRepeatAt = new Map<InputDigitalAction, number>();
  private physicalListeners = new Set<PhysicalInputListener>();
  private preferences: InputPreferences;
  private sequence = 0;
  private snapshot: SemanticInputSnapshot;
  private suppressCapturedActions = false;
  private suppressedActions = new Set<InputDigitalAction>();
  private windowTarget: Window | null = null;

  constructor(preferences: InputPreferences = DEFAULT_INPUT_PREFERENCES) {
    this.preferences = cloneInputPreferences(preferences);
    this.snapshot = {
      actions: emptyActionStates(),
      connectedGamepads: [],
      context: "gameplay",
      lastActiveDevice: this.lastActiveDevice,
      look: { x: 0, y: 0 },
      move: { x: 0, y: 0 },
      notice: null,
      sequence: this.sequence,
    };
  }

  attach(windowTarget: Window = window) {
    if (this.attached) return;
    this.attached = true;
    this.windowTarget = windowTarget;
    windowTarget.addEventListener("keydown", this.handleKeyDown, true);
    windowTarget.addEventListener("keyup", this.handleKeyUp, true);
    windowTarget.addEventListener("blur", this.handleBlur);
    windowTarget.addEventListener("pointerdown", this.handlePointerActivity, true);
    windowTarget.addEventListener("pointermove", this.handlePointerActivity, true);
    windowTarget.addEventListener("gamepadconnected", this.handleGamepadConnection);
    windowTarget.addEventListener("gamepaddisconnected", this.handleGamepadDisconnection);
    this.scheduleFrame();
  }

  activateContext(context: Exclude<InputContext, "gameplay">) {
    const token = Symbol(context);
    this.contextStack.push({ context, token });
    this.recompute(performance.now());
    return () => {
      const nextStack = this.contextStack.filter((entry) => entry.token !== token);
      if (nextStack.length === this.contextStack.length) return;
      this.contextStack = nextStack;
      this.recompute(performance.now());
    };
  }

  getPreferences() {
    return cloneInputPreferences(this.preferences);
  }

  getSnapshot() {
    return this.snapshot;
  }

  setPreferences(preferences: InputPreferences) {
    this.preferences = cloneInputPreferences(preferences);
    this.recompute(performance.now());
  }

  subscribe(listener: InputChangeListener) {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  subscribeAction(listener: InputActionListener) {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  subscribePhysicalInput(listener: PhysicalInputListener) {
    this.physicalListeners.add(listener);
    return () => this.physicalListeners.delete(listener);
  }

  processKeyboardInput(
    code: string,
    pressed: boolean,
    options: { nativeEvent?: Event | null; repeat?: boolean; timestamp?: number } = {},
  ) {
    if (pressed) {
      if (!options.repeat) {
        this.suppressCapturedActions = this.publishPhysicalInput({ code, device: "keyboard" })
          || this.suppressCapturedActions;
      }
      this.keyboardCodes.add(code);
      this.lastActiveDevice = "keyboard-mouse";
    } else {
      this.keyboardCodes.delete(code);
    }
    this.nativeEvent = options.nativeEvent ?? null;
    this.recompute(options.timestamp ?? performance.now());
    this.nativeEvent = null;
  }

  processPointerActivity() {
    if (this.lastActiveDevice === "keyboard-mouse") return;
    this.lastActiveDevice = "keyboard-mouse";
    this.recompute(performance.now());
  }

  pollGamepads(gamepads: ReadonlyArray<Gamepad | null>, timestamp = performance.now()) {
    const nextGamepads = gamepads.filter((gamepad): gamepad is Gamepad => Boolean(gamepad?.connected));
    const previousIds = new Set(this.gamepads.map((gamepad) => `${gamepad.index}:${gamepad.id}`));
    const nextIds = new Set(nextGamepads.map((gamepad) => `${gamepad.index}:${gamepad.id}`));

    for (const gamepad of nextGamepads) {
      const key = `${gamepad.index}:${gamepad.id}`;
      if (!previousIds.has(key)) this.publishNotice("connected", gamepad.id);
      this.publishPhysicalGamepadEdges(gamepad);
    }
    for (const gamepad of this.gamepads) {
      const key = `${gamepad.index}:${gamepad.id}`;
      if (!nextIds.has(key)) {
        this.publishNotice("disconnected", gamepad.id);
        this.lastGamepadStates.delete(gamepad.index);
        if (this.lastActiveDevice === "gamepad") this.lastActiveDevice = "keyboard-mouse";
      }
    }
    this.gamepads = nextGamepads;
    this.recompute(timestamp);
  }

  dispose() {
    if (!this.attached) return;
    this.attached = false;
    const windowTarget = this.windowTarget;
    if (windowTarget) {
      windowTarget.removeEventListener("keydown", this.handleKeyDown, true);
      windowTarget.removeEventListener("keyup", this.handleKeyUp, true);
      windowTarget.removeEventListener("blur", this.handleBlur);
      windowTarget.removeEventListener("pointerdown", this.handlePointerActivity, true);
      windowTarget.removeEventListener("pointermove", this.handlePointerActivity, true);
      windowTarget.removeEventListener("gamepadconnected", this.handleGamepadConnection);
      windowTarget.removeEventListener("gamepaddisconnected", this.handleGamepadDisconnection);
      if (this.frameRequest) windowTarget.cancelAnimationFrame(this.frameRequest);
    }
    this.frameRequest = 0;
    this.windowTarget = null;
    this.actionListeners.clear();
    this.changeListeners.clear();
    this.contextStack = [];
    this.physicalListeners.clear();
    this.keyboardCodes.clear();
    this.gamepads = [];
    this.lastGamepadStates.clear();
  }

  private currentContext(): InputContext {
    return this.contextStack[this.contextStack.length - 1]?.context ?? "gameplay";
  }

  private readKeyboardAction(action: InputDigitalAction) {
    const pair = this.preferences.keyboardBindings[action];
    return keyboardBindingActive(pair.primary, this.keyboardCodes)
      || keyboardBindingActive(pair.alternate, this.keyboardCodes)
      ? 1
      : 0;
  }

  private readGamepadAction(action: InputDigitalAction) {
    const pair = this.preferences.gamepadBindings[action];
    let value = 0;
    for (const gamepad of this.gamepads) {
      for (const binding of [pair.primary, pair.alternate]) {
        const rawValue = readGamepadBinding(gamepad, binding, this.preferences);
        const nextValue = binding?.kind === "axis"
          ? Math.max(0, applyAxisResponse(
              rawValue,
              this.preferences.deadzone,
              this.preferences.responseCurve,
            ))
          : rawValue;
        value = Math.max(value, nextValue);
      }
    }
    return value;
  }

  private readLookVector() {
    let x = 0;
    let y = 0;
    for (const gamepad of this.gamepads) {
      const nextX = applyAxisResponse(
        readGamepadAxis(gamepad, "right-x", this.preferences),
        this.preferences.deadzone,
        this.preferences.responseCurve,
      );
      const nextY = applyAxisResponse(
        readGamepadAxis(gamepad, "right-y", this.preferences),
        this.preferences.deadzone,
        this.preferences.responseCurve,
      );
      if (Math.hypot(nextX, nextY) > Math.hypot(x, y)) {
        x = nextX;
        y = nextY;
      }
    }
    const sensitivity = clamp(this.preferences.lookSensitivity, 0.1, 3);
    return {
      x: clamp(x * sensitivity, -1, 1),
      y: clamp(y * sensitivity * (this.preferences.invertLookY ? -1 : 1), -1, 1),
    };
  }

  private recompute(timestamp: number) {
    const previous = this.snapshot;
    const context = this.currentContext();
    const actionValues = {} as Record<InputDigitalAction, number>;

    for (const action of INPUT_ACTIONS) {
      const allowed = ACTION_CONTEXTS[action].includes(context);
      const keyboardValue = allowed ? this.readKeyboardAction(action) : 0;
      const gamepadValue = allowed ? this.readGamepadAction(action) : 0;
      actionValues[action] = Math.max(keyboardValue, gamepadValue);
    }
    if (context === "menu" && actionValues["open-menu"] > 0.5) {
      actionValues["ui-back"] = 0;
    }

    const look = context === "gameplay" ? this.readLookVector() : { x: 0, y: 0 };
    if (context !== previous.context) {
      for (const action of INPUT_ACTIONS) {
        if (!action.startsWith("move-") && actionValues[action] > 0.5) {
          this.suppressedActions.add(action);
        }
      }
    }
    if (this.suppressCapturedActions) {
      for (const action of INPUT_ACTIONS) {
        if (actionValues[action] > 0.5) this.suppressedActions.add(action);
      }
      this.suppressCapturedActions = false;
    }
    for (const action of [...this.suppressedActions]) {
      if (actionValues[action] > 0.5) actionValues[action] = 0;
      else this.suppressedActions.delete(action);
    }

    const moveSensitivity = clamp(this.preferences.moveSensitivity, 0.1, 2);
    let moveX = (actionValues["move-right"] - actionValues["move-left"]) * moveSensitivity;
    let moveY = (actionValues["move-forward"] - actionValues["move-backward"]) * moveSensitivity;
    const moveMagnitude = Math.hypot(moveX, moveY);
    if (moveMagnitude > 1) {
      moveX /= moveMagnitude;
      moveY /= moveMagnitude;
    }

    let hasEvent = false;
    const actions = {} as Record<InputDigitalAction, InputActionState>;
    for (const action of INPUT_ACTIONS) {
      const value = actionValues[action];
      const previousState = previous.actions[action];
      const held = value > 0.5;
      const pressed = held && !previousState.held;
      const released = !held && previousState.held;
      let repeated = false;
      if (pressed) {
        this.heldSince.set(action, timestamp);
        this.nextRepeatAt.set(action, timestamp + this.preferences.uiRepeatDelayMs);
        this.emitAction(action, "pressed", value, context);
        hasEvent = true;
      } else if (released) {
        this.emitAction(action, "released", value, context);
        this.heldSince.delete(action);
        this.nextRepeatAt.delete(action);
        hasEvent = true;
      } else if (held && REPEATABLE_UI_ACTIONS.has(action)) {
        const nextRepeatAt = this.nextRepeatAt.get(action) ?? Infinity;
        if (timestamp >= nextRepeatAt) {
          repeated = true;
          this.nextRepeatAt.set(
            action,
            timestamp + Math.max(40, this.preferences.uiRepeatIntervalMs),
          );
          this.emitAction(action, "repeat", value, context);
          hasEvent = true;
        }
      }
      actions[action] = {
        held,
        heldMs: held ? Math.max(0, timestamp - (this.heldSince.get(action) ?? timestamp)) : 0,
        pressed,
        released,
        repeated,
        value,
      };
    }

    const connectedGamepads = this.gamepads.map((gamepad) => (
      describeConnectedGamepad(gamepad, this.preferences)
    ));
    const valuesChanged = context !== previous.context
      || this.lastActiveDevice !== previous.lastActiveDevice
      || Math.abs(moveX - previous.move.x) > 0.001
      || Math.abs(moveY - previous.move.y) > 0.001
      || Math.abs(look.x - previous.look.x) > 0.001
      || Math.abs(look.y - previous.look.y) > 0.001
      || !sameConnectedGamepads(connectedGamepads, previous.connectedGamepads)
      || INPUT_ACTIONS.some((action) => (
        Math.abs(actions[action].value - previous.actions[action].value) > 0.001
      ));
    this.sequence += valuesChanged || hasEvent ? 1 : 0;
    this.snapshot = {
      actions,
      connectedGamepads,
      context,
      lastActiveDevice: this.lastActiveDevice,
      look,
      move: { x: moveX, y: moveY },
      notice: this.snapshot.notice,
      sequence: this.sequence,
    };
    if (valuesChanged || hasEvent) {
      for (const listener of this.changeListeners) listener(this.snapshot);
    }
  }

  private emitAction(
    action: InputDigitalAction,
    phase: "pressed" | "released" | "repeat",
    value: number,
    context: InputContext,
  ) {
    const nativeEvent = this.nativeEvent;
    if (phase === "pressed"
      && this.lastActiveDevice === "gamepad"
      && (action === "primary" || action === "ui-confirm")) {
      for (const gamepad of this.gamepads) {
        const actuator = gamepad.vibrationActuator;
        if (!actuator) continue;
        void actuator.playEffect("dual-rumble", {
          duration: 45,
          startDelay: 0,
          strongMagnitude: 0.16,
          weakMagnitude: 0.28,
        }).catch(() => undefined);
      }
    }
    for (const listener of this.actionListeners) {
      listener({
        action,
        context,
        device: this.lastActiveDevice,
        phase,
        preventDefault: () => {
          nativeEvent?.preventDefault();
          nativeEvent?.stopPropagation();
        },
        value,
      });
    }
  }

  private publishNotice(kind: "connected" | "disconnected", deviceId: string) {
    this.snapshot = {
      ...this.snapshot,
      notice: {
        deviceId,
        kind,
        sequence: this.nextNoticeSequence++,
      },
    };
  }

  private publishPhysicalGamepadEdges(gamepad: Gamepad) {
    const previous = this.lastGamepadStates.get(gamepad.index);
    const buttons = gamepad.buttons.map((button) => Math.max(button.value, button.pressed ? 1 : 0));
    const axes = [...gamepad.axes];
    buttons.forEach((value, index) => {
      if (value <= 0.65 || (previous?.buttons[index] ?? 0) > 0.65) return;
      this.suppressCapturedActions = this.publishPhysicalInput({
        device: "gamepad",
        deviceId: gamepad.id,
        index,
        kind: "button",
        mapping: gamepad.mapping,
      }) || this.suppressCapturedActions;
    });
    axes.forEach((value, index) => {
      if (Math.abs(value) <= 0.72 || Math.abs(previous?.axes[index] ?? 0) > 0.72) return;
      this.suppressCapturedActions = this.publishPhysicalInput({
        device: "gamepad",
        deviceId: gamepad.id,
        index,
        kind: "axis",
        mapping: gamepad.mapping,
        value,
      }) || this.suppressCapturedActions;
    });
    const active = buttons.some((value) => value > 0.15)
      || axes.some((value) => Math.abs(value) > this.preferences.deadzone + 0.04);
    const changed = buttons.some((value, index) => Math.abs(value - (previous?.buttons[index] ?? 0)) > 0.04)
      || axes.some((value, index) => Math.abs(value - (previous?.axes[index] ?? 0)) > 0.04);
    if (active && changed) this.lastActiveDevice = "gamepad";
    this.lastGamepadStates.set(gamepad.index, { axes, buttons, id: gamepad.id });
  }

  private scheduleFrame() {
    const windowTarget = this.windowTarget;
    if (!windowTarget || !this.attached) return;
    this.frameRequest = windowTarget.requestAnimationFrame((timestamp) => {
      const gamepads = typeof windowTarget.navigator.getGamepads === "function"
        ? windowTarget.navigator.getGamepads()
        : [];
      this.pollGamepads(gamepads, timestamp);
      this.scheduleFrame();
    });
  }

  private publishPhysicalInput(event: import("./types").PhysicalInputEvent) {
    let handled = false;
    for (const listener of this.physicalListeners) handled = listener(event) === true || handled;
    return handled;
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const context = this.currentContext();
    if (event.metaKey || event.ctrlKey && event.code !== "ControlLeft" && event.code !== "ControlRight") return;
    if (context === "gameplay") {
      const activeElement = event.target instanceof Element ? event.target : document.activeElement;
      const canvasFocused = activeElement instanceof HTMLCanvasElement
        && activeElement.dataset.testid === "model-canvas";
      if (!canvasFocused && document.pointerLockElement === null) return;
    } else if (nativeControlConsumesKey(event.target, event.code)) {
      return;
    }
    this.processKeyboardInput(event.code, true, {
      nativeEvent: event,
      repeat: event.repeat,
      timestamp: event.timeStamp,
    });
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    if (!this.keyboardCodes.has(event.code)) return;
    this.processKeyboardInput(event.code, false, {
      nativeEvent: event,
      timestamp: event.timeStamp,
    });
  };

  private handleBlur = () => {
    if (this.keyboardCodes.size === 0) return;
    this.keyboardCodes.clear();
    this.recompute(performance.now());
  };

  private handlePointerActivity = () => this.processPointerActivity();

  private handleGamepadConnection = (event: GamepadEvent) => {
    this.publishNotice("connected", event.gamepad.id);
  };

  private handleGamepadDisconnection = (event: GamepadEvent) => {
    this.publishNotice("disconnected", event.gamepad.id);
  };
}
