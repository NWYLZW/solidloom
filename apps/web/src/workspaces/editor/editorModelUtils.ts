import {
  applyFeatureGraphExpressions,
  regenerateProceduralMeshFeature,
  synchronizeRoomAssemblyFeatures,
  type FeatureGraph,
  type ModelFeature,
  type ModelRecord,
  type RoomShellSource,
  type Vector3Tuple,
} from "@solidloom/shared";

export function cloneModel(model: ModelRecord): ModelRecord {
  const clone = structuredClone(model);
  clone.featureGraph.groups ??= [];
  clone.featureGraph.features = clone.featureGraph.features.map((feature) => ({ ...feature, scale: feature.scale ?? [1, 1, 1] }));
  clone.featureGraph.groups = clone.featureGraph.groups.map((group) => ({ ...group, scale: group.scale ?? [1, 1, 1] }));
  return clone;
}

export function comparableModel(model: ModelRecord | null): string {
  if (!model) return "";
  return JSON.stringify({ name: model.name, description: model.description, unit: model.unit, featureGraph: model.featureGraph });
}

export function meshDimensions(feature: Extract<ModelFeature, { type: "mesh" }>): Vector3Tuple {
  const positions = feature.parameters.positions;
  const axes = [0, 1, 2].map((axis) => positions.filter((_, index) => index % 3 === axis));
  const scale = feature.scale ?? [1, 1, 1];
  return axes.map((values, axis) => (Math.max(...values) - Math.min(...values)) * Math.abs(scale[axis]!)) as Vector3Tuple;
}

export function rebuildParameterizedFeatureGraph(featureGraph: FeatureGraph) {
  const firstPass = applyFeatureGraphExpressions(featureGraph);
  let roomSource: RoomShellSource | null = null;
  const regeneratedFeatures = firstPass.featureGraph.features.map((feature) => {
    if (feature.type !== "mesh" || !feature.parameters.source) return feature;
    const regenerated = regenerateProceduralMeshFeature(feature, feature.parameters.source);
    if (regenerated.parameters.source?.kind === "room-shell") roomSource = regenerated.parameters.source;
    return regenerated;
  });
  const synchronizedFeatures = roomSource ? synchronizeRoomAssemblyFeatures(regeneratedFeatures, roomSource) : regeneratedFeatures;
  const secondPass = applyFeatureGraphExpressions({ ...firstPass.featureGraph, features: synchronizedFeatures });
  return { featureGraph: secondPass.featureGraph, issues: [...firstPass.issues, ...secondPass.issues] };
}
