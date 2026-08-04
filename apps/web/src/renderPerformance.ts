import type { ModelFeature } from "@solidloom/shared";

const MINIMUM_SHADOW_CASTER_RADIUS = 16;

export interface FeatureShadowPolicy {
  cast: boolean;
  receive: boolean;
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
