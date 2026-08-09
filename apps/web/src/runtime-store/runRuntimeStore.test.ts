import type { ModelRecord } from "@solidloom/shared";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import {
  createRunRuntimeStore,
  RunRuntimeLoadError,
  type RunRuntimeAdapter,
  type RunRuntimeContent,
} from "./runRuntimeStore";

const scene = {
  id: "run-1",
  kind: "scene",
  name: "测试空间",
  description: "",
  unit: "mm",
  revision: 1,
  featureGraph: { version: 1, features: [] },
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
} satisfies ModelRecord;

const content: RunRuntimeContent = {
  models: [scene],
  runtimeModel: { avatarSkin: null, dynamicBodies: [], features: [], groups: [], interactions: [] },
  scene,
};

describe("createRunRuntimeStore", () => {
  it("publishes a readonly loading to ready lifecycle and supports pause", async () => {
    const adapter: RunRuntimeAdapter = { load: vi.fn().mockResolvedValue(content) };
    const store = createRunRuntimeStore("run-1", adapter);
    const statuses: string[] = [];
    store.subscribe(() => statuses.push(store.getSnapshot().status));

    await store.connect();
    expect(statuses).toEqual(["loading", "ready"]);
    expect(store.getSnapshot().content?.scene.name).toBe("测试空间");

    store.pause();
    expect(store.getSnapshot().status).toBe("paused");
    store.resume();
    expect(store.getSnapshot().status).toBe("ready");
  });

  it.each([
    ["forbidden", new RunRuntimeLoadError("forbidden", "denied")],
    ["forbidden", new ApiError(403, "forbidden", "denied")],
    ["not-found", new RunRuntimeLoadError("not-found", "missing")],
    ["disconnected", new TypeError("fetch failed")],
  ] as const)("classifies %s failures", async (status, reason) => {
    const store = createRunRuntimeStore("run-1", { load: vi.fn().mockRejectedValue(reason) });
    await store.connect();
    expect(store.getSnapshot()).toMatchObject({ content: null, status });
  });

  it("ignores a request after cancellation", async () => {
    let resolve!: (value: RunRuntimeContent) => void;
    let signal: AbortSignal | undefined;
    const pending = new Promise<RunRuntimeContent>((done) => { resolve = done; });
    const store = createRunRuntimeStore("run-1", {
      load: (_runId, activeSignal) => {
        signal = activeSignal;
        return pending;
      },
    });
    const request = store.connect();
    store.cancel();
    expect(signal?.aborted).toBe(true);
    resolve(content);
    await request;
    expect(store.getSnapshot().status).toBe("loading");
  });

  it("keeps the latest reconnect result when an older request finishes later", async () => {
    let resolveFirst!: (value: RunRuntimeContent) => void;
    let resolveSecond!: (value: RunRuntimeContent) => void;
    const first = new Promise<RunRuntimeContent>((done) => { resolveFirst = done; });
    const second = new Promise<RunRuntimeContent>((done) => { resolveSecond = done; });
    const load = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const store = createRunRuntimeStore("run-1", { load });

    const firstRequest = store.connect();
    const secondRequest = store.reconnect();
    resolveSecond(content);
    await secondRequest;
    expect(store.getSnapshot().status).toBe("ready");

    resolveFirst({ ...content, scene: { ...scene, name: "过期结果" } });
    await firstRequest;
    expect(store.getSnapshot().content?.scene.name).toBe("测试空间");
  });
});
