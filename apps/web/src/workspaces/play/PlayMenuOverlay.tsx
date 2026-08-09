import type { RuntimeMenuItem } from "@solidloom/shared";
import { ChevronRight, Hammer, Menu, Play, Settings, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import {
  activateFocusedElement,
  adjustFocusedControl,
  focusInitialElement,
  focusSequentialElement,
  focusSpatialElement,
  type InputPreferences,
  useInputAction,
  useInputContext,
} from "../../input";
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
  inputPreferences: InputPreferences;
  items: RuntimeMenuItem[];
  locale: EditorLocale;
  onAudioPreferencesChange: (preferences: PlayAudioPreferences) => void;
  onCameraModeChange: (mode: NavigationCameraMode) => void;
  onFirstPersonAvatarModeChange: (mode: NavigationFirstPersonAvatarMode) => void;
  onInputPreferencesChange: (preferences: InputPreferences) => void;
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
  inputPreferences,
  items,
  locale,
  onAudioPreferencesChange,
  onCameraModeChange,
  onFirstPersonAvatarModeChange,
  onInputPreferencesChange,
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
  const screenRef = useRef<HTMLElement>(null);

  const resume = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLCanvasElement>("canvas[data-testid='model-canvas']")?.focus();
    });
  }, [onClose]);

  const openMenu = useCallback(() => {
    if (document.pointerLockElement) void document.exitPointerLock();
    onViewChange("menu");
  }, [onViewChange]);

  useInputContext("menu", Boolean(view));
  useInputAction((event) => {
    if (event.phase === "released") return;
    if (!view) {
      if (event.action !== "open-menu" || event.phase !== "pressed") return;
      event.preventDefault();
      openMenu();
      return;
    }
    if (event.context !== "menu") return;
    const screen = screenRef.current;
    if (event.action === "ui-back" || event.action === "open-menu") {
      if (event.phase !== "pressed") return;
      event.preventDefault();
      if (view === "settings" || view === "character") onViewBack();
      else resume();
      return;
    }
    if (!screen) return;
    if (event.action === "ui-confirm") {
      if (event.phase !== "pressed") return;
      event.preventDefault();
      activateFocusedElement(screen);
      return;
    }
    const spatialDirection = event.action === "ui-up" ? "up"
      : event.action === "ui-down" ? "down"
        : event.action === "ui-left" ? "left"
          : event.action === "ui-right" ? "right"
            : null;
    if (spatialDirection) {
      event.preventDefault();
      if ((spatialDirection === "left" || spatialDirection === "right")
        && adjustFocusedControl(screen, spatialDirection === "right" ? 1 : -1)) {
        return;
      }
      focusSpatialElement(screen, spatialDirection);
      return;
    }
    if (event.action === "ui-next" || event.action === "ui-page-next") {
      event.preventDefault();
      focusSequentialElement(screen, 1);
    } else if (event.action === "ui-previous" || event.action === "ui-page-previous") {
      event.preventDefault();
      focusSequentialElement(screen, -1);
    }
  });

  useEffect(() => {
    if (!view) {
      triggerRef.current?.focus();
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      if (screenRef.current) focusInitialElement(screenRef.current);
    });
    return () => window.cancelAnimationFrame(frame);
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
        <section
          aria-label={copy.menu}
          aria-modal="true"
          className="play-menu-screen"
          ref={screenRef}
          role="dialog"
          tabIndex={-1}
        >
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
              inputPreferences={inputPreferences}
              locale={locale}
              onAudioPreferencesChange={onAudioPreferencesChange}
              onBack={onViewBack}
              onCameraModeChange={onCameraModeChange}
              onCategoryChange={onSettingsCategoryChange}
              onFirstPersonAvatarModeChange={onFirstPersonAvatarModeChange}
              onInputPreferencesChange={onInputPreferencesChange}
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
