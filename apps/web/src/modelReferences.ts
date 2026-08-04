import * as THREE from "three";
import type {
  ArticulationJoint,
  FeatureGraph,
  FeatureGroup,
  ModelFeature,
  ModelRecord,
  ModelReferenceInstance,
  Vector3Tuple,
} from "@solidloom/shared";

const REFERENCE_GROUP_PREFIX = "model-reference:";

export interface ModelReferenceResolutionIssue {
  referenceId: string;
  kind: "missing-model" | "circular-reference";
  message: string;
}

export interface ResolvedModelReferences {
  features: ModelFeature[];
  groups: FeatureGroup[];
  issues: ModelReferenceResolutionIssue[];
  referenceIdByFeatureId: Map<string, string>;
  sourceRevisionByReferenceId: Map<string, number>;
}

export function mergeLatestModelsPreservingIdentity(
  current: ModelRecord[],
  latest: ModelRecord[],
): ModelRecord[] {
  const latestById = new Map(latest.map((model) => [model.id, model]));
  const currentIds = new Set(current.map((model) => model.id));
  const next = [
    ...current.flatMap((model) => {
      const replacement = latestById.get(model.id);
      if (!replacement) return [];
      return replacement.revision === model.revision && replacement.updatedAt === model.updatedAt
        ? [model]
        : [replacement];
    }),
    ...latest.filter((model) => !currentIds.has(model.id)),
  ];
  return next.length === current.length && next.every((model, index) => model === current[index])
    ? current
    : next;
}

export function referenceViewportGroupId(referenceId: string): string {
  return `${REFERENCE_GROUP_PREFIX}${referenceId}`;
}

export function referenceIdFromViewportGroupId(groupId: string): string | null {
  return groupId.startsWith(REFERENCE_GROUP_PREFIX) ? groupId.slice(REFERENCE_GROUP_PREFIX.length) : null;
}

function transformMatrix(transform: Pick<ModelFeature | FeatureGroup | ModelReferenceInstance, "position" | "rotation" | "scale">): THREE.Matrix4 {
  const position = new THREE.Vector3(...transform.position);
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(transform.rotation[0]),
    THREE.MathUtils.degToRad(transform.rotation[1]),
    THREE.MathUtils.degToRad(transform.rotation[2]),
    "XYZ",
  );
  const scale = new THREE.Vector3(...(transform.scale ?? [1, 1, 1]));
  return new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(euler), scale);
}

function decomposeTransform(matrix: THREE.Matrix4): Pick<ModelFeature, "position" | "rotation" | "scale"> {
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, rotation, scale);
  const euler = new THREE.Euler().setFromQuaternion(rotation, "XYZ");
  return {
    position: position.toArray() as Vector3Tuple,
    rotation: [
      THREE.MathUtils.radToDeg(euler.x),
      THREE.MathUtils.radToDeg(euler.y),
      THREE.MathUtils.radToDeg(euler.z),
    ],
    scale: scale.toArray() as Vector3Tuple,
  };
}

function jointMatrix(joint: ArticulationJoint): THREE.Matrix4 {
  const axis = new THREE.Vector3(...joint.axis);
  if (axis.lengthSq() < 0.000001) return new THREE.Matrix4();
  const pivot = new THREE.Vector3(...joint.pivot);
  const rotation = new THREE.Matrix4().makeRotationAxis(
    axis.normalize(),
    THREE.MathUtils.degToRad(joint.value - joint.restValue),
  );
  return new THREE.Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(rotation)
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
}

