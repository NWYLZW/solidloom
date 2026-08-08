import { Camera, PersonStanding, Settings, X } from "lucide-react";
import { useEffect } from "react";
import type {
  NavigationCameraMode,
  NavigationFirstPersonAvatarMode,
} from "../../Viewport3D";
import { NAVIGATION_FIRST_PERSON_AVATAR_MODES } from "../../navigationAvatar";
import type { EditorLocale } from "../editor/editorCopy";
import { playCopyByLocale } from "./playCopy";
import "./PlaySettingsPanel.css";

const CAMERA_MODES: NavigationCameraMode[] = ["god", "first-person", "third-person"];

interface PlaySettingsPanelProps {
  cameraLabels: Record<NavigationCameraMode, string>;
  cameraMode: NavigationCameraMode;
  firstPersonAvatarMode: NavigationFirstPersonAvatarMode;
  locale: EditorLocale;
  onCameraModeChange: (mode: NavigationCameraMode) => void;
  onFirstPersonAvatarModeChange: (mode: NavigationFirstPersonAvatarMode) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function PlaySettingsPanel({
  cameraLabels,
  cameraMode,
  firstPersonAvatarMode,
  locale,
  onCameraModeChange,
  onFirstPersonAvatarModeChange,
  onOpenChange,
  open,
}: PlaySettingsPanelProps) {
  const copy = playCopyByLocale[locale];

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  const toggleSettings = () => {
    if (!open && document.pointerLockElement) void document.exitPointerLock();
    onOpenChange(!open);
  };

  return (
    <div className="play-settings-root">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={copy.settings}
        className="play-icon-button play-settings-trigger"
        title={copy.settings}
        type="button"
        onClick={toggleSettings}
      >
        <Settings aria-hidden="true" size={18} />
      </button>

      {open && (
        <>
          <button
            aria-label={copy.closeSettings}
            className="play-settings-dismiss"
            type="button"
            onClick={() => onOpenChange(false)}
          />
          <section className="play-settings-panel" role="dialog" aria-label={copy.settings}>
            <header className="play-settings-header">
              <strong>{copy.settings}</strong>
              <button
                aria-label={copy.closeSettings}
                className="play-settings-close"
                title={copy.closeSettings}
                type="button"
                onClick={() => onOpenChange(false)}
              >
                <X aria-hidden="true" size={17} />
              </button>
            </header>

            <div className="play-settings-layout">
              <nav className="play-settings-categories" aria-label={copy.settings}>
                <button aria-current="page" type="button">
                  <Camera aria-hidden="true" size={17} />
                  <span>{copy.camera}</span>
                </button>
              </nav>

              <div className="play-settings-content">
                <div className="play-settings-section-heading">
                  <Camera aria-hidden="true" size={17} />
                  <div>
                    <strong>{copy.camera}</strong>
                    <span>{copy.cameraDescription}</span>
                  </div>
                </div>
                <div className="play-camera-options" role="radiogroup" aria-label={copy.camera}>
                  {CAMERA_MODES.map((mode) => (
                    <button
                      className={cameraMode === mode ? "active" : ""}
                      key={mode}
                      role="radio"
                      aria-checked={cameraMode === mode}
                      type="button"
                      onClick={() => onCameraModeChange(mode)}
                    >
                      {cameraLabels[mode]}
                    </button>
                  ))}
                </div>

                <div className="play-settings-field">
                  <div className="play-settings-field-heading">
                    <PersonStanding aria-hidden="true" size={17} />
                    <div>
                      <strong>{copy.firstPersonAvatar}</strong>
                      <span>{copy.firstPersonAvatarDescription}</span>
                    </div>
                  </div>
                  <div
                    className="play-avatar-options"
                    role="radiogroup"
                    aria-label={copy.firstPersonAvatar}
                  >
                    {NAVIGATION_FIRST_PERSON_AVATAR_MODES.map((mode) => (
                      <button
                        className={firstPersonAvatarMode === mode ? "active" : ""}
                        key={mode}
                        role="radio"
                        aria-checked={firstPersonAvatarMode === mode}
                        type="button"
                        onClick={() => onFirstPersonAvatarModeChange(mode)}
                      >
                        <strong>{copy.firstPersonAvatarModes[mode].label}</strong>
                        <span>{copy.firstPersonAvatarModes[mode].description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
