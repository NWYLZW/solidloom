import { useCallback, useEffect, useState } from "react";
import {
  NAVIGATION_FIRST_PERSON_AVATAR_MODES,
  type NavigationFirstPersonAvatarMode,
} from "../../navigationAvatar";
import type { NavigationCameraMode } from "../../Viewport3D";
import { readPreference } from "../editor/workspacePreferences";

export type PlayMenuView = "character" | "menu" | "settings";
export type PlaySettingsCategory = "appearance" | "audio" | "camera" | "general";

export interface PlayUrlState {
  cameraMode: NavigationCameraMode;
  firstPersonAvatarMode: NavigationFirstPersonAvatarMode;
  menuView: PlayMenuView | null;
  settingsCategory: PlaySettingsCategory;
}

interface PlayUrlStatePatch {
  cameraMode?: NavigationCameraMode;
  firstPersonAvatarMode?: NavigationFirstPersonAvatarMode;
  menuView?: PlayMenuView | null;
  settingsCategory?: PlaySettingsCategory;
}

const DEFAULT_CAMERA_MODE: NavigationCameraMode = "third-person";
const DEFAULT_FIRST_PERSON_AVATAR_MODE: NavigationFirstPersonAvatarMode = "automatic";
const DEFAULT_SETTINGS_CATEGORY: PlaySettingsCategory = "appearance";
const PLAY_HISTORY_MARKER = "solidloomPlayMenuNavigation";
const PLAY_CAMERA_STORAGE_KEY = "solidloom.play.camera-mode";
const PLAY_FIRST_PERSON_AVATAR_STORAGE_KEY = "solidloom.play.firstPersonAvatarMode.v1";
const CAMERA_MODES = new Set<NavigationCameraMode>(["god", "first-person", "third-person"]);
const FIRST_PERSON_AVATAR_MODES = new Set<NavigationFirstPersonAvatarMode>(
  NAVIGATION_FIRST_PERSON_AVATAR_MODES,
);
const MENU_VIEWS = new Set<PlayMenuView>(["character", "menu", "settings"]);
const SETTINGS_CATEGORIES = new Set<PlaySettingsCategory>([
  "appearance",
  "audio",
  "camera",
  "general",
]);

function readMenuView(pathname: string): PlayMenuView | null {
  const requested = pathname.match(
    /^\/play\/[^/]+\/(menu|settings|character)(?:\/[^/]+)?\/?$/,
  )?.[1];
  return MENU_VIEWS.has(requested as PlayMenuView) ? (requested as PlayMenuView) : null;
}

function readSettingsCategory(pathname: string): PlaySettingsCategory {
  const requested = pathname.match(/^\/play\/[^/]+\/settings\/([^/]+)\/?$/)?.[1];
  return SETTINGS_CATEGORIES.has(requested as PlaySettingsCategory)
    ? (requested as PlaySettingsCategory)
    : DEFAULT_SETTINGS_CATEGORY;
}

export function readPlayUrlState(pathname: string, search: string): PlayUrlState {
  const params = new URLSearchParams(search);
  const requestedCamera = params.get("camera") as NavigationCameraMode | null;
  const requestedFirstPersonAvatar = params.get("first-person-avatar") as NavigationFirstPersonAvatarMode | null;
  return {
    cameraMode: requestedCamera && CAMERA_MODES.has(requestedCamera)
      ? requestedCamera
      : DEFAULT_CAMERA_MODE,
    firstPersonAvatarMode: requestedFirstPersonAvatar
      && FIRST_PERSON_AVATAR_MODES.has(requestedFirstPersonAvatar)
      ? requestedFirstPersonAvatar
      : DEFAULT_FIRST_PERSON_AVATAR_MODE,
    menuView: readMenuView(pathname),
    settingsCategory: readSettingsCategory(pathname),
  };
}

export function updatePlayUrlSearch(search: string, patch: PlayUrlStatePatch): string {
  const params = new URLSearchParams(search);
  params.delete("menu");
  if (patch.cameraMode !== undefined) {
    if (patch.cameraMode === DEFAULT_CAMERA_MODE) params.delete("camera");
    else params.set("camera", patch.cameraMode);
  }
  if (patch.firstPersonAvatarMode !== undefined) {
    if (patch.firstPersonAvatarMode === DEFAULT_FIRST_PERSON_AVATAR_MODE) {
      params.delete("first-person-avatar");
    } else {
      params.set("first-person-avatar", patch.firstPersonAvatarMode);
    }
  }
  return params.toString();
}

export function updatePlayUrlPathname(
  pathname: string,
  menuView: PlayMenuView | null,
  settingsCategory = DEFAULT_SETTINGS_CATEGORY,
): string {
  const match = pathname.match(
    /^(\/play\/[^/]+)(?:\/(?:menu|settings|character)(?:\/[^/]+)?)?\/?$/,
  );
  if (!match?.[1]) return pathname;
  if (menuView === "settings") return `${match[1]}/settings/${settingsCategory}`;
  return menuView ? `${match[1]}/${menuView}` : match[1];
}

