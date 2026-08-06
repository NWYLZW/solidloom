import { useEffect, useState } from "react";
import type {
  InteractionPresentation,
  ResolvedInteractionPresentation,
} from "./types";

const compactViewportQuery = "(max-width: 640px)";

export function resolveInteractionPresentation(
  presentation: InteractionPresentation,
  compactViewport: boolean,
): ResolvedInteractionPresentation {
  if (presentation === "auto") return compactViewport ? "sheet" : "panel";
  if (presentation === "anchored") return "panel";
  return presentation;
}

export function useResolvedInteractionPresentation(
  presentation: InteractionPresentation,
): ResolvedInteractionPresentation {
  const [compactViewport, setCompactViewport] = useState(() => (
    typeof window !== "undefined" && window.matchMedia(compactViewportQuery).matches
  ));

  useEffect(() => {
    const query = window.matchMedia(compactViewportQuery);
    const update = () => setCompactViewport(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return resolveInteractionPresentation(presentation, compactViewport);
}
