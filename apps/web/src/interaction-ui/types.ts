import type { ComponentType, CSSProperties, ReactNode } from "react";

export interface NavigationContainerItem {
  id: string;
  name: string;
  productId?: string;
}

export interface NavigationContainerProduct {
  id: string;
  name: string;
  stock: number;
  unitPrice: number;
}

export interface NavigationContainerPanelState {
  canConfigure: boolean;
  capacity: number;
  currency: string;
  interactionId: string;
  items: NavigationContainerItem[];
  products: NavigationContainerProduct[];
  title: string;
}

export interface NavigationContainerConfiguration {
  products: NavigationContainerProduct[];
  title: string;
}

export type NavigationContainerOperation =
  | { productId: string; type: "take" }
  | { type: "close" }
  | { configuration: NavigationContainerConfiguration; type: "configure" };

export interface NavigationDeviceOption {
  description?: string;
  id: string;
  label: string;
}

export interface NavigationDeviceOperationGroup {
  id: string;
  label: string;
  options: NavigationDeviceOption[];
  selectedOptionId: string;
}

export interface NavigationDevicePanelState {
  executeLabel: string;
  groups: NavigationDeviceOperationGroup[];
  interactionId: string;
  status: string | null;
  title: string;
}

export type NavigationDeviceOperation =
  | { groupId: string; optionId: string; type: "select" }
  | { type: "close" }
  | { type: "execute" };

export interface NavigationInteractionLabels {
  articulationClose: string;
  articulationOpen: string;
  containerClose: string;
  containerContents: string;
  containerAddProduct: string;
  containerConfigure: string;
  containerConfigureApply: string;
  containerConfigureGranted: string;
  containerCurrency: string;
  containerDeleteProduct: string;
  containerItemsView: string;
  containerName: string;
  containerEmpty: string;
  containerOpen: string;
  containerPrice: string;
  containerProduct: string;
  containerProducts: string;
  containerSessionOnly: string;
  containerStock: string;
  containerTakeSelected: string;
  containerUnavailable: string;
  doorClose: string;
  doorOpen: string;
  deviceClose: string;
  deviceExecute: string;
  deviceOpen: string;
  deviceReady: string;
  keyHint: string;
  powerOff: string;
  powerOn: string;
  sit: string;
  stand: string;
}

export type InteractionPresentation =
  | "quick"
  | "panel"
  | "modal"
  | "sheet"
  | "auto"
  | "anchored";

export type ResolvedInteractionPresentation = "quick" | "panel" | "modal" | "sheet";

export type InteractionUITokens = CSSProperties & Record<`--interaction-${string}`, string | number>;

export interface ContainerInteractionController {
  configure: (configuration: NavigationContainerConfiguration) => void;
  close: () => void;
  empty: boolean;
  labels: NavigationInteractionLabels;
  state: NavigationContainerPanelState;
  take: (productId: string) => void;
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
  presentation: ResolvedInteractionPresentation;
  slots: ContainerInteractionSlots;
}

export interface DeviceInteractionController {
  close: () => void;
  execute: () => void;
  labels: NavigationInteractionLabels;
  select: (groupId: string, optionId: string) => void;
  state: NavigationDevicePanelState;
}

export interface DeviceInteractionRendererProps {
  controller: DeviceInteractionController;
  presentation: ResolvedInteractionPresentation;
}

export interface InteractionRendererRegistry {
  container: ComponentType<ContainerInteractionRendererProps>;
  device: ComponentType<DeviceInteractionRendererProps>;
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
  device: NavigationDevicePanelState | null;
  labels: NavigationInteractionLabels;
  onContainerOperation: (
    interactionId: string,
    operation: NavigationContainerOperation,
  ) => void;
  onDeviceOperation: (
    interactionId: string,
    operation: NavigationDeviceOperation,
  ) => void;
}
