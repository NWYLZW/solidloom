import { describe, expect, it } from "vitest";
import {
  readPlayUrlState,
  updatePlayUrlPathname,
  updatePlayUrlSearch,
} from "./usePlayUrlState";

describe("play URL state", () => {
  it("restores the page from the path and camera state from the query", () => {
    expect(readPlayUrlState(
      "/play/scene-1/settings",
      "?camera=first-person&first-person-avatar=body",
    )).toEqual({
      cameraMode: "first-person",
      firstPersonAvatarMode: "body",
      menuView: "settings",
      settingsCategory: "appearance",
    });
    expect(readPlayUrlState("/play/scene-1/menu", "").menuView).toBe("menu");
  });

  it("falls back for unsupported URL values", () => {
    expect(readPlayUrlState(
      "/play/scene-1/unknown",
      "?camera=sideways&first-person-avatar=feet",
    )).toEqual({
      cameraMode: "third-person",
      firstPersonAvatarMode: "automatic",
      menuView: null,
      settingsCategory: "appearance",
    });
  });

  it("preserves unrelated parameters and removes default state", () => {
    const openSettings = updatePlayUrlSearch("?interaction-ui=panel&menu=settings", {
      cameraMode: "god",
    });
    expect(new URLSearchParams(openSettings).get("interaction-ui")).toBe("panel");
    expect(new URLSearchParams(openSettings).has("menu")).toBe(false);
    expect(new URLSearchParams(openSettings).get("camera")).toBe("god");

    const avatarBody = updatePlayUrlSearch(`?${openSettings}`, {
      firstPersonAvatarMode: "body",
    });
    expect(new URLSearchParams(avatarBody).get("first-person-avatar")).toBe("body");

    const cleared = updatePlayUrlSearch(`?${avatarBody}`, {
      cameraMode: "third-person",
      firstPersonAvatarMode: "automatic",
    });
    expect(new URLSearchParams(cleared).get("interaction-ui")).toBe("panel");
    expect(new URLSearchParams(cleared).has("camera")).toBe(false);
    expect(new URLSearchParams(cleared).has("first-person-avatar")).toBe(false);
  });

  it("uses paths for menu pages", () => {
    expect(updatePlayUrlPathname("/play/scene-1", "menu")).toBe("/play/scene-1/menu");
    expect(updatePlayUrlPathname("/play/scene-1/menu", "settings"))
      .toBe("/play/scene-1/settings/appearance");
    expect(updatePlayUrlPathname("/play/scene-1/settings/appearance", "settings", "audio"))
      .toBe("/play/scene-1/settings/audio");
    expect(updatePlayUrlPathname("/play/scene-1/settings/audio", "settings", "controls"))
      .toBe("/play/scene-1/settings/controls");
    expect(updatePlayUrlPathname("/play/scene-1/character", null)).toBe("/play/scene-1");
  });

  it("restores a settings category from the path", () => {
    expect(readPlayUrlState("/play/scene-1/settings/camera", "").settingsCategory)
      .toBe("camera");
    expect(readPlayUrlState("/play/scene-1/settings/controls", "").settingsCategory)
      .toBe("controls");
    expect(readPlayUrlState("/play/scene-1/settings/unsupported", "").settingsCategory)
      .toBe("appearance");
  });
});