function flattenReferencedModel(
  model: ModelRecord,
  modelById: Map<string, ModelRecord>,
  prefix: string,
  parentMatrix: THREE.Matrix4,
  ancestry: Set<string>,
  issues: ModelReferenceResolutionIssue[],
  rootReferenceId: string,
  jointValues?: Record<string, number>,
): ModelFeature[] {
  const groupByFeatureId = new Map<string, FeatureGroup>();
  const jointByGroupId = new Map((model.featureGraph.joints ?? []).map((joint) => [joint.groupId, joint]));
  for (const group of model.featureGraph.groups ?? []) {
    for (const featureId of group.featureIds) groupByFeatureId.set(featureId, group);
  }

  const features = model.featureGraph.features.map((feature) => {
    const group = groupByFeatureId.get(feature.id);
    const matrix = parentMatrix.clone();
    if (group) {
      matrix.multiply(transformMatrix(group));
      const joint = jointByGroupId.get(group.id);
      if (joint) matrix.multiply(jointMatrix({
        ...joint,
        value: jointValues?.[joint.id] ?? joint.value,
      }));
    }
    matrix.multiply(transformMatrix(feature));
    return {
      ...structuredClone(feature),
      id: `${prefix}${feature.id}`,
      ...decomposeTransform(matrix),
    } as ModelFeature;
  });

  for (const nested of model.featureGraph.references ?? []) {
    const source = modelById.get(nested.modelId);
    if (!source) {
      issues.push({
        referenceId: rootReferenceId,
        kind: "missing-model",
        message: `引用模型 ${nested.modelId} 不存在。`,
      });
      continue;
    }
    if (ancestry.has(source.id)) {
      issues.push({
        referenceId: rootReferenceId,
        kind: "circular-reference",
        message: `模型引用形成循环：${source.name}。`,
      });
      continue;
    }
    const nextAncestry = new Set(ancestry).add(source.id);
    features.push(...flattenReferencedModel(
      source,
      modelById,
      `${prefix}${nested.id}:`,
      parentMatrix.clone().multiply(transformMatrix(nested)),
      nextAncestry,
      issues,
      rootReferenceId,
      nested.jointValues,
    ));
  }
  return features;
}

export function resolveModelReferences(
  graph: FeatureGraph,
  models: ModelRecord[],
  rootModelId?: string,
): ResolvedModelReferences {
  const modelById = new Map(models.map((model) => [model.id, model]));
  const issues: ModelReferenceResolutionIssue[] = [];
  const features: ModelFeature[] = [];
  const groups: FeatureGroup[] = [];
  const referenceIdByFeatureId = new Map<string, string>();
  const sourceRevisionByReferenceId = new Map<string, number>();

  for (const reference of graph.references ?? []) {
    const source = modelById.get(reference.modelId);
    if (!source) {
      issues.push({
        referenceId: reference.id,
        kind: "missing-model",
        message: `引用模型 ${reference.modelId} 不存在。`,
      });
      continue;
    }
    if (source.id === rootModelId) {
      issues.push({
        referenceId: reference.id,
        kind: "circular-reference",
        message: `模型不能引用自身：${source.name}。`,
      });
      continue;
    }
    const prefix = `${referenceViewportGroupId(reference.id)}:`;
    const referenceFeatures = flattenReferencedModel(
      source,
      modelById,
      prefix,
      new THREE.Matrix4(),
      new Set([rootModelId, source.id].filter(Boolean) as string[]),
      issues,
      reference.id,
      reference.jointValues,
    );
    if (reference.roomSurfaceMode && reference.roomSurfaceMode !== "source") {
      for (const feature of referenceFeatures) {
        if (feature.type !== "mesh" || feature.parameters.source?.kind !== "room-shell") continue;
        feature.parameters.source.autoHideSurfaces = reference.roomSurfaceMode === "interior";
      }
    }
    const featureIds = referenceFeatures.map((feature) => feature.id);
    for (const featureId of featureIds) referenceIdByFeatureId.set(featureId, reference.id);
    sourceRevisionByReferenceId.set(reference.id, source.revision);
    features.push(...referenceFeatures);
    groups.push({
      id: referenceViewportGroupId(reference.id),
      name: reference.name,
      featureIds,
      position: reference.position,
      rotation: reference.rotation,
      scale: reference.scale ?? [1, 1, 1],
    });
  }

  return { features, groups, issues, referenceIdByFeatureId, sourceRevisionByReferenceId };
}
