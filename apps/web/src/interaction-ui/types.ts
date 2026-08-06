import type { ComponentType, CSSProperties, ReactNode } from "react";

export interface NavigationContainerItem {
  id: string;
  name: string;
}

export interface NavigationContainerPanelState {
  capacity: number;
  interactionId: string;
  items: NavigationContainerItem[];
  title: string;
}

export type NavigationContainerOperation = "store" | "take" | "close";

export interface NavigationInteractionLabels {
  articulationClose: string;
  articulationOpen: string;
  containerClose: string;
  containerContents: string;
  containerCapacity: string;
  containerEmpty: string;
  containerOpen: string;
  containerSessionOnly: string;
  containerStore: string;
  containerTake: string;
  doorClose: string;
  doorOpen: string;
  keyHint: string;
  powerOff: string;
  powerOn: string;
  sit: string;
  stand: string;
}

export type InteractionPresentation = "anchored" | "modal" | "sheet";

export type InteractionUITokens = CSSProperties & Record<`--interaction-${string}`, string | number>;

export interface ContainerInteractionController {
  close: () => void;
  empty: boolean;
  full: boolean;
  labels: NavigationInteractionLabels;
  state: NavigationContainerPanelState;
  store: () => void;
  take: () => void;
}

export interface ContainerItemSlotProps {
  index: number;
  item: NavigationContainerItem;
}

export interface ContainerEmptySlotProps {
  index: number;
}

export interface ContainerInteractionSlots {
  EmptySlot: ComponentType<ContainerEmptySlotProps>;
  Item: ComponentType<ContainerItemSlotProps>;
}

export interface ContainerInteractionRendererProps {
  controller: ContainerInteractionController;
  presentation: InteractionPresentation;
  slots: ContainerInteractionSlots;
}

export interface InteractionRendererRegistry {
  container: ComponentType<ContainerInteractionRendererProps>;
}

export interface InteractionSlotRegistry {
  container: ContainerInteractionSlots;
}

export interface InteractionUITheme {
  className?: string;
  id: string;
  tokens?: InteractionUITokens;
}

export interface InteractionUIConfig {
  presentations?: Partial<Record<keyof InteractionRendererRegistry, InteractionPresentation>>;
  renderers?: Partial<InteractionRendererRegistry>;
  slots?: {
    container?: Partial<ContainerInteractionSlots>;
  };
  theme?: InteractionUITheme;
}

export interface InteractionUIProviderProps {
  children: ReactNode;
  config: InteractionUIConfig;
}

export interface InteractionSurfaceProps {
  config?: InteractionUIConfig | undefined;
  container: NavigationContainerPanelState | null;
  labels: NavigationInteractionLabels;
  onContainerOperation: (
    interactionId: string,
    operation: NavigationContainerOperation,
  ) => void;
}
