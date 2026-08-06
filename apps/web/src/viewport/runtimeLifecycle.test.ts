import { describe, expect, it, vi } from "vitest";
import { createRuntimeLifecycle } from "./runtimeLifecycle";

describe("runtime lifecycle", () => {
  it("disposes registered runtimes in reverse order only once", () => {
    const calls: string[] = [];
    const lifecycle = createRuntimeLifecycle();
    lifecycle.onDispose(() => calls.push("scene"));
    lifecycle.add({ dispose: () => calls.push("navigation") });
    lifecycle.add({ dispose: () => calls.push("pointer") });

    lifecycle.dispose();
    lifecycle.dispose();

    expect(calls).toEqual(["pointer", "navigation", "scene"]);
    expect(lifecycle.disposed).toBe(true);
  });

  it("immediately disposes resources registered after shutdown", () => {
    const dispose = vi.fn();
    const lifecycle = createRuntimeLifecycle();
    lifecycle.dispose();

    lifecycle.add({ dispose });

    expect(dispose).toHaveBeenCalledOnce();
  });

  it("continues cleanup when one disposer fails", () => {
    const calls: string[] = [];
    const lifecycle = createRuntimeLifecycle();
    lifecycle.onDispose(() => calls.push("last"));
    lifecycle.onDispose(() => {
      calls.push("failure");
      throw new Error("dispose failed");
    });
    lifecycle.onDispose(() => calls.push("first"));

    expect(() => lifecycle.dispose()).toThrow(AggregateError);
    expect(calls).toEqual(["first", "failure", "last"]);
  });
});
