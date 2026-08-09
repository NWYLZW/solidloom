import { PlayWorkspace } from "../workspaces/play/PlayWorkspace";
import { useRunRuntime } from "../runtime-store/useRunRuntime";

interface PlayRouteProps {
  runId: string;
}

export function PlayRoute({ runId }: PlayRouteProps) {
  const runtime = useRunRuntime(runId);
  return (
    <PlayWorkspace
      onPause={runtime.pause}
      onReconnect={runtime.reconnect}
      onResume={runtime.resume}
      snapshot={runtime.snapshot}
    />
  );
}
