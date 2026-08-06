import { createContext, useContext, useMemo } from "react";
import { mergeInteractionUI } from "./config";
import type { InteractionUIConfig, InteractionUIProviderProps } from "./types";

const InteractionUIContext = createContext<InteractionUIConfig>({});

export function InteractionUIProvider({ children, config }: InteractionUIProviderProps) {
  const parentConfig = useContext(InteractionUIContext);
  const mergedConfig = useMemo(
    () => mergeInteractionUI(parentConfig, config),
    [config, parentConfig],
  );

  return (
    <InteractionUIContext.Provider value={mergedConfig}>
      {children}
    </InteractionUIContext.Provider>
  );
}

export function useInteractionUI(override?: InteractionUIConfig) {
  const contextConfig = useContext(InteractionUIContext);
  return useMemo(
    () => mergeInteractionUI(contextConfig, override),
    [contextConfig, override],
  );
}
