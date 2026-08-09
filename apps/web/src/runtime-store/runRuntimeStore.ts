import type { ModelRecord } from "@solidloom/shared";
import { ApiError, listModels } from "../api";
import {
  resolveSceneRuntimeModel,
  type SceneRuntimeModel,
} from "../sceneRuntimeModel";

export type RunRuntimeStatus =
  | "loading"
  | "ready"
  | "paused"
  | "disconnected"
  | "forbidden"
  | "not-found"
  | "error";

export interface RunRuntimeContent {
  models: readonly ModelRecord[];
  runtimeModel: SceneRuntimeModel;
  scene: ModelRecord;
}

export interface RunRuntimeSnapshot {
  content: RunRuntimeContent | null;
  detail: string;
  runId: string;
  status: RunRuntimeStatus;
}

export interface RunRuntimeAdapter {
  load(runId: string, signal: AbortSignal): Promise<RunRuntimeContent>;
}

export interface RunRuntimeStore {
  cancel(): void;
  connect(): Promise<void>;
  getSnapshot(): RunRuntimeSnapshot;
  pause(): void;
  reconnect(): Promise<void>;
  resume(): void;
  subscribe(listener: () => void): () => void;
}

export class RunRuntimeLoadError extends Error {
  constructor(
    public readonly status: Exclude<RunRuntimeStatus, "loading" | "ready" | "paused">,
    message: string,
  ) {
    super(message);
    this.name = "RunRuntimeLoadError";
  }
}

export const modelBackedRunRuntimeAdapter: RunRuntimeAdapter = {
  async load(runId, signal) {
    const result = await listModels(signal);
    const scene = result.items.find((model) => model.id === runId && model.kind === "scene");
    if (!scene) {
      throw new RunRuntimeLoadError("not-found", `Run ${runId} was not found.`);
    }
    return {
      models: result.items,
      runtimeModel: resolveSceneRuntimeModel(scene, result.items),
      scene,
    };
  },
};

function classifyLoadFailure(reason: unknown): Pick<RunRuntimeSnapshot, "detail" | "status"> {
  if (reason instanceof RunRuntimeLoadError) {
    return { detail: reason.message, status: reason.status };
  }
  if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
    return { detail: reason.message, status: "forbidden" };
  }
  if (reason instanceof TypeError) {
    return { detail: reason.message, status: "disconnected" };
  }
  return {
    detail: reason instanceof Error ? reason.message : String(reason),
    status: "error",
  };
}

export function createRunRuntimeStore(
  runId: string,
  adapter: RunRuntimeAdapter = modelBackedRunRuntimeAdapter,
): RunRuntimeStore {
  let controller: AbortController | null = null;
  let requestVersion = 0;
  let snapshot: RunRuntimeSnapshot = {
    content: null,
    detail: "",
    runId,
    status: "loading",
  };
  const listeners = new Set<() => void>();

  const publish = (nextSnapshot: RunRuntimeSnapshot) => {
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  };

  const cancel = () => {
    requestVersion += 1;
    controller?.abort();
    controller = null;
  };

  const connect = async () => {
    cancel();
    const activeVersion = requestVersion;
    const activeController = new AbortController();
    controller = activeController;
    publish({ content: null, detail: "", runId, status: "loading" });
    try {
      const content = await adapter.load(runId, activeController.signal);
      if (activeController.signal.aborted || activeVersion !== requestVersion) return;
      publish({ content, detail: "", runId, status: "ready" });
    } catch (reason) {
      if (activeController.signal.aborted || activeVersion !== requestVersion) return;
      publish({ content: null, runId, ...classifyLoadFailure(reason) });
    } finally {
      if (controller === activeController) controller = null;
    }
  };

  return {
    cancel,
    connect,
    getSnapshot: () => snapshot,
    pause: () => {
      if (snapshot.status === "ready" && snapshot.content) {
        publish({ ...snapshot, status: "paused" });
      }
    },
    reconnect: connect,
    resume: () => {
      if (snapshot.status === "paused" && snapshot.content) {
        publish({ ...snapshot, status: "ready" });
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
