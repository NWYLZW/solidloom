import type { EditorLocale } from "../editor/editorCopy";
import { clamp, readNumberPreference, readPreference } from "../editor/workspacePreferences";

export type PlayTheme = "dark" | "light" | "system";

export interface PlayAudioPreferences {
  muted: boolean;
  volume: number;
}

export const PLAY_AUDIO_PREFERENCES_EVENT = "solidloom:play-audio-preferences-change";

const PLAY_AUDIO_MUTED_STORAGE_KEY = "solidloom.play.audio.muted.v1";
const PLAY_AUDIO_VOLUME_STORAGE_KEY = "solidloom.play.audio.volume.v1";

export function readPlayLocale(): EditorLocale {
  return readPreference("solidloom.locale", ["zh-CN", "en"], "zh-CN");
}

export function readPlayTheme(): PlayTheme {
  return readPreference("solidloom.theme", ["light", "dark", "system"], "system");
}

export function readPlayAudioPreferences(): PlayAudioPreferences {
  return {
    muted: readPreference(
      PLAY_AUDIO_MUTED_STORAGE_KEY,
      ["true", "false"],
      "false",
    ) === "true",
    volume: readNumberPreference(PLAY_AUDIO_VOLUME_STORAGE_KEY, 80, 0, 100),
  };
}

export function savePlayAudioPreferences(preferences: PlayAudioPreferences) {
  try {
    window.localStorage.setItem(PLAY_AUDIO_MUTED_STORAGE_KEY, String(preferences.muted));
    window.localStorage.setItem(
      PLAY_AUDIO_VOLUME_STORAGE_KEY,
      String(clamp(preferences.volume, 0, 100)),
    );
  } catch {
    // 本机存储不可用时，当前运行会话中的设置仍然有效。
  }
}

function applyPreferencesToMediaElement(
  element: HTMLMediaElement,
  preferences: PlayAudioPreferences,
) {
  const storedBaseVolume = Number(element.dataset.playBaseVolume);
  const baseVolume = Number.isFinite(storedBaseVolume) ? storedBaseVolume : element.volume;
  if (!Number.isFinite(storedBaseVolume)) {
    element.dataset.playBaseVolume = String(baseVolume);
  }
  element.muted = preferences.muted;
  element.volume = clamp(baseVolume * preferences.volume / 100, 0, 1);
}

export function publishPlayAudioPreferences(preferences: PlayAudioPreferences) {
  const normalized = {
    muted: preferences.muted,
    volume: clamp(preferences.volume, 0, 100),
  } satisfies PlayAudioPreferences;
  document.documentElement.style.setProperty(
    "--play-audio-volume",
    String(normalized.volume / 100),
  );
  document.querySelectorAll<HTMLMediaElement>("audio, video").forEach((element) => {
    applyPreferencesToMediaElement(element, normalized);
  });
  window.dispatchEvent(new CustomEvent<PlayAudioPreferences>(
    PLAY_AUDIO_PREFERENCES_EVENT,
    { detail: normalized },
  ));
}
