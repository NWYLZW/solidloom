import { describe, expect, it } from "vitest";
import { DEFAULT_PLAY_MENU_ITEMS, resolvePlayMenuItems } from "./playMenu";

describe("resolvePlayMenuItems", () => {
  it("provides the complete game menu by default", () => {
    expect(resolvePlayMenuItems(undefined)).toEqual(DEFAULT_PLAY_MENU_ITEMS);
  });

  it("preserves configured order and removes duplicates", () => {
    expect(resolvePlayMenuItems(["return-workshop", "character", "character"]))
      .toEqual(["return-workshop", "character"]);
  });

  it("allows a scene to hide every menu entry", () => {
    expect(resolvePlayMenuItems([])).toEqual([]);
  });
});
