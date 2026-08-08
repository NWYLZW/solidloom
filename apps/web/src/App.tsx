import { EditorWorkspace } from "./workspaces/editor/EditorWorkspace";
import { PlayWorkspace } from "./workspaces/play/PlayWorkspace";

export function App() {
  const playMatch = window.location.pathname.match(
    /^\/play\/([^/]+)(?:\/(?:menu|character|settings(?:\/(?:appearance|audio|camera|general))?))?\/?$/,
  );
  if (playMatch?.[1]) return <PlayWorkspace sceneId={decodeURIComponent(playMatch[1])} />;
  return <EditorWorkspace />;
}
