import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT_PREFERENCES } from "../../input";
import { normalizePlayInputPreferences } from "./playPreferences";

describe("play input preferences", () => {
  it("preserves valid bindings and clamps high-frequency settings", () => {
    const preferences = normalizePlayInputPreferences({
      deadzone: 9,
      invertLookY: true,
      keyboardBindings: {
        ...DEFAULT_INPUT_PREFERENCES.keyboardBindings,
        primary: { primary: "KeyR", alternate: "Enter" },
      },
      lookSensitivity: 20,
      moveSensitivity: 0,
      uiRepeatIntervalMs: 1,
    });
    expect(preferences.keyboardBindings.primary).toEqual({ primary: "KeyR", alternate: "Enter" });
    expect(preferences.deadzone).toBe(0.45);
    expect(preferences.lookSensitivity).toBe(3);
    expect(preferences.moveSensitivity).toBe(0.1);
    expect(preferences.uiRepeatIntervalMs).toBe(40);
    expect(preferences.invertLookY).toBe(true);
  });

  it("recovers defaults from malformed local data", () => {
    const preferences = normalizePlayInputPreferences({ keyboardBindings: { primary: "bad" } });
    expect(preferences.keyboardBindings.primary).toEqual(
      DEFAULT_INPUT_PREFERENCES.keyboardBindings.primary,
    );
  });

  it("round-trips a calibrated non-standard gamepad profile", () => {
    const stored = JSON.parse(JSON.stringify({
      customGamepads: {
        "arcade usb controller": {
          axes: {
            "left-x": { index: 3, inverted: true },
            "left-y": { index: 2, inverted: false },
          },
          buttons: { south: 6, east: 7 },
          updatedAt: 42,
        },
      },
    }));

    expect(normalizePlayInputPreferences(stored).customGamepads["arcade usb controller"])
      .toEqual(stored.customGamepads["arcade usb controller"]);
  });
});
