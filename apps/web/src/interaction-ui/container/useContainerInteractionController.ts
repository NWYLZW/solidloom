import { useCallback, useMemo } from "react";
import type {
  ContainerInteractionController,
  NavigationContainerConfiguration,
  InteractionSurfaceProps,
  NavigationContainerOperation,
} from "../types";

export function useContainerInteractionController({
  labels,
  onContainerOperation,
  state,
}: Pick<InteractionSurfaceProps, "labels" | "onContainerOperation"> & {
  state: NonNullable<InteractionSurfaceProps["container"]>;
}): ContainerInteractionController {
  const perform = useCallback((operation: NavigationContainerOperation) => {
    onContainerOperation(state.interactionId, operation);
  }, [onContainerOperation, state.interactionId]);

  return useMemo(() => ({
    close: () => perform({ type: "close" }),
    configure: (configuration: NavigationContainerConfiguration) => perform({
      configuration,
      type: "configure",
    }),
    empty: state.items.length === 0,
    full: state.items.length >= state.capacity,
    labels,
    state,
    store: () => perform({ type: "store" }),
    take: () => perform({ type: "take" }),
  }), [labels, perform, state]);
}
