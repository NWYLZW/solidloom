import { describe, expect, it } from "vitest";
import type { BoxFeature } from "@solidloom/shared";
import { resolveVoxelSkinFaceRegions, resolveVoxelSkinOverlayDimensions } from "../apps/web/src/voxelSkin";

const skinnedBox = (
  part: NonNullable<NonNullable<BoxFeature["appearance"]>["voxelSkin"]>["part"],
  size: [number, number, number],
  model: "classic" | "slim" = "classic",
): BoxFeature => ({
  id: `skin-${part}`,
  name: part,
  type: "box",
  operation: "add",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  parameters: { width: size[0], height: size[1], depth: size[2] },
  appearance: { voxelSkin: { model, part, url: "builtin:solidloom-block-avatar" } },
});

describe("voxel skin layout", () => {
  it("maps the head base and overlay faces from a 64×64 skin", () => {
    const head = resolveVoxelSkinFaceRegions("head", "classic");
    expect(head.front).toEqual({ base: [8, 8, 8, 8], overlay: [40, 8, 8, 8] });
    expect(head.top).toEqual({ base: [8, 0, 8, 8], overlay: [40, 0, 8, 8] });
  });

  it("uses four-pixel classic arms and three-pixel slim arms", () => {
    expect(resolveVoxelSkinFaceRegions("rightArm", "classic").front.base).toEqual([44, 20, 4, 12]);
    expect(resolveVoxelSkinFaceRegions("rightArm", "slim").front.base).toEqual([44, 20, 3, 12]);
    expect(resolveVoxelSkinFaceRegions("leftArm", "classic").front.base).toEqual([36, 52, 4, 12]);
    expect(resolveVoxelSkinFaceRegions("leftArm", "slim").front.base).toEqual([36, 52, 3, 12]);
  });

  it("keeps the independent left and right leg regions", () => {
    expect(resolveVoxelSkinFaceRegions("rightLeg", "classic").front).toEqual({
      base: [4, 20, 4, 12],
      overlay: [4, 36, 4, 12],
    });
    expect(resolveVoxelSkinFaceRegions("leftLeg", "classic").front).toEqual({
      base: [20, 52, 4, 12],
      overlay: [4, 52, 4, 12],
    });
  });

  it("crops thigh and lower-leg textures from one standard leg layout", () => {
    expect(resolveVoxelSkinFaceRegions("leftLeg", "classic", "upper").front.base).toEqual([20, 52, 4, 6]);
    expect(resolveVoxelSkinFaceRegions("leftLeg", "classic", "lower").front.base).toEqual([20, 58, 4, 6]);
    expect(resolveVoxelSkinFaceRegions("rightLeg", "classic", "lower").front.overlay).toEqual([4, 42, 4, 6]);
    expect(resolveVoxelSkinFaceRegions("leftLeg", "classic", "foot").front.base).toEqual([20, 62, 4, 2]);
  });

  it("inflates the head and clothing into independent outer shells", () => {
    expect(resolveVoxelSkinOverlayDimensions(skinnedBox("head", [8, 8, 8]))).toEqual([9, 9, 9]);
    expect(resolveVoxelSkinOverlayDimensions(skinnedBox("torso", [8, 12, 4]))).toEqual([8.5, 12.5, 4.5]);
    expect(resolveVoxelSkinOverlayDimensions(skinnedBox("leftArm", [4, 12, 4], "slim"))).toEqual([4.5, 12.5, 4.5]);
  });
});
