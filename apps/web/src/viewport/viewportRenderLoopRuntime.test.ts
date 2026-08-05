import { describe, expect, it, vi } from "vitest";
import { createViewportRenderLoopRuntime } from "./viewportRenderLoopRuntime";

describe("viewport render loop runtime", () => {
  it("coalesces requests and clamps frame deltas", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextHandle = 1;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    });
    const onFrame = vi.fn(() => false);
    const runtime = createViewportRenderLoopRuntime({
      now: () => 100,
      onFrame,
      requestFrame,
    });

    expect(requestFrame).toHaveBeenCalledOnce();
    callbacks.get(1)?.(220);
    expect(onFrame).toHaveBeenLastCalledWith({
      deltaSeconds: 0.05,
      frameTime: 220,
      renderRequested: true,
    });

    runtime.requestRender();
    runtime.requestRender();
    expect(requestFrame).toHaveBeenCalledTimes(2);
    callbacks.get(2)?.(230);
    expect(onFrame).toHaveBeenLastCalledWith({
      deltaSeconds: 0.01,
      frameTime: 230,
      renderRequested: true,
    });
  });

  it("continues while a system is active and cancels on dispose", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextHandle = 1;
    const cancelFrame = vi.fn();
    let active = true;
    const runtime = createViewportRenderLoopRuntime({
      cancelFrame,
      now: () => 0,
      onFrame: () => active,
      requestFrame: (callback) => {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle;
      },
    });

    callbacks.get(1)?.(16);
    expect(callbacks.has(2)).toBe(true);
    active = false;
    callbacks.get(2)?.(32);
    runtime.requestRender();
    expect(callbacks.has(3)).toBe(true);

    runtime.dispose();
    runtime.requestRender();

    expect(cancelFrame).toHaveBeenCalledWith(3);
    expect(callbacks.has(4)).toBe(false);
  });
});
