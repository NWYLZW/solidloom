import { Gamepad2, Keyboard, RotateCcw } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ACTION_CONTEXTS,
  DEFAULT_INPUT_PREFERENCES,
  INPUT_ACTIONS,
  STANDARD_GAMEPAD_AXES,
  cloneInputPreferences,
  gamepadDeviceKey,
  reverseCustomButtonControl,
  standardButtonControl,
  type GamepadAxisControl,
  type GamepadBinding,
  type GamepadButtonControl,
  type InputDigitalAction,
  type InputPreferences,
  type PhysicalInputEvent,
  useInputRuntime,
  useInputSnapshot,
} from "../../../input";
import type { EditorLocale } from "../../editor/editorCopy";
import { connectedGamepadKey, selectedConnectedGamepad } from "./gamepadPresentation";
import { PlayBindingField } from "./PlayBindingField";
import { PlayGamepadSelector } from "./PlayGamepadSelector";
import { PlayRangeField } from "./PlayRangeField";
import { PlayToggleField } from "./PlayToggleField";
import "./PlayControlsSettings.css";

type BindingDevice = "keyboard" | "gamepad";
type BindingSlot = "primary" | "alternate";

interface BindingTarget {
  action: InputDigitalAction;
  device: BindingDevice;
  slot: BindingSlot;
}

interface CalibrationTarget {
  control: GamepadAxisControl | GamepadButtonControl;
  kind: "axis" | "button";
}

interface PendingConflict {
  binding: GamepadBinding | string;
  conflicts: Array<{ action: InputDigitalAction; slot: BindingSlot }>;
  target: BindingTarget;
}

const ACTION_GROUPS: Array<{
  actions: InputDigitalAction[];
  id: "movement" | "interaction" | "interface";
}> = [
  {
    actions: ["move-forward", "move-backward", "move-left", "move-right", "jump", "sprint", "crouch"],
    id: "movement",
  },
  { actions: ["primary", "secondary", "open-menu"], id: "interaction" },
  {
    actions: [
      "ui-up", "ui-down", "ui-left", "ui-right", "ui-next", "ui-previous",
      "ui-confirm", "ui-back", "ui-page-next", "ui-page-previous",
    ],
    id: "interface",
  },
];

const GAMEPAD_BUTTON_LABELS: Record<GamepadButtonControl, string> = {
  south: "A / ✕",
  east: "B / ○",
  west: "X / □",
  north: "Y / △",
  "left-bumper": "LB / L1",
  "right-bumper": "RB / R1",
  "left-trigger": "LT / L2",
  "right-trigger": "RT / R2",
  select: "View / Create",
  start: "Menu / Options",
  "left-stick-button": "L3",
  "right-stick-button": "R3",
  "dpad-up": "十字键 ↑",
  "dpad-down": "十字键 ↓",
  "dpad-left": "十字键 ←",
  "dpad-right": "十字键 →",
};

const GAMEPAD_AXIS_LABELS: Record<GamepadAxisControl, string> = {
  "left-x": "左摇杆横向",
  "left-y": "左摇杆纵向",
  "right-x": "右摇杆横向",
  "right-y": "右摇杆纵向",
};

const CALIBRATION_TARGETS: CalibrationTarget[] = [
  { control: "left-x", kind: "axis" },
  { control: "left-y", kind: "axis" },
  { control: "right-x", kind: "axis" },
  { control: "right-y", kind: "axis" },
  { control: "south", kind: "button" },
  { control: "east", kind: "button" },
];

function bindingEqual(first: GamepadBinding | string, second: GamepadBinding | string | null) {
  if (second === null || typeof first !== typeof second) return false;
  if (typeof first === "string") return first === second;
  if (typeof second === "string") return false;
  return first.kind === second.kind
    && first.control === second.control
    && (first.kind === "button" || second.kind === "button" || first.direction === second.direction);
}

function contextsOverlap(first: InputDigitalAction, second: InputDigitalAction) {
  return ACTION_CONTEXTS[first].some((context) => ACTION_CONTEXTS[second].includes(context));
}

