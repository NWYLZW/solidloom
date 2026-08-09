import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { BrowserInputRuntime } from "./BrowserInputRuntime";
import type {
  InputActionListener,
  InputContext,
  InputPreferences,
  SemanticInputRuntime,
  SemanticInputSnapshot,
} from "./types";

const InputRuntimeContext = createContext<SemanticInputRuntime | null>(null);

interface InputRuntimeProviderProps {
  children: ReactNode;
  runtime: SemanticInputRuntime;
}

export function InputRuntimeProvider({ children, runtime }: InputRuntimeProviderProps) {
  return (
    <InputRuntimeContext.Provider value={runtime}>
      {children}
    </InputRuntimeContext.Provider>
  );
}

export function useBrowserInputRuntime(preferences: InputPreferences) {
  const runtimeRef = useRef<BrowserInputRuntime | null>(null);
  if (!runtimeRef.current) runtimeRef.current = new BrowserInputRuntime(preferences);

  useEffect(() => {
    const runtime = runtimeRef.current!;
    runtime.attach();
    return () => runtime.dispose();
  }, []);

  useEffect(() => {
    runtimeRef.current?.setPreferences(preferences);
  }, [preferences]);

  return runtimeRef.current;
}

export function useInputRuntime() {
  const runtime = useContext(InputRuntimeContext);
  if (!runtime) throw new Error("InputRuntimeProvider is required for semantic input hooks.");
  return runtime;
}

export function useOptionalInputRuntime() {
  return useContext(InputRuntimeContext);
}

export function useInputContext(
  context: Exclude<InputContext, "gameplay">,
  enabled = true,
) {
  const runtime = useContext(InputRuntimeContext);
  useEffect(() => {
    if (!enabled || !runtime) return undefined;
    return runtime.activateContext(context);
  }, [context, enabled, runtime]);
}

export function useInputAction(listener: InputActionListener, enabled = true) {
  const runtime = useContext(InputRuntimeContext);
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);
  useEffect(() => {
    if (!enabled || !runtime) return undefined;
    return runtime.subscribeAction((event) => listenerRef.current(event));
  }, [enabled, runtime]);
}

const emptySubscribe = () => () => undefined;

export function useInputSnapshot(runtimeOverride?: SemanticInputRuntime): SemanticInputSnapshot {
  const contextRuntime = useContext(InputRuntimeContext);
  const runtime = runtimeOverride ?? contextRuntime;
  if (!runtime) throw new Error("InputRuntimeProvider is required for semantic input hooks.");
  return useSyncExternalStore(
    (listener) => runtime.subscribe(listener),
    () => runtime.getSnapshot(),
    () => runtime.getSnapshot(),
  );
}

export function useOptionalInputSnapshot(runtime: SemanticInputRuntime | undefined) {
  return useSyncExternalStore(
    runtime ? (listener) => runtime.subscribe(listener) : emptySubscribe,
    runtime ? () => runtime.getSnapshot() : () => null,
    runtime ? () => runtime.getSnapshot() : () => null,
  );
}

export function useLastInputDevice(runtimeOverride?: SemanticInputRuntime) {
  const contextRuntime = useContext(InputRuntimeContext);
  const runtime = runtimeOverride ?? contextRuntime;
  if (!runtime) throw new Error("InputRuntimeProvider is required for semantic input hooks.");
  return useSyncExternalStore(
    (listener) => runtime.subscribe(listener),
    () => runtime.getSnapshot().lastActiveDevice,
    () => runtime.getSnapshot().lastActiveDevice,
  );
}

export function useInputNotice() {
  const runtime = useInputRuntime();
  return useSyncExternalStore(
    (listener) => runtime.subscribe(listener),
    () => runtime.getSnapshot().notice,
    () => runtime.getSnapshot().notice,
  );
}
