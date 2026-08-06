import {
  createInteractionUI,
  type InteractionPresentation,
} from "../../interaction-ui";

export function createPlayInteractionUI(
  presentation: InteractionPresentation = "modal",
) {
  return createInteractionUI({
    presentations: {
      container: presentation,
      device: presentation,
    },
    theme: {
      id: "play-workspace",
      tokens: {
        "--interaction-surface-width": "320px",
      },
    },
  });
}

export const playInteractionUI = createPlayInteractionUI();