function hasPlayHistoryMarker() {
  return Boolean(window.history.state?.[PLAY_HISTORY_MARKER]);
}

function readCurrentPlayUrlState(): PlayUrlState {
  const parsed = readPlayUrlState(window.location.pathname, window.location.search);
  const params = new URLSearchParams(window.location.search);
  const requestedCamera = params.get("camera");
  const requestedFirstPersonAvatar = params.get("first-person-avatar");
  return {
    ...parsed,
    cameraMode: requestedCamera && CAMERA_MODES.has(requestedCamera as NavigationCameraMode)
      ? parsed.cameraMode
      : readPreference(
          PLAY_CAMERA_STORAGE_KEY,
          [...CAMERA_MODES],
          DEFAULT_CAMERA_MODE,
        ),
    firstPersonAvatarMode: requestedFirstPersonAvatar
      && FIRST_PERSON_AVATAR_MODES.has(requestedFirstPersonAvatar as NavigationFirstPersonAvatarMode)
      ? parsed.firstPersonAvatarMode
      : readPreference(
          PLAY_FIRST_PERSON_AVATAR_STORAGE_KEY,
          NAVIGATION_FIRST_PERSON_AVATAR_MODES,
          DEFAULT_FIRST_PERSON_AVATAR_MODE,
        ),
  };
}

function normalizeCurrentPreferenceUrl(state: PlayUrlState) {
  const url = new URL(window.location.href);
  const nextSearch = updatePlayUrlSearch(url.search, {
    cameraMode: state.cameraMode,
    firstPersonAvatarMode: state.firstPersonAvatarMode,
  });
  const normalizedSearch = nextSearch ? `?${nextSearch}` : "";
  if (url.search === normalizedSearch) return;
  url.search = normalizedSearch;
  window.history.replaceState(window.history.state, "", url);
}

export function usePlayUrlState() {
  const [state, setState] = useState<PlayUrlState>(readCurrentPlayUrlState);

  useEffect(() => {
    const syncFromUrl = () => {
      const nextState = readCurrentPlayUrlState();
      normalizeCurrentPreferenceUrl(nextState);
      setState(nextState);
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const commit = useCallback((patch: PlayUrlStatePatch, replace = false) => {
    const url = new URL(window.location.href);
    const nextSearch = updatePlayUrlSearch(url.search, patch);
    if (patch.menuView !== undefined || patch.settingsCategory !== undefined) {
      const currentUrlState = readPlayUrlState(url.pathname, url.search);
      const nextMenuView = patch.menuView !== undefined
        ? patch.menuView
        : currentUrlState.menuView;
      const nextSettingsCategory = patch.settingsCategory ?? currentUrlState.settingsCategory;
      url.pathname = updatePlayUrlPathname(
        url.pathname,
        nextMenuView,
        nextSettingsCategory,
      );
    }
    url.search = nextSearch ? `?${nextSearch}` : "";
    const nextState = {
      ...window.history.state,
      ...(replace ? {} : { [PLAY_HISTORY_MARKER]: true }),
    };
    window.history[replace ? "replaceState" : "pushState"](nextState, "", url);
    setState(readPlayUrlState(url.pathname, url.search));
  }, []);

  const openMenuView = useCallback((view: PlayMenuView) => {
    commit({ menuView: view });
  }, [commit]);

  const returnToMenu = useCallback(() => {
    if (hasPlayHistoryMarker()) window.history.back();
    else commit({ menuView: "menu" }, true);
  }, [commit]);

  const closeMenu = useCallback(() => {
    if (hasPlayHistoryMarker()) window.history.back();
    else commit({ menuView: null }, true);
  }, [commit]);

  const setCameraMode = useCallback((cameraMode: NavigationCameraMode) => {
    try {
      window.localStorage.setItem(PLAY_CAMERA_STORAGE_KEY, cameraMode);
    } catch {
      // 本机存储不可用时，URL 仍保存当前设置。
    }
    commit({ cameraMode }, true);
  }, [commit]);

  const setFirstPersonAvatarMode = useCallback((
    firstPersonAvatarMode: NavigationFirstPersonAvatarMode,
  ) => {
    try {
      window.localStorage.setItem(PLAY_FIRST_PERSON_AVATAR_STORAGE_KEY, firstPersonAvatarMode);
    } catch {
      // 本机存储不可用时，URL 仍保存当前设置。
    }
    commit({ firstPersonAvatarMode }, true);
  }, [commit]);

  const setSettingsCategory = useCallback((settingsCategory: PlaySettingsCategory) => {
    commit({ settingsCategory }, true);
  }, [commit]);

  return {
    closeMenu,
    openMenuView,
    returnToMenu,
    setCameraMode,
    setFirstPersonAvatarMode,
    setSettingsCategory,
    state,
  };
}
