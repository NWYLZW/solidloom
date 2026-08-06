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
    labels,
    state,
    take: (productId: string) => perform({ productId, type: "take" }),
  }), [labels, perform, state]);
}
