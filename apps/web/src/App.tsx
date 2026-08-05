import { EditorWorkspace } from "./workspaces/editor/EditorWorkspace";
import { PlayWorkspace } from "./workspaces/play/PlayWorkspace";

export function App() {
  const playMatch = window.location.pathname.match(/^\/play\/([^/]+)\/?$/);
  if (playMatch?.[1]) return <PlayWorkspace sceneId={decodeURIComponent(playMatch[1])} />;
  return <EditorWorkspace />;
}
