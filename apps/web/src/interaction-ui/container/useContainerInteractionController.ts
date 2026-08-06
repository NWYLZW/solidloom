import { useCallback, useMemo } from "react";
import type {
  ContainerInteractionController,
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
    close: () => perform("close"),
    empty: state.items.length === 0,
    full: state.items.length >= state.capacity,
    labels,
    state,
    store: () => perform("store"),
    take: () => perform("take"),
  }), [labels, perform, state]);
}
