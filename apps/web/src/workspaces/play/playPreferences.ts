import type { EditorLocale } from "../editor/editorCopy";
import { clamp, readNumberPreference, readPreference } from "../editor/workspacePreferences";
import {
  DEFAULT_INPUT_PREFERENCES,
  INPUT_ACTIONS,
  cloneInputPreferences,
  type GamepadBinding,
  type InputDigitalAction,
  type InputPreferences,
} from "../../input";

export type PlayTheme = "dark" | "light" | "system";

export interface PlayAudioPreferences {
  muted: boolean;
  volume: number;
}

export const PLAY_AUDIO_PREFERENCES_EVENT = "solidloom:play-audio-preferences-change";

const PLAY_AUDIO_MUTED_STORAGE_KEY = "solidloom.play.audio.muted.v1";
const PLAY_AUDIO_VOLUME_STORAGE_KEY = "solidloom.play.audio.volume.v1";
const PLAY_INPUT_PREFERENCES_STORAGE_KEY = "solidloom.play.input.v1";

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

function isGamepadBinding(value: unknown): value is GamepadBinding {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GamepadBinding>;
  return candidate.kind === "button" && typeof candidate.control === "string"
    || candidate.kind === "axis"
      && typeof candidate.control === "string"
      && (candidate.direction === -1 || candidate.direction === 1);
}

export function normalizePlayInputPreferences(value: unknown): InputPreferences {
  const defaults = cloneInputPreferences(DEFAULT_INPUT_PREFERENCES);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<InputPreferences>;
  const normalized = {
    ...defaults,
    deadzone: clamp(Number(candidate.deadzone ?? defaults.deadzone), 0, 0.45),
    invertLookY: candidate.invertLookY === true,
    lookSensitivity: clamp(Number(candidate.lookSensitivity ?? defaults.lookSensitivity), 0.1, 3),
    moveSensitivity: clamp(Number(candidate.moveSensitivity ?? defaults.moveSensitivity), 0.1, 2),
    responseCurve: clamp(Number(candidate.responseCurve ?? defaults.responseCurve), 0.2, 3),
    uiRepeatDelayMs: clamp(Number(candidate.uiRepeatDelayMs ?? defaults.uiRepeatDelayMs), 120, 900),
    uiRepeatIntervalMs: clamp(Number(candidate.uiRepeatIntervalMs ?? defaults.uiRepeatIntervalMs), 40, 400),
  } satisfies InputPreferences;

  for (const action of INPUT_ACTIONS) {
    const keyboardPair = candidate.keyboardBindings?.[action];
    if (keyboardPair && typeof keyboardPair === "object") {
      normalized.keyboardBindings[action] = {
        alternate: typeof keyboardPair.alternate === "string" ? keyboardPair.alternate : null,
        primary: typeof keyboardPair.primary === "string" ? keyboardPair.primary : null,
      };
    }
    const gamepadPair = candidate.gamepadBindings?.[action];
    if (gamepadPair && typeof gamepadPair === "object") {
      normalized.gamepadBindings[action] = {
        alternate: isGamepadBinding(gamepadPair.alternate) ? { ...gamepadPair.alternate } : null,
        primary: isGamepadBinding(gamepadPair.primary) ? { ...gamepadPair.primary } : null,
      };
    }
  }

  if (candidate.customGamepads && typeof candidate.customGamepads === "object") {
    normalized.customGamepads = Object.fromEntries(Object.entries(candidate.customGamepads)
      .filter((entry): entry is [string, NonNullable<typeof entry[1]>] => (
        Boolean(entry[1]) && typeof entry[1] === "object"
      ))
      .map(([id, profile]) => [id, {
        axes: { ...(profile.axes ?? {}) },
        buttons: { ...(profile.buttons ?? {}) },
        updatedAt: Number(profile.updatedAt) || Date.now(),
      }]));
  }
  return normalized;
}

export function readPlayInputPreferences(): InputPreferences {
  try {
    const stored = window.localStorage.getItem(PLAY_INPUT_PREFERENCES_STORAGE_KEY);
    return normalizePlayInputPreferences(stored ? JSON.parse(stored) : null);
  } catch {
    return cloneInputPreferences(DEFAULT_INPUT_PREFERENCES);
  }
}

export function savePlayInputPreferences(preferences: InputPreferences) {
  try {
    window.localStorage.setItem(
      PLAY_INPUT_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizePlayInputPreferences(preferences)),
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
