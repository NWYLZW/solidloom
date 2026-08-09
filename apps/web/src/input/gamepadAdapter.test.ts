import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT_PREFERENCES, cloneInputPreferences, gamepadDeviceKey } from "./defaultBindings";
import { applyAxisResponse, readGamepadAxis, readGamepadBinding } from "./gamepadAdapter";

function gamepad(options: {
  axes?: number[];
  buttons?: number[];
  id?: string;
  mapping?: Gamepad["mapping"];
} = {}) {
  const buttonValues = options.buttons ?? [];
  return {
    axes: options.axes ?? [],
    buttons: Array.from({ length: Math.max(18, buttonValues.length) }, (_, index) => {
      const value = buttonValues[index] ?? 0;
      return { pressed: value > 0.5, touched: value > 0, value };
    }),
    connected: true,
    hapticActuators: [],
    id: options.id ?? "Standard Test Pad",
    index: 0,
    mapping: options.mapping ?? "standard",
    timestamp: 1,
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe("gamepad adapter", () => {
  it("centralizes standard button and axis mapping", () => {
    const pad = gamepad({ axes: [0.5, -0.8, 0.25, -0.3], buttons: [1] });
    expect(readGamepadBinding(
      pad,
      { control: "south", kind: "button" },
      DEFAULT_INPUT_PREFERENCES,
    )).toBe(1);
    expect(readGamepadAxis(pad, "left-y", DEFAULT_INPUT_PREFERENCES)).toBe(-0.8);
    expect(readGamepadAxis(pad, "right-x", DEFAULT_INPUT_PREFERENCES)).toBe(0.25);
  });

  it("suppresses drift and applies the configured response curve", () => {
    expect(applyAxisResponse(0.1, 0.16, 1)).toBe(0);
    expect(applyAxisResponse(-0.1, 0.16, 1)).toBe(0);
    expect(applyAxisResponse(1, 0.16, 1.5)).toBe(1);
    expect(applyAxisResponse(-1, 0.16, 1.5)).toBe(-1);
  });

  it("uses a persisted per-device profile for non-standard pads", () => {
    const preferences = cloneInputPreferences();
    const id = "Arcade USB Controller";
    preferences.customGamepads[gamepadDeviceKey(id)] = {
      axes: {
        "left-x": { index: 3, inverted: true },
        "left-y": { index: 2, inverted: false },
        "right-x": { index: 1, inverted: false },
        "right-y": { index: 0, inverted: true },
      },
      buttons: { south: 6, east: 7 },
      updatedAt: 1,
    };
    const pad = gamepad({
      axes: [0.4, -0.5, 0.6, -0.75],
      buttons: [0, 0, 0, 0, 0, 0, 1, 0],
      id,
      mapping: "",
    });
    expect(readGamepadAxis(pad, "left-x", preferences)).toBe(0.75);
    expect(readGamepadAxis(pad, "right-y", preferences)).toBe(-0.4);
    expect(readGamepadBinding(pad, { control: "south", kind: "button" }, preferences)).toBe(1);
  });
});
