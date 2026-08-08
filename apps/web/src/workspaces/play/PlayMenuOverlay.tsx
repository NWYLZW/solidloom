import type { RuntimeMenuItem } from "@solidloom/shared";
import { ChevronRight, Hammer, Menu, Play, Settings, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type {
  NavigationAvatarSkin,
  NavigationFirstPersonAvatarMode,
} from "../../navigationAvatar";
import type { NavigationCameraMode } from "../../Viewport3D";
import type { EditorLocale } from "../editor/editorCopy";
import { PlayCharacterView } from "./PlayCharacterView";
import { playCopyByLocale } from "./playCopy";
import { PlaySettingsView } from "./PlaySettingsView";
import type { PlayAudioPreferences, PlayTheme } from "./playPreferences";
import type { PlayMenuView, PlaySettingsCategory } from "./usePlayUrlState";
import "./PlayMenuOverlay.css";

interface PlayMenuOverlayProps {
  audioPreferences: PlayAudioPreferences;
  cameraLabels: Record<NavigationCameraMode, string>;
  cameraMode: NavigationCameraMode;
  avatarSkin: NavigationAvatarSkin | null;
  firstPersonAvatarMode: NavigationFirstPersonAvatarMode;
  items: RuntimeMenuItem[];
  locale: EditorLocale;
  onAudioPreferencesChange: (preferences: PlayAudioPreferences) => void;
  onCameraModeChange: (mode: NavigationCameraMode) => void;
  onFirstPersonAvatarModeChange: (mode: NavigationFirstPersonAvatarMode) => void;
  onLocaleChange: (locale: EditorLocale) => void;
  onAvatarSkinChange: (skin: NavigationAvatarSkin) => void;
  onAvatarSkinReset: () => void;
  onClose: () => void;
  onReturnWorkshop: () => void;
  onSettingsCategoryChange: (category: PlaySettingsCategory) => void;
  onThemeChange: (theme: PlayTheme) => void;
  onViewBack: () => void;
  onViewChange: (view: PlayMenuView) => void;
  sceneAvatarSkin: NavigationAvatarSkin | null;
  sceneName: string;
  settingsCategory: PlaySettingsCategory;
  theme: PlayTheme;
  view: PlayMenuView | null;
}

export function PlayMenuOverlay({
  audioPreferences,
  cameraLabels,
  cameraMode,
  avatarSkin,
  firstPersonAvatarMode,
  items,
  locale,
  onAudioPreferencesChange,
  onCameraModeChange,
  onFirstPersonAvatarModeChange,
  onLocaleChange,
  onAvatarSkinChange,
  onAvatarSkinReset,
  onClose,
  onReturnWorkshop,
  onSettingsCategoryChange,
  onThemeChange,
  onViewBack,
  onViewChange,
  sceneAvatarSkin,
  sceneName,
  settingsCategory,
  theme,
  view,
}: PlayMenuOverlayProps) {
  const copy = playCopyByLocale[locale];
  const triggerRef = useRef<HTMLButtonElement>(null);

  const resume = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLCanvasElement>("canvas[data-testid='model-canvas']")?.focus();
    });
  }, [onClose]);

  const openMenu = () => {
    if (document.pointerLockElement) void document.exitPointerLock();
    onViewChange("menu");
  };

  useEffect(() => {
    if (!view) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (view === "settings" || view === "character") onViewBack();
      else resume();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onViewBack, resume, view]);

  useEffect(() => {
    if (!view) triggerRef.current?.focus();
  }, [view]);

  const renderMenuItem = (item: RuntimeMenuItem) => {
    const config = item === "resume"
      ? { icon: Play, label: copy.resume, action: resume }
      : item === "character"
        ? { icon: UserRound, label: copy.character, action: () => onViewChange("character") }
      : item === "settings"
        ? { icon: Settings, label: copy.settings, action: () => onViewChange("settings") }
        : { icon: Hammer, label: copy.returnWorkshop, action: onReturnWorkshop };
    const Icon = config.icon;
    return (
      <button className="play-menu-action" key={item} type="button" onClick={config.action}>
        <Icon aria-hidden="true" size={21} />
        <span>{config.label}</span>
        <ChevronRight aria-hidden="true" size={19} />
      </button>
    );
  };

  return (
    <div className="play-menu-root" data-open={view ? "true" : "false"}>
      {!view && items.length > 0 && (
        <button
          aria-expanded="false"
          aria-haspopup="dialog"
          aria-label={copy.menu}
          className="play-icon-button play-menu-trigger"
          ref={triggerRef}
          title={copy.menu}
          type="button"
          onClick={openMenu}
        >
          <Menu aria-hidden="true" size={19} />
        </button>
      )}

      {view && (
        <section className="play-menu-screen" role="dialog" aria-modal="true" aria-label={copy.menu}>
          {view === "menu" ? (
            <div className="play-menu-home">
              <header>
                <span>{sceneName}</span>
                <h1>{copy.menu}</h1>
                <p>{copy.menuDescription}</p>
              </header>
              <nav className="play-menu-actions" aria-label={copy.menu}>
                {items.map(renderMenuItem)}
              </nav>
            </div>
          ) : view === "settings" ? (
            <PlaySettingsView
              audioPreferences={audioPreferences}
              cameraLabels={cameraLabels}
              cameraMode={cameraMode}
              category={settingsCategory}
              firstPersonAvatarMode={firstPersonAvatarMode}
              locale={locale}
              onAudioPreferencesChange={onAudioPreferencesChange}
              onBack={onViewBack}
              onCameraModeChange={onCameraModeChange}
              onCategoryChange={onSettingsCategoryChange}
              onFirstPersonAvatarModeChange={onFirstPersonAvatarModeChange}
              onLocaleChange={onLocaleChange}
              onThemeChange={onThemeChange}
              theme={theme}
            />
          ) : (
            <PlayCharacterView
              locale={locale}
              onBack={onViewBack}
              onSkinChange={onAvatarSkinChange}
              onSkinReset={onAvatarSkinReset}
              sceneSkin={sceneAvatarSkin}
              skin={avatarSkin}
            />
          )}
        </section>
      )}
    </div>
  );
}
