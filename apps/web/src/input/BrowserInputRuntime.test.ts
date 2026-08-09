import { describe, expect, it, vi } from "vitest";
import { BrowserInputRuntime } from "./BrowserInputRuntime";
import { cloneInputPreferences } from "./defaultBindings";

function gamepad(options: {
  axes?: number[];
  buttons?: Record<number, number>;
  connected?: boolean;
  id?: string;
  mapping?: Gamepad["mapping"];
  vibrationActuator?: GamepadHapticActuator | null;
} = {}) {
  const values = options.buttons ?? {};
  return {
    axes: options.axes ?? [0, 0, 0, 0],
    buttons: Array.from({ length: 18 }, (_, index) => {
      const value = values[index] ?? 0;
      return { pressed: value > 0.5, touched: value > 0, value };
    }),
    connected: options.connected ?? true,
    hapticActuators: [],
    id: options.id ?? "Standard Test Pad",
    index: 0,
    mapping: options.mapping ?? "standard",
    timestamp: 1,
    vibrationActuator: options.vibrationActuator ?? null,
  } as unknown as Gamepad;
}

describe("BrowserInputRuntime", () => {
  it("reattaches after an effect cleanup cycle", () => {
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    const windowTarget = {
      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        const entries = listeners.get(type) ?? new Set();
        entries.add(listener);
        listeners.set(type, entries);
      },
      cancelAnimationFrame() {},
      navigator: { getGamepads: () => [] },
      removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        listeners.get(type)?.delete(listener);
      },
      requestAnimationFrame: () => 1,
    } as unknown as Window;
    const runtime = new BrowserInputRuntime();

    runtime.attach(windowTarget);
    runtime.dispose();
    runtime.attach(windowTarget);
    const deactivate = runtime.activateContext("menu");
    const actions: string[] = [];
    runtime.subscribeAction((event) => actions.push(`${event.action}:${event.phase}`));
    runtime.processKeyboardInput("ArrowDown", true, { timestamp: 10 });

    expect(listeners.get("keydown")?.size).toBe(1);
    expect(actions).toContain("ui-down:pressed");
    deactivate();
    runtime.dispose();
  });

  it("reports pressed, released, held duration and bounded UI repeat edges", () => {
    const runtime = new BrowserInputRuntime();
    const deactivate = runtime.activateContext("device");
    const phases: string[] = [];
    runtime.subscribeAction((event) => {
      if (event.action === "ui-down") phases.push(event.phase);
    });

    runtime.pollGamepads([gamepad({ buttons: { 13: 1 } })], 10);
    expect(runtime.getSnapshot().actions["ui-down"]).toMatchObject({
      held: true,
      pressed: true,
      released: false,
    });
    runtime.pollGamepads([gamepad({ buttons: { 13: 1 } })], 200);
    expect(runtime.getSnapshot().actions["ui-down"].heldMs).toBe(190);
    runtime.pollGamepads([gamepad({ buttons: { 13: 1 } })], 380);
    runtime.pollGamepads([gamepad({ buttons: { 13: 0 } })], 400);
    expect(runtime.getSnapshot().actions["ui-down"].released).toBe(true);
    expect(phases).toEqual(["pressed", "repeat", "released"]);
    deactivate();
  });

  it("switches contexts without letting one button edge reach two layers", () => {
    const runtime = new BrowserInputRuntime();
    const events: string[] = [];
    runtime.subscribeAction((event) => {
      if (event.phase === "pressed") events.push(`${event.context}:${event.action}`);
    });

    runtime.pollGamepads([gamepad({ buttons: { 0: 1 } })], 10);
    expect(events).toContain("gameplay:primary");
    const suppressCarriedPress = runtime.activateContext("device");
    expect(events).not.toContain("device:ui-confirm");
    suppressCarriedPress();
    runtime.pollGamepads([gamepad({ buttons: { 0: 0 } })], 20);
    const deactivateDevice = runtime.activateContext("device");
    runtime.pollGamepads([gamepad({ buttons: { 0: 1 } })], 30);
    expect(events).toContain("device:ui-confirm");
    expect(events.filter((event) => event === "gameplay:primary")).toHaveLength(1);
    const deactivateMenu = runtime.activateContext("menu");
    runtime.pollGamepads([gamepad({ buttons: { 0: 0 } })], 40);
    runtime.pollGamepads([gamepad({ buttons: { 1: 1 } })], 50);
    expect(events).toContain("menu:ui-back");
    deactivateMenu();
    deactivateDevice();
  });

  it("emits one menu-back action when Escape is shared by menu and back", () => {
    const runtime = new BrowserInputRuntime();
    runtime.activateContext("menu");
    const actions: string[] = [];
    runtime.subscribeAction((event) => {
      if (event.phase === "pressed") actions.push(event.action);
    });

    runtime.processKeyboardInput("Escape", true, { timestamp: 10 });

    expect(actions).toEqual(["open-menu"]);
  });

  it("applies deadzone and sensitivity updates immediately on the same runtime", () => {
    const preferences = cloneInputPreferences();
    preferences.deadzone = 0.3;
    const runtime = new BrowserInputRuntime(preferences);
    runtime.pollGamepads([gamepad({ axes: [0.2, -0.2, 0, 0] })], 10);
    expect(runtime.getSnapshot().move).toEqual({ x: 0, y: 0 });

    const updated = cloneInputPreferences(preferences);
    updated.deadzone = 0.05;
    updated.moveSensitivity = 1.5;
    runtime.setPreferences(updated);
    expect(Math.hypot(runtime.getSnapshot().move.x, runtime.getSnapshot().move.y)).toBeGreaterThan(0);
  });

  it("maps standard roaming controls and enhances confirmation with optional haptics", () => {
    const playEffect = vi.fn().mockResolvedValue("complete");
    const runtime = new BrowserInputRuntime();
    runtime.pollGamepads([gamepad({
      axes: [0.7, -0.8, 0.5, -0.4],
      buttons: { 0: 1, 5: 1, 9: 1, 10: 1 },
      vibrationActuator: { playEffect, reset: vi.fn() } as unknown as GamepadHapticActuator,
    })], 10);
    const snapshot = runtime.getSnapshot();

    expect(snapshot.move.x).toBeGreaterThan(0);
    expect(snapshot.move.y).toBeGreaterThan(0);
    expect(snapshot.look.x).toBeGreaterThan(0);
    expect(snapshot.look.y).toBeLessThan(0);
    expect(snapshot.actions.jump.pressed).toBe(true);
    expect(snapshot.actions.sprint.pressed).toBe(true);
    expect(snapshot.actions.primary.pressed).toBe(true);
    expect(snapshot.actions["open-menu"].pressed).toBe(true);
    expect(playEffect).toHaveBeenCalledWith("dual-rumble", expect.objectContaining({ duration: 45 }));
  });

  it("lets binding capture consume a physical edge before semantic UI actions", () => {
    const runtime = new BrowserInputRuntime();
    runtime.activateContext("menu");
    const semanticActions: string[] = [];
    runtime.subscribeAction((event) => semanticActions.push(event.action));
    runtime.subscribePhysicalInput((event) => event.device === "gamepad");
    runtime.pollGamepads([gamepad({ buttons: { 0: 1 } })], 10);
    expect(semanticActions).not.toContain("ui-confirm");
    runtime.pollGamepads([gamepad({ buttons: { 0: 0 } })], 20);
  });

  it("tracks the most recently active device and falls back after disconnect", () => {
    const runtime = new BrowserInputRuntime();
    runtime.pollGamepads([gamepad({ buttons: { 0: 1 } })], 10);
    expect(runtime.getSnapshot().lastActiveDevice).toBe("gamepad");
    runtime.processKeyboardInput("KeyW", true, { timestamp: 20 });
    expect(runtime.getSnapshot().lastActiveDevice).toBe("keyboard-mouse");
    runtime.processKeyboardInput("KeyW", false, { timestamp: 30 });
    runtime.pollGamepads([gamepad({ buttons: { 0: 1 } })], 40);
    runtime.pollGamepads([], 50);
    expect(runtime.getSnapshot().lastActiveDevice).toBe("keyboard-mouse");
    expect(runtime.getSnapshot().notice).toMatchObject({ kind: "disconnected" });
  });
});
