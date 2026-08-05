import type { NavigationSurface } from "@solidloom/shared";
import type { NavigationCameraMode, NavigationPrompt } from "./types";

interface NavigationOverlaysProps {
  aimTargetVisible: boolean;
  cameraLabels: Record<NavigationCameraMode, string>;
  cameraMode: NavigationCameraMode;
  interactionKeyHint: string;
  modeLabel: string;
  navigation: NavigationSurface | null;
  navigationMode: boolean;
  onCameraModeChange: (mode: NavigationCameraMode) => void;
  onInteraction: (interactionId: string) => void;
  prompts: NavigationPrompt[];
}

const CAMERA_MODES: NavigationCameraMode[] = ["god", "first-person", "third-person"];

export function NavigationOverlays({
  aimTargetVisible,
  cameraLabels,
  cameraMode,
  interactionKeyHint,
  modeLabel,
  navigation,
  navigationMode,
  onCameraModeChange,
  onInteraction,
  prompts,
}: NavigationOverlaysProps) {
  if (!navigationMode) return null;

  return (
    <>
      {navigation?.enabled && (
        <div className="navigation-mode-banner">
          <div className="navigation-camera-modes" role="group" aria-label={modeLabel}>
            {CAMERA_MODES.map((mode) => (
              <button
                className={cameraMode === mode ? "active" : ""}
                key={mode}
                type="button"
                aria-pressed={cameraMode === mode}
                onClick={() => onCameraModeChange(mode)}
              >
                {cameraLabels[mode]}
              </button>
            ))}
          </div>
        </div>
      )}
      {prompts.length > 0 && (
        <div className="navigation-interaction-prompts" aria-label={modeLabel}>
          {prompts.map((prompt, index) => (
            <button
              className="navigation-interaction-prompt"
              key={prompt.id}
              type="button"
              onClick={() => onInteraction(prompt.id)}
            >
              {index === 0 && <kbd>{interactionKeyHint}</kbd>}
              <span>{prompt.label}</span>
            </button>
          ))}
        </div>
      )}
      {aimTargetVisible && <span className="navigation-aim-target" aria-hidden="true" />}
    </>
  );
}
