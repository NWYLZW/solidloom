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
    return [feature.parameters.width, feature.parameters.height, feature.parameters.depth];
  }
  const diameter = feature.parameters.radius * 2;
  return [diameter, feature.parameters.height, diameter];
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
