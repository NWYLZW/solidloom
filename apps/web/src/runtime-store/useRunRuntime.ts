import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  createRunRuntimeStore,
  type RunRuntimeAdapter,
} from "./runRuntimeStore";

export function useRunRuntime(runId: string, adapter?: RunRuntimeAdapter) {
  const store = useMemo(
    () => createRunRuntimeStore(runId, adapter),
    [adapter, runId],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  useEffect(() => {
    void store.connect();
    return store.cancel;
  }, [store]);

  return {
    pause: store.pause,
    reconnect: store.reconnect,
    resume: store.resume,
    snapshot,
  };
}
