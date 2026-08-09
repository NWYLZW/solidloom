import { EditorWorkspace } from "./workspaces/editor/EditorWorkspace";
import { PlayRoute } from "./play/PlayRoute";
import { matchAppRoute } from "./router/appRoute";

export function App() {
  const route = matchAppRoute(window.location.pathname);
  if (route.kind === "play") return <PlayRoute runId={route.runId} />;
  return <EditorWorkspace />;
}
