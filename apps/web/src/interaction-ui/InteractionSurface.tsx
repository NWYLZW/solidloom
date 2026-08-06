import { DefaultContainerInteractionRenderer } from "./container/DefaultContainerInteractionRenderer";
import {
  DefaultContainerEmptySlot,
  DefaultContainerItem,
} from "./container/DefaultContainerSlots";
import { useContainerInteractionController } from "./container/useContainerInteractionController";
import { mergeInteractionUI } from "./config";
import { useInteractionUI } from "./InteractionUIProvider";
import { useResolvedInteractionPresentation } from "./useResolvedInteractionPresentation";
import type {
  ContainerInteractionSlots,
  InteractionUIConfig,
  InteractionSurfaceProps,
} from "./types";

const defaultSlots: ContainerInteractionSlots = {
  EmptySlot: DefaultContainerEmptySlot,
  Item: DefaultContainerItem,
};

const defaultConfig: InteractionUIConfig = {
  presentations: { container: "anchored" },
  renderers: { container: DefaultContainerInteractionRenderer },
  slots: { container: defaultSlots },
  theme: { id: "solidloom" },
};

function ContainerSurface({
  config,
  labels,
  onContainerOperation,
  state,
}: Omit<InteractionSurfaceProps, "container"> & {
  config: InteractionUIConfig;
  state: NonNullable<InteractionSurfaceProps["container"]>;
}) {
  const controller = useContainerInteractionController({
    labels,
    onContainerOperation,
    state,
  });
  const Renderer = config.renderers?.container ?? DefaultContainerInteractionRenderer;
  const slots: ContainerInteractionSlots = {
    EmptySlot: config.slots?.container?.EmptySlot ?? DefaultContainerEmptySlot,
    Item: config.slots?.container?.Item ?? DefaultContainerItem,
  };
  const presentation = useResolvedInteractionPresentation(
    config.presentations?.container ?? "panel",
  );
  const theme = config.theme ?? defaultConfig.theme;

  return (
    <div
      className={["interaction-ui-root", theme?.className].filter(Boolean).join(" ")}
      data-interaction-kind="container"
      data-interaction-presentation={presentation}
      data-interaction-theme={theme?.id}
      style={theme?.tokens}
    >
      <Renderer controller={controller} presentation={presentation} slots={slots} />
    </div>
  );
}

export function InteractionSurface(props: InteractionSurfaceProps) {
  const inheritedConfig = useInteractionUI(props.config);
  const config = mergeInteractionUI(defaultConfig, inheritedConfig);

  if (!props.container) return null;

  return (
    <ContainerSurface
      config={config}
      labels={props.labels}
      onContainerOperation={props.onContainerOperation}
      state={props.container}
    />
  );
}
