import { useCallback, useMemo } from "react";
import type {
  DeviceInteractionController,
  InteractionSurfaceProps,
  NavigationDeviceOperation,
} from "../types";

export function useDeviceInteractionController({
  labels,
  onDeviceOperation,
  state,
}: Pick<InteractionSurfaceProps, "labels" | "onDeviceOperation"> & {
  state: NonNullable<InteractionSurfaceProps["device"]>;
}): DeviceInteractionController {
  const perform = useCallback((operation: NavigationDeviceOperation) => {
    onDeviceOperation(state.interactionId, operation);
  }, [onDeviceOperation, state.interactionId]);

  return useMemo(() => ({
    close: () => perform({ type: "close" }),
    execute: () => perform({ type: "execute" }),
    labels,
    select: (groupId: string, optionId: string) => perform({
      groupId,
      optionId,
      type: "select",
    }),
    state,
  }), [labels, perform, state]);
}
