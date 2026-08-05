import { describe, expect, it } from "vitest";
import type { BoxFeature } from "@solidloom/shared";
import {
  featureShadowPolicy,
  shouldRefreshShadowMap,
  shouldScheduleViewportFrame,
} from "../apps/web/src/renderPerformance";

const feature = (overrides: Partial<BoxFeature> = {}): BoxFeature => ({
  id: "surface",
  name: "表面",
  type: "box",
  operation: "add",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  parameters: { width: 100, depth: 100, height: 20 },
  ...overrides,
});

describe("viewport render performance policies", () => {
  it("keeps glass and cutters out of the shadow pass", () => {
    expect(featureShadowPolicy(feature({ appearance: { material: "glass" } }), 100)).toEqual({
      cast: false,
      receive: false,
    });
    expect(featureShadowPolicy(feature({ operation: "cut" }), 100)).toEqual({
      cast: false,
      receive: false,
    });
  });

  it("lets small details receive light without spending a shadow draw call", () => {
    expect(featureShadowPolicy(feature(), 8)).toEqual({ cast: false, receive: true });
    expect(featureShadowPolicy(feature({ scale: [3, 1, 1] }), 8)).toEqual({ cast: true, receive: true });
    expect(featureShadowPolicy(feature(), 32)).toEqual({ cast: true, receive: true });
  });

  it("stops scheduling frames when the viewport is completely idle", () => {
    expect(shouldScheduleViewportFrame({
      controlsChanged: false,
      jointAnimationActive: false,
      navigationActive: false,
      renderRequested: false,
      transformActive: false,
      viewTransitionActive: false,
    })).toBe(false);
    expect(shouldScheduleViewportFrame({
      controlsChanged: false,
      jointAnimationActive: false,
      navigationActive: true,
      renderRequested: false,
      transformActive: false,
      viewTransitionActive: false,
    })).toBe(true);
  });

  it("refreshes shadows only for scene changes", () => {
    expect(shouldRefreshShadowMap({
      jointAnimationActive: false,
      navigationObjectChanged: false,
      roomVisibilityChanged: false,
      transformActive: false,
    })).toBe(false);
    expect(shouldRefreshShadowMap({
      jointAnimationActive: false,
      navigationObjectChanged: true,
      roomVisibilityChanged: false,
      transformActive: false,
    })).toBe(true);
  });
});
