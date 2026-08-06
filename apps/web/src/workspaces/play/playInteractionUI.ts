import { createInteractionUI } from "../../interaction-ui";

export const playInteractionUI = createInteractionUI({
  presentations: {
    container: "modal",
  },
  theme: {
    id: "play-workspace",
    tokens: {
      "--interaction-note-display": "none",
      "--interaction-surface-width": "500px",
    },
  },
});
