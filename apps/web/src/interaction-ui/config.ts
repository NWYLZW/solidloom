import type { InteractionUIConfig } from "./types";

export function createInteractionUI(config: InteractionUIConfig): InteractionUIConfig {
  return config;
}

export function mergeInteractionUI(
  base: InteractionUIConfig,
  override?: InteractionUIConfig,
): InteractionUIConfig {
  if (!override) return base;

  const merged: InteractionUIConfig = {
    presentations: {
      ...base.presentations,
      ...override.presentations,
    },
    renderers: {
      ...base.renderers,
      ...override.renderers,
    },
    slots: {
      ...base.slots,
      ...override.slots,
      container: {
        ...base.slots?.container,
        ...override.slots?.container,
      },
    },
  };

  const theme = override.theme ? {
    ...base.theme,
    ...override.theme,
    tokens: {
      ...base.theme?.tokens,
      ...override.theme.tokens,
    },
  } : base.theme;

  return theme ? { ...merged, theme } : merged;
}
