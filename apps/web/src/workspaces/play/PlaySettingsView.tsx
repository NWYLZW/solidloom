import { Camera, Gamepad2, Languages, Monitor, Volume2 } from "lucide-react";
import type { InputPreferences } from "../../input";
import {
  NAVIGATION_FIRST_PERSON_AVATAR_MODES,
  type NavigationFirstPersonAvatarMode,
} from "../../navigationAvatar";
import type { NavigationCameraMode } from "../../Viewport3D";
import type { EditorLocale } from "../editor/editorCopy";
import { playCopyByLocale } from "./playCopy";
import type { PlayAudioPreferences, PlayTheme } from "./playPreferences";
import { PlaySubpageHeader } from "./PlaySubpageHeader";
import { PlayRangeField } from "./controls/PlayRangeField";
import { PlaySelectField } from "./controls/PlaySelectField";
import { PlayToggleField } from "./controls/PlayToggleField";
import { PlayControlsSettings } from "./controls/PlayControlsSettings";
import type { PlaySettingsCategory } from "./usePlayUrlState";
import "./PlaySettingsView.css";

const CAMERA_MODES: NavigationCameraMode[] = ["god", "first-person", "third-person"];
const SETTINGS_CATEGORIES: PlaySettingsCategory[] = [
  "appearance",
  "audio",
  "camera",
  "controls",
  "general",
];

const CATEGORY_ICONS = {
  appearance: Monitor,
  audio: Volume2,
  camera: Camera,
  controls: Gamepad2,
  general: Languages,
} as const;

interface PlaySettingsViewProps {
  audioPreferences: PlayAudioPreferences;
  cameraLabels: Record<NavigationCameraMode, string>;
  cameraMode: NavigationCameraMode;
  category: PlaySettingsCategory;
  firstPersonAvatarMode: NavigationFirstPersonAvatarMode;
  inputPreferences: InputPreferences;
  locale: EditorLocale;
  onAudioPreferencesChange: (preferences: PlayAudioPreferences) => void;
  onBack: () => void;
  onCameraModeChange: (mode: NavigationCameraMode) => void;
  onCategoryChange: (category: PlaySettingsCategory) => void;
  onFirstPersonAvatarModeChange: (mode: NavigationFirstPersonAvatarMode) => void;
  onInputPreferencesChange: (preferences: InputPreferences) => void;
  onLocaleChange: (locale: EditorLocale) => void;
  onThemeChange: (theme: PlayTheme) => void;
  theme: PlayTheme;
}

export function PlaySettingsView({
  audioPreferences,
  cameraLabels,
  cameraMode,
  category,
  firstPersonAvatarMode,
  inputPreferences,
  locale,
  onAudioPreferencesChange,
  onBack,
  onCameraModeChange,
  onCategoryChange,
  onFirstPersonAvatarModeChange,
  onInputPreferencesChange,
  onLocaleChange,
  onThemeChange,
  theme,
}: PlaySettingsViewProps) {
  const copy = playCopyByLocale[locale];
  const categoryCopy = {
    appearance: {
      description: copy.appearanceDescription,
      label: copy.appearance,
    },
    audio: { description: copy.audioDescription, label: copy.audio },
    camera: { description: copy.cameraDescription, label: copy.camera },
    controls: {
      description: locale === "zh-CN"
        ? "重映射键盘与手柄，并调整摇杆、观察和界面连发。"
        : "Remap keyboard and gamepad input, sticks, look, and UI repeat.",
      label: locale === "zh-CN" ? "控制" : "Controls",
    },
    general: { description: copy.generalDescription, label: copy.general },
  } satisfies Record<PlaySettingsCategory, { description: string; label: string }>;
  const activeCategory = categoryCopy[category];
  const cameraOptions = CAMERA_MODES.map((mode) => ({
    label: cameraLabels[mode],
    value: mode,
  }));
  const firstPersonAvatarOptions = NAVIGATION_FIRST_PERSON_AVATAR_MODES.map((mode) => ({
    description: copy.firstPersonAvatarModes[mode].description,
    label: copy.firstPersonAvatarModes[mode].label,
    value: mode,
  }));

  const renderSettings = () => {
    if (category === "appearance") {
      return (
        <PlaySelectField
          label={copy.theme}
          onChange={onThemeChange}
          options={[
            { label: copy.themeSystem, value: "system" },
            { label: copy.themeLight, value: "light" },
            { label: copy.themeDark, value: "dark" },
          ]}
          value={theme}
        />
      );
    }

    if (category === "audio") {
      return (
        <>
          <PlayRangeField
            label={copy.audioVolume}
            maximum={100}
            minimum={0}
            suffix="%"
            value={audioPreferences.volume}
            onChange={(volume) => onAudioPreferencesChange({
              ...audioPreferences,
              volume,
            })}
          />
          <PlayToggleField
            checked={audioPreferences.muted}
            description={copy.audioMutedDescription}
            label={copy.audioMuted}
            onChange={(muted) => onAudioPreferencesChange({
              ...audioPreferences,
              muted,
            })}
          />
        </>
      );
    }

    if (category === "general") {
      return (
        <PlaySelectField
          label={copy.language}
          onChange={onLocaleChange}
          options={[
            { label: "中文", value: "zh-CN" },
            { label: "English", value: "en" },
          ]}
          value={locale}
        />
      );
    }

    if (category === "controls") {
      return (
        <PlayControlsSettings
          locale={locale}
          onChange={onInputPreferencesChange}
          preferences={inputPreferences}
        />
      );
    }

    return (
      <>
        <PlaySelectField
          label={copy.cameraMode}
          onChange={onCameraModeChange}
          options={cameraOptions}
          value={cameraMode}
        />

        {cameraMode === "first-person" && (
          <PlaySelectField
            description={copy.firstPersonAvatarDescription}
            label={copy.firstPersonAvatar}
            onChange={onFirstPersonAvatarModeChange}
            options={firstPersonAvatarOptions}
            value={firstPersonAvatarMode}
          />
        )}
      </>
    );
  };

  return (
    <div className="play-settings-view">
      <PlaySubpageHeader backLabel={copy.backToMenu} onBack={onBack} title={copy.settings} />

      <div className="play-settings-view-layout">
        <nav className="play-settings-view-categories" aria-label={copy.settings}>
          {SETTINGS_CATEGORIES.map((settingsCategory) => {
            const Icon = CATEGORY_ICONS[settingsCategory];
            return (
              <button
                aria-current={settingsCategory === category ? "page" : undefined}
                key={settingsCategory}
                type="button"
                onClick={() => onCategoryChange(settingsCategory)}
              >
                <span className="play-settings-category-icon">
                  <Icon aria-hidden="true" size={18} />
                </span>
                <span>{categoryCopy[settingsCategory].label}</span>
              </button>
            );
          })}
        </nav>

        <main className="play-settings-view-content">
          <div className="play-settings-view-heading">
            <div>
              <h2>{activeCategory.label}</h2>
              <p>{activeCategory.description}</p>
            </div>
          </div>

          <div className="play-settings-fields">{renderSettings()}</div>
        </main>
      </div>
    </div>
  );
}
