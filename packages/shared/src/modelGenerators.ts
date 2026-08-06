import type {
  FeatureGraph,
  FeatureGroup,
  ModelFeature,
} from "./types.js";
import {
  createSnackCabinet,
  normalizeSnackCabinetColors,
  snackCabinetGeneratorId,
  snackCabinetVariableIds,
  type SnackCabinetColors,
  type SnackCabinetFinish,
  type SnackCabinetShelfInventory,
} from "./models/cyberFactory/snackCabinet.js";

type FeatureGraphGeneratorHandler = (featureGraph: FeatureGraph) => FeatureGraph;

function numberVariable(featureGraph: FeatureGraph, id: string): number | undefined {
  const value = featureGraph.variables?.find((variable) => variable.id === id)?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function colorVariable(featureGraph: FeatureGraph, id: string): string | undefined {
  const value = featureGraph.variables?.find((variable) => variable.id === id)?.value;
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : undefined;
}

function snackCabinetFinish(value: unknown): SnackCabinetFinish | undefined {
  return value === "graphite" || value === "porcelain" || value === "sage" ? value : undefined;
}

function snackCabinetColors(value: unknown): Partial<SnackCabinetColors> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const entries = Object.entries(source).flatMap(([key, color]) => (
    typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color) ? [[key, color.toUpperCase()]] : []
  ));
  return Object.fromEntries(entries) as Partial<SnackCabinetColors>;
}

function snackCabinetInventory(value: unknown): readonly SnackCabinetShelfInventory[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const shelves: SnackCabinetShelfInventory[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return undefined;
    const shelf = candidate as Record<string, unknown>;
    if (typeof shelf.id !== "string" || !Array.isArray(shelf.products)) return undefined;
    const products = shelf.products.map((item) => {
      if (!item || typeof item !== "object") return null;
      const product = item as Record<string, unknown>;
      if (typeof product.id !== "string" || typeof product.label !== "string" || typeof product.color !== "string") return null;
      return {
        id: product.id,
        label: product.label,
        color: product.color,
        ...(typeof product.width === "number" ? { width: product.width } : {}),
        ...(typeof product.height === "number" ? { height: product.height } : {}),
        ...(typeof product.depth === "number" ? { depth: product.depth } : {}),
        ...(product.material === "default" || product.material === "wood" || product.material === "metal"
          || product.material === "plastic" || product.material === "glass" || product.material === "fabric"
          || product.material === "rubber" ? { material: product.material } : {}),
      };
    });
    if (products.some((product) => product === null)) return undefined;
    shelves.push({
      id: shelf.id,
      products: products as SnackCabinetShelfInventory["products"],
      ...(shelf.fillMode === "exact" || shelf.fillMode === "repeat" ? { fillMode: shelf.fillMode } : {}),
    });
  }
  return shelves;
}

function preserveFeatureOverrides(
  generated: ModelFeature[],
  current: ModelFeature[],
  baseline: ModelFeature[] = generated,
): ModelFeature[] {
  const currentById = new Map(current.map((feature) => [feature.id, feature]));
  const baselineById = new Map(baseline.map((feature) => [feature.id, feature]));
  return generated.map((feature) => {
    const previous = currentById.get(feature.id);
    if (!previous) return feature;
    const baselineFeature = baselineById.get(feature.id);
    const appearanceWasOverridden = previous.appearance
      && JSON.stringify(previous.appearance) !== JSON.stringify(baselineFeature?.appearance);
    return {
      ...feature,
      ...(appearanceWasOverridden ? { appearance: previous.appearance } : {}),
      ...(previous.parameterExpressions ? { parameterExpressions: previous.parameterExpressions } : {}),
    } as ModelFeature;
  });
}

function preserveGroupTransforms(generated: FeatureGroup[] = [], current: FeatureGroup[] = []): FeatureGroup[] {
  const currentById = new Map(current.map((group) => [group.id, group]));
  return generated.map((group) => {
    const previous = currentById.get(group.id);
    if (!previous) return group;
    return {
      ...group,
      position: previous.position,
      rotation: previous.rotation,
      ...(previous.scale ? { scale: previous.scale } : {}),
    };
  });
}

const regenerateSnackCabinet: FeatureGraphGeneratorHandler = (featureGraph) => {
  const options = featureGraph.generator?.options ?? {};
  const width = numberVariable(featureGraph, snackCabinetVariableIds.width);
  const height = numberVariable(featureGraph, snackCabinetVariableIds.height);
  const depth = numberVariable(featureGraph, snackCabinetVariableIds.depth);
  const finish = snackCabinetFinish(options.finish);
  const inventory = snackCabinetInventory(options.inventory);
  const previousColors = normalizeSnackCabinetColors(snackCabinetColors(options.colors), finish);
  const colors: SnackCabinetColors = {
    body: colorVariable(featureGraph, snackCabinetVariableIds.bodyColor) ?? previousColors.body,
    trim: colorVariable(featureGraph, snackCabinetVariableIds.trimColor) ?? previousColors.trim,
    accent: colorVariable(featureGraph, snackCabinetVariableIds.accentColor) ?? previousColors.accent,
    shelf: colorVariable(featureGraph, snackCabinetVariableIds.shelfColor) ?? previousColors.shelf,
    glass: colorVariable(featureGraph, snackCabinetVariableIds.glassColor) ?? previousColors.glass,
    darkGlass: colorVariable(featureGraph, snackCabinetVariableIds.darkGlassColor) ?? previousColors.darkGlass,
  };
  const generatorInput = {
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    ...(depth === undefined ? {} : { depth }),
    ...(finish === undefined ? {} : { finish }),
    ...(inventory === undefined ? {} : { inventory }),
  };
  const baseline = createSnackCabinet({ ...generatorInput, colors: previousColors }).featureGraph!;
  const generated = createSnackCabinet({ ...generatorInput, colors }).featureGraph!;
  const currentJointValues = new Map((featureGraph.joints ?? []).map((joint) => [joint.id, joint.value]));
  return {
    ...featureGraph,
    ...generated,
    features: preserveFeatureOverrides(generated.features, featureGraph.features, baseline.features),
    groups: preserveGroupTransforms(generated.groups, featureGraph.groups),
    joints: (generated.joints ?? []).map((joint) => ({
      ...joint,
      value: currentJointValues.get(joint.id) ?? joint.value,
    })),
    generator: generated.generator!,
  };
};

const featureGraphGeneratorHandlers = new Map<string, FeatureGraphGeneratorHandler>([
  [snackCabinetGeneratorId, regenerateSnackCabinet],
]);

export function regenerateGeneratedFeatureGraph(featureGraph: FeatureGraph): FeatureGraph {
  const generatorId = featureGraph.generator?.id;
  if (!generatorId) return featureGraph;
  return featureGraphGeneratorHandlers.get(generatorId)?.(featureGraph) ?? featureGraph;
}