function keyLabel(code: string | null, empty: string) {
  if (!code) return empty;
  return code
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace("Arrow", "")
    .replace("Control", "Ctrl ")
    .replace("ShiftLeft", "左 Shift")
    .replace("ShiftRight", "右 Shift")
    .replace("PageDown", "Page Down")
    .replace("PageUp", "Page Up");
}

function gamepadBindingLabel(binding: GamepadBinding | null, empty: string) {
  if (!binding) return empty;
  if (binding.kind === "button") return GAMEPAD_BUTTON_LABELS[binding.control];
  const direction = binding.direction > 0 ? "+" : "−";
  return `${GAMEPAD_AXIS_LABELS[binding.control]} ${direction}`;
}

function axisControlFromStandardIndex(index: number) {
  return (Object.entries(STANDARD_GAMEPAD_AXES) as Array<[GamepadAxisControl, number]>)
    .find(([, axisIndex]) => axisIndex === index)?.[0] ?? null;
}

function copyFor(locale: EditorLocale) {
  if (locale === "en") {
    return {
      actionLabels: {
        "move-forward": "Move forward", "move-backward": "Move backward", "move-left": "Move left",
        "move-right": "Move right", jump: "Jump", sprint: "Sprint", crouch: "Crouch",
        primary: "Primary interaction", secondary: "Secondary interaction", "open-menu": "Open menu",
        "ui-up": "Focus up", "ui-down": "Focus down", "ui-left": "Focus left", "ui-right": "Focus right",
        "ui-next": "Next focus", "ui-previous": "Previous focus", "ui-confirm": "Confirm", "ui-back": "Back",
        "ui-page-next": "Next page", "ui-page-previous": "Previous page",
      } satisfies Record<InputDigitalAction, string>,
      calibration: "Custom mapping calibration",
      calibrationDescription: "Move the requested stick direction or press the requested button.",
      cancel: "Cancel",
      camera: "Camera",
      conflict: "This binding is already used in the same input context.",
      connectGamepad: "Connect a gamepad to adjust its controls and button mapping.",
      controlsReset: "Restore all defaults",
      custom: "Custom mapping",
      deadzone: "Stick deadzone",
      deviceNone: "No gamepad connected",
      empty: "Unassigned",
      gamepad: "Gamepad",
      inputDelay: "Initial UI repeat delay",
      inputDevices: "Input devices",
      inputRepeat: "UI repeat interval",
      interface: "Interface",
      interaction: "Interaction",
      invertY: "Invert look Y axis",
      keyboard: "Keyboard",
      lookSensitivity: "Look sensitivity",
      movement: "Movement",
      moveSensitivity: "Movement sensitivity",
      replace: "Replace binding",
      reset: "Restore action default",
      responseCurve: "Stick response curve",
      standard: "Standard mapping",
      unconfigured: "Needs custom calibration",
      waiting: "Waiting for input…",
    };
  }
  return {
    actionLabels: {
      "move-forward": "向前移动", "move-backward": "向后移动", "move-left": "向左移动",
      "move-right": "向右移动", jump: "跳跃", sprint: "奔跑", crouch: "蹲下",
      primary: "主要交互", secondary: "次要交互", "open-menu": "打开菜单",
      "ui-up": "焦点向上", "ui-down": "焦点向下", "ui-left": "焦点向左", "ui-right": "焦点向右",
      "ui-next": "下一焦点", "ui-previous": "上一焦点", "ui-confirm": "确认", "ui-back": "返回",
      "ui-page-next": "下一页", "ui-page-previous": "上一页",
    } satisfies Record<InputDigitalAction, string>,
    calibration: "自定义映射校准",
    calibrationDescription: "按提示推动摇杆方向或按下按钮，映射按设备标识保存在本机。",
    cancel: "取消",
    camera: "镜头",
    conflict: "该输入已在同一输入上下文中使用。",
    connectGamepad: "连接手柄后即可调整操控手感和按键映射。",
    controlsReset: "整套恢复默认",
    custom: "自定义映射",
    deadzone: "摇杆死区",
    deviceNone: "未连接手柄",
    empty: "未绑定",
    gamepad: "手柄",
    inputDelay: "界面连发等待",
    inputDevices: "输入设备",
    inputRepeat: "界面连发间隔",
    interface: "界面",
    interaction: "交互",
    invertY: "反转观察 Y 轴",
    keyboard: "键盘",
    lookSensitivity: "观察灵敏度",
    movement: "移动",
    moveSensitivity: "移动灵敏度",
    replace: "替换绑定",
    reset: "恢复动作默认",
    responseCurve: "摇杆响应曲线",
    standard: "标准映射",
    unconfigured: "需要自定义校准",
    waiting: "等待输入…",
  };
}

