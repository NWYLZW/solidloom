import type { ModelFeature } from "@solidloom/shared";

const MINIMUM_SHADOW_CASTER_RADIUS = 16;

export interface FeatureShadowPolicy {
  cast: boolean;
  receive: boolean;
}

export interface ViewportFrameActivity {
  controlsChanged: boolean;
  jointAnimationActive: boolean;
  navigationActive: boolean;
  renderRequested: boolean;
  transformActive: boolean;
  viewTransitionActive: boolean;
}

export interface ShadowRefreshActivity {
  jointAnimationActive: boolean;
  navigationObjectChanged: boolean;
  roomVisibilityChanged: boolean;
  transformActive: boolean;
}

export function featureShadowPolicy(
  feature: ModelFeature,
  geometryBoundingRadius: number,
): FeatureShadowPolicy {
  if (feature.operation !== "add" || feature.appearance?.material === "glass") {
    return { cast: false, receive: false };
  }

  const scale = feature.scale ?? [1, 1, 1];
  const largestScale = Math.max(...scale.map((value) => Math.abs(value)));
  return {
    cast: geometryBoundingRadius * largestScale >= MINIMUM_SHADOW_CASTER_RADIUS,
    receive: true,
  };
}

export function shouldScheduleViewportFrame(activity: ViewportFrameActivity) {
  return activity.renderRequested
    || activity.controlsChanged
    || activity.viewTransitionActive
    || activity.jointAnimationActive
    || activity.transformActive
    || activity.navigationActive;
}

export function shouldRefreshShadowMap(activity: ShadowRefreshActivity) {
  return activity.jointAnimationActive
    || activity.navigationObjectChanged
    || activity.roomVisibilityChanged
    || activity.transformActive;
}
