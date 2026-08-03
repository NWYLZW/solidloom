import type { FeatureGraph, ModelFeature, Vector3Tuple } from "@solidloom/shared";

export interface GraphIssue {
  level: "error" | "warning";
  featureId?: string;
  message: string;
}

export interface PreviewBounds {
  min: Vector3Tuple;
  max: Vector3Tuple;
  size: Vector3Tuple;
}

export interface GraphInspection {
  valid: boolean;
  engineStatus: "preview-only";
  issues: GraphIssue[];
  bounds: PreviewBounds | null;
}

function dimensions(feature: ModelFeature): Vector3Tuple {
  if (feature.type === "box") {
    const scale = feature.scale ?? [1, 1, 1];
    return [feature.parameters.width * Math.abs(scale[0]), feature.parameters.height * Math.abs(scale[1]), feature.parameters.depth * Math.abs(scale[2])];
  }
  if (feature.type === "cylinder") {
    const diameter = feature.parameters.radius * 2;
    const scale = feature.scale ?? [1, 1, 1];
    return [diameter * Math.abs(scale[0]), feature.parameters.height * Math.abs(scale[1]), diameter * Math.abs(scale[2])];
  }
  const positions = feature.parameters.positions;
  const xs = positions.filter((_, index) => index % 3 === 0);
  const ys = positions.filter((_, index) => index % 3 === 1);
  const zs = positions.filter((_, index) => index % 3 === 2);
  const scale = feature.scale ?? [1, 1, 1];
  return [
    (Math.max(...xs) - Math.min(...xs)) * Math.abs(scale[0]),
    (Math.max(...ys) - Math.min(...ys)) * Math.abs(scale[1]),
    (Math.max(...zs) - Math.min(...zs)) * Math.abs(scale[2]),
  ];
}

function featureBounds(feature: ModelFeature): { min: Vector3Tuple; max: Vector3Tuple } {
  const [width, height, depth] = dimensions(feature);
  const [x, y, z] = feature.position;
  return {
    min: [x - width / 2, y - height / 2, z - depth / 2],
    max: [x + width / 2, y + height / 2, z + depth / 2],
  };
}

export function inspectFeatureGraph(graph: FeatureGraph): GraphInspection {
  const issues: GraphIssue[] = [];
  const seen = new Set<string>();
  const groupIds = new Set<string>();
  const groupedFeatureIds = new Set<string>();

  for (const [index, feature] of graph.features.entries()) {
    if (seen.has(feature.id)) {
      issues.push({ level: "error", featureId: feature.id, message: "Feature ids must be unique." });
    }
    seen.add(feature.id);

    if (index === 0 && feature.operation === "cut") {
      issues.push({ level: "warning", featureId: feature.id, message: "A cut feature has no earlier additive body." });
    }
    if (feature.operation === "cut") {
      issues.push({
        level: "warning",
        featureId: feature.id,
        message: "Cut is stored and previewed but is not yet evaluated by a production B-Rep kernel.",
      });
    }
    if ((feature.scale ?? [1, 1, 1]).some((value) => value <= 0)) {
      issues.push({ level: "error", featureId: feature.id, message: "Feature scale components must be positive." });
    }
    if (feature.type === "mesh") {
      const { indices, normals, positions } = feature.parameters;
      const vertexCount = positions.length / 3;
      if (positions.length % 3 !== 0 || normals.length !== positions.length || indices.length % 3 !== 0) {
        issues.push({ level: "error", featureId: feature.id, message: "Mesh positions, normals, and triangle indices must have compatible lengths." });
      }
      if (indices.some((vertexIndex) => vertexIndex >= vertexCount)) {
        issues.push({ level: "error", featureId: feature.id, message: "Mesh indices may only reference existing vertices." });
      }
    }
  }

  for (const group of graph.groups ?? []) {
    if (groupIds.has(group.id)) {
      issues.push({ level: "error", message: "Feature group ids must be unique." });
    }
    groupIds.add(group.id);
    if ((group.scale ?? [1, 1, 1]).some((value) => value <= 0)) {
      issues.push({ level: "error", message: "Feature group scale components must be positive." });
    }
    for (const featureId of group.featureIds) {
      if (!seen.has(featureId)) {
        issues.push({ level: "error", featureId, message: "Feature groups may only reference existing features." });
      }
      if (groupedFeatureIds.has(featureId)) {
        issues.push({ level: "error", featureId, message: "A feature may only belong to one feature group." });
      }
      groupedFeatureIds.add(featureId);
    }
  }

  const additive = graph.features.filter((feature) => feature.operation === "add");
  if (additive.length === 0) {
    return {
      valid: issues.every((issue) => issue.level !== "error"),
      engineStatus: "preview-only",
      issues,
      bounds: null,
    };
  }

  const bounds = additive.map(featureBounds);
  const min: Vector3Tuple = [
    Math.min(...bounds.map((item) => item.min[0])),
    Math.min(...bounds.map((item) => item.min[1])),
    Math.min(...bounds.map((item) => item.min[2])),
  ];
  const max: Vector3Tuple = [
    Math.max(...bounds.map((item) => item.max[0])),
    Math.max(...bounds.map((item) => item.max[1])),
    Math.max(...bounds.map((item) => item.max[2])),
  ];

  return {
    valid: issues.every((issue) => issue.level !== "error"),
    engineStatus: "preview-only",
    issues,
    bounds: {
      min,
      max,
      size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    },
  };
}