interface PlayControlsSettingsProps {
  locale: EditorLocale;
  onChange: (preferences: InputPreferences) => void;
  preferences: InputPreferences;
}

export function PlayControlsSettings({ locale, onChange, preferences }: PlayControlsSettingsProps) {
  const runtime = useInputRuntime();
  const snapshot = useInputSnapshot();
  const copy = copyFor(locale);
  const [bindingTarget, setBindingTarget] = useState<BindingTarget | null>(null);
  const [calibrationTarget, setCalibrationTarget] = useState<CalibrationTarget | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [activeDevice, setActiveDevice] = useState<BindingDevice>("keyboard");
  const [selectedGamepadKey, setSelectedGamepadKey] = useState<string | null>(null);
  const keyboardTabRef = useRef<HTMLButtonElement>(null);
  const gamepadTabRef = useRef<HTMLButtonElement>(null);
  const tabIdPrefix = useId();
  const currentGamepad = selectedConnectedGamepad(snapshot.connectedGamepads, selectedGamepadKey);
  const currentProfile = currentGamepad
    ? preferences.customGamepads[gamepadDeviceKey(currentGamepad.id)]
    : undefined;

  useEffect(() => {
    const resolvedKey = currentGamepad ? connectedGamepadKey(currentGamepad) : null;
    if (resolvedKey !== selectedGamepadKey) setSelectedGamepadKey(resolvedKey);
  }, [currentGamepad, selectedGamepadKey]);

  const findConflicts = (
    target: BindingTarget,
    binding: GamepadBinding | string,
  ) => INPUT_ACTIONS.flatMap((action) => {
    if (action === target.action || !contextsOverlap(action, target.action)) return [];
    const pair = target.device === "keyboard"
      ? preferences.keyboardBindings[action]
      : preferences.gamepadBindings[action];
    return (["primary", "alternate"] as BindingSlot[])
      .filter((slot) => bindingEqual(binding, pair[slot]))
      .map((slot) => ({ action, slot }));
  });

  const applyBinding = (
    target: BindingTarget,
    binding: GamepadBinding | string,
    clearConflicts: Array<{ action: InputDigitalAction; slot: BindingSlot }> = [],
  ) => {
    const next = cloneInputPreferences(preferences);
    const bindings = target.device === "keyboard"
      ? next.keyboardBindings
      : next.gamepadBindings;
    for (const conflict of clearConflicts) {
      (bindings[conflict.action] as typeof bindings[InputDigitalAction])[conflict.slot] = null;
    }
    if (target.device === "keyboard" && typeof binding === "string") {
      next.keyboardBindings[target.action][target.slot] = binding;
    } else if (target.device === "gamepad" && typeof binding !== "string") {
      next.gamepadBindings[target.action][target.slot] = binding;
    }
    onChange(next);
    setBindingTarget(null);
    setPendingConflict(null);
    setCaptureMessage(null);
  };

  const proposeBinding = (target: BindingTarget, binding: GamepadBinding | string) => {
    const conflicts = findConflicts(target, binding);
    if (conflicts.length > 0) {
      setPendingConflict({ binding, conflicts, target });
      return;
    }
    applyBinding(target, binding);
  };

  const gamepadBindingFromPhysical = (event: Extract<PhysicalInputEvent, { device: "gamepad" }>) => {
    if (event.kind === "button") {
      const control = event.mapping === "standard"
        ? standardButtonControl(event.index)
        : reverseCustomButtonControl(currentProfile, event.index);
      return control ? { control, kind: "button" as const } : null;
    }
    const control = event.mapping === "standard"
      ? axisControlFromStandardIndex(event.index)
      : (Object.entries(currentProfile?.axes ?? {}) as Array<[
          GamepadAxisControl,
          { index: number; inverted: boolean },
        ]>).find(([, mapping]) => mapping.index === event.index)?.[0] ?? null;
    if (!control) return null;
    const inverted = event.mapping === "standard" ? false : currentProfile?.axes[control]?.inverted;
    const direction: -1 | 1 = Math.sign(event.value) * (inverted ? -1 : 1) >= 0 ? 1 : -1;
    return { control, direction, kind: "axis" as const };
  };

  const applyCalibration = (
    target: CalibrationTarget,
    event: Extract<PhysicalInputEvent, { device: "gamepad" }>,
  ) => {
    if (!currentGamepad || event.deviceId !== currentGamepad.id || event.kind !== target.kind) return;
    const next = cloneInputPreferences(preferences);
    const key = gamepadDeviceKey(currentGamepad.id);
    const profile = next.customGamepads[key] ?? { axes: {}, buttons: {}, updatedAt: Date.now() };
    if (target.kind === "button" && event.kind === "button") {
      profile.buttons[target.control as GamepadButtonControl] = event.index;
    } else if (target.kind === "axis" && event.kind === "axis") {
      profile.axes[target.control as GamepadAxisControl] = {
        index: event.index,
        inverted: event.value < 0,
      };
    }
    profile.updatedAt = Date.now();
    next.customGamepads[key] = profile;
    onChange(next);
    setCalibrationTarget(null);
    setCaptureMessage(null);
  };

  useEffect(() => {
    if (!bindingTarget && !calibrationTarget) return undefined;
    return runtime.subscribePhysicalInput((event) => {
      if (calibrationTarget) {
        if (event.device === "gamepad") applyCalibration(calibrationTarget, event);
        return true;
      }
      const target = bindingTarget;
      if (!target) return false;
      if (target.device === "keyboard" && event.device === "keyboard") {
        if (event.code === "Escape") {
          setBindingTarget(null);
          return true;
        }
        proposeBinding(target, event.code === "Tab" && snapshot.actions["ui-previous"].held
          ? "Shift+Tab"
          : event.code);
        return true;
      }
      if (target.device !== "gamepad" || event.device !== "gamepad") return false;
      const binding = gamepadBindingFromPhysical(event);
      if (!binding) {
        setCaptureMessage(copy.unconfigured);
        return true;
      }
      proposeBinding(target, binding);
      return true;
    });
  }, [bindingTarget, calibrationTarget, currentGamepad?.id, currentProfile, preferences, runtime]);

  const categoryContent = useMemo(() => ({
    interface: copy.interface,
    interaction: copy.interaction,
    movement: copy.movement,
  }), [copy.interface, copy.interaction, copy.movement]);

  const renderBindings = (device: BindingDevice) => ACTION_GROUPS.map((group) => (
    <section className="play-controls-group" key={`${device}-${group.id}`}>
      <h4>{categoryContent[group.id]}</h4>
      {group.actions.map((action) => {
        const pair = device === "keyboard"
          ? preferences.keyboardBindings[action]
          : preferences.gamepadBindings[action];
        return (
          <PlayBindingField
            alternateLabel={device === "keyboard"
              ? keyLabel(pair.alternate as string | null, copy.empty)
              : gamepadBindingLabel(pair.alternate as GamepadBinding | null, copy.empty)}
            key={`${device}-${action}`}
            label={copy.actionLabels[action]}
            onCaptureAlternate={() => {
              setPendingConflict(null);
              setBindingTarget({ action, device, slot: "alternate" });
            }}
            onCapturePrimary={() => {
              setPendingConflict(null);
              setBindingTarget({ action, device, slot: "primary" });
            }}
            onReset={() => {
              const next = cloneInputPreferences(preferences);
              if (device === "keyboard") {
                next.keyboardBindings[action] = {
                  ...DEFAULT_INPUT_PREFERENCES.keyboardBindings[action],
                };
              } else {
                next.gamepadBindings[action] = {
                  alternate: DEFAULT_INPUT_PREFERENCES.gamepadBindings[action].alternate
                    ? { ...DEFAULT_INPUT_PREFERENCES.gamepadBindings[action].alternate }
                    : null,
                  primary: DEFAULT_INPUT_PREFERENCES.gamepadBindings[action].primary
                    ? { ...DEFAULT_INPUT_PREFERENCES.gamepadBindings[action].primary }
                    : null,
                };
              }
              onChange(next);
            }}
            primaryLabel={device === "keyboard"
              ? keyLabel(pair.primary as string | null, copy.empty)
              : gamepadBindingLabel(pair.primary as GamepadBinding | null, copy.empty)}
            resetLabel={copy.reset}
            waitingAlternate={bindingTarget?.device === device
              && bindingTarget.action === action && bindingTarget.slot === "alternate"}
            waitingLabel={copy.waiting}
            waitingPrimary={bindingTarget?.device === device
              && bindingTarget.action === action && bindingTarget.slot === "primary"}
          />
        );
      })}
    </section>
  ));

  const clearPendingInput = () => {
    setBindingTarget(null);
    setCalibrationTarget(null);
    setPendingConflict(null);
    setCaptureMessage(null);
  };

  const selectDevice = (device: BindingDevice, focus = false) => {
    setActiveDevice(device);
    clearPendingInput();
    if (focus) {
      (device === "keyboard" ? keyboardTabRef : gamepadTabRef).current?.focus();
    }
  };

  const selectGamepad = (gamepad: typeof snapshot.connectedGamepads[number]) => {
    setSelectedGamepadKey(connectedGamepadKey(gamepad));
    clearPendingInput();
  };

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    device: BindingDevice,
  ) => {
    let nextDevice: BindingDevice | null = null;
    if (event.key === "Home") nextDevice = "keyboard";
    if (event.key === "End") nextDevice = "gamepad";
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      nextDevice = device === "keyboard" ? "gamepad" : "keyboard";
    }
    if (!nextDevice) return;
    event.preventDefault();
    selectDevice(nextDevice, true);
  };

  const keyboardTabId = `${tabIdPrefix}-keyboard-tab`;
  const keyboardPanelId = `${tabIdPrefix}-keyboard-panel`;
  const gamepadTabId = `${tabIdPrefix}-gamepad-tab`;
  const gamepadPanelId = `${tabIdPrefix}-gamepad-panel`;

  return (
    <div className="play-controls-settings">
      <div className="play-controls-toolbar">
        <div
          aria-label={copy.inputDevices}
          className="play-controls-tabs"
          role="tablist"
        >
          <button
            aria-controls={keyboardPanelId}
            aria-selected={activeDevice === "keyboard"}
            id={keyboardTabId}
            onClick={() => selectDevice("keyboard")}
            onKeyDown={(event) => handleTabKeyDown(event, "keyboard")}
            ref={keyboardTabRef}
            role="tab"
            tabIndex={activeDevice === "keyboard" ? 0 : -1}
            type="button"
          >
            <Keyboard aria-hidden="true" size={17} />
            <span>{copy.keyboard}</span>
          </button>
          <button
            aria-controls={gamepadPanelId}
            aria-selected={activeDevice === "gamepad"}
            id={gamepadTabId}
            onClick={() => selectDevice("gamepad")}
            onKeyDown={(event) => handleTabKeyDown(event, "gamepad")}
            ref={gamepadTabRef}
            role="tab"
            tabIndex={activeDevice === "gamepad" ? 0 : -1}
            type="button"
          >
            <Gamepad2 aria-hidden="true" size={17} />
            <span>{copy.gamepad}</span>
          </button>
        </div>
        <button
          className="play-controls-reset"
          type="button"
          onClick={() => onChange(cloneInputPreferences())}
        >
          <RotateCcw aria-hidden="true" size={15} />
          <span>{copy.controlsReset}</span>
        </button>
      </div>

      {(bindingTarget || calibrationTarget) && (
        <div className="play-controls-capture" role="status">
          <span>{captureMessage ?? copy.waiting}</span>
          <button type="button" onClick={() => {
            setBindingTarget(null);
            setCalibrationTarget(null);
            setPendingConflict(null);
            setCaptureMessage(null);
          }}>{copy.cancel}</button>
        </div>
      )}

      {pendingConflict && (
        <div className="play-controls-conflict" role="alert">
          <span>{copy.conflict}</span>
          <div>
            <button type="button" onClick={() => applyBinding(
              pendingConflict.target,
              pendingConflict.binding,
              pendingConflict.conflicts,
            )}>{copy.replace}</button>
            <button type="button" onClick={() => setPendingConflict(null)}>{copy.cancel}</button>
          </div>
        </div>
      )}

      {activeDevice === "keyboard" && (
        <section
          aria-labelledby={keyboardTabId}
          className="play-controls-section"
          id={keyboardPanelId}
          role="tabpanel"
        >
          {renderBindings("keyboard")}
        </section>
      )}

      {activeDevice === "gamepad" && (
        <section
          aria-labelledby={gamepadTabId}
          className="play-controls-section"
          id={gamepadPanelId}
          role="tabpanel"
        >
          {!currentGamepad ? (
            <div className="play-gamepad-empty" role="status">
              <Gamepad2 aria-hidden="true" size={22} />
              <span>
                <strong>{copy.deviceNone}</strong>
                <small>{copy.connectGamepad}</small>
              </span>
            </div>
          ) : (
            <>
              <PlayGamepadSelector
                gamepads={snapshot.connectedGamepads}
                locale={locale}
                onSelect={selectGamepad}
                selectedKey={connectedGamepadKey(currentGamepad)}
              />
              <section className="play-controls-group">
                <h4>{copy.camera}</h4>
                <div className="play-controls-tuning">
                  <PlayRangeField label={copy.deadzone} minimum={0} maximum={35} suffix="%"
                    value={Math.round(preferences.deadzone * 100)}
                    onChange={(value) => onChange({ ...preferences, deadzone: value / 100 })} />
                  <PlayRangeField label={copy.moveSensitivity} minimum={10} maximum={200} suffix="%"
                    value={Math.round(preferences.moveSensitivity * 100)}
                    onChange={(value) => onChange({ ...preferences, moveSensitivity: value / 100 })} />
                  <PlayRangeField label={copy.lookSensitivity} minimum={10} maximum={300} suffix="%"
                    value={Math.round(preferences.lookSensitivity * 100)}
                    onChange={(value) => onChange({ ...preferences, lookSensitivity: value / 100 })} />
                  <PlayRangeField label={copy.responseCurve} minimum={20} maximum={300} suffix="%"
                    value={Math.round(preferences.responseCurve * 100)}
                    onChange={(value) => onChange({ ...preferences, responseCurve: value / 100 })} />
                  <PlayToggleField checked={preferences.invertLookY} label={copy.invertY}
                    onChange={(invertLookY) => onChange({ ...preferences, invertLookY })} />
                  <PlayRangeField label={copy.inputDelay} minimum={120} maximum={900} suffix=" ms"
                    value={preferences.uiRepeatDelayMs}
                    onChange={(uiRepeatDelayMs) => onChange({ ...preferences, uiRepeatDelayMs })} />
                  <PlayRangeField label={copy.inputRepeat} minimum={40} maximum={400} suffix=" ms"
                    value={preferences.uiRepeatIntervalMs}
                    onChange={(uiRepeatIntervalMs) => onChange({ ...preferences, uiRepeatIntervalMs })} />
                </div>
              </section>

              {currentGamepad.mapping !== "standard" && (
                <section className="play-gamepad-calibration">
                  <h4>{copy.calibration}</h4>
                  <p>{copy.calibrationDescription}</p>
                  <div>
                    {CALIBRATION_TARGETS.map((target) => {
                      const mapped = target.kind === "button"
                        ? currentProfile?.buttons[target.control as GamepadButtonControl] !== undefined
                        : currentProfile?.axes[target.control as GamepadAxisControl] !== undefined;
                      return (
                        <button
                          data-mapped={mapped || undefined}
                          key={target.control}
                          type="button"
                          onClick={() => setCalibrationTarget(target)}
                        >
                          <span>{target.kind === "button"
                            ? GAMEPAD_BUTTON_LABELS[target.control as GamepadButtonControl]
                            : GAMEPAD_AXIS_LABELS[target.control as GamepadAxisControl]}</span>
                          <small>{calibrationTarget?.control === target.control ? copy.waiting : mapped ? copy.custom : copy.unconfigured}</small>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
              {renderBindings("gamepad")}
            </>
          )}
        </section>
      )}
    </div>
  );
}
