import type { FeatureGraph, Vector3Tuple } from "../types.js";
import type {
  ModelAssetDefinition,
  ModelAssetManifest,
  ModelAssetTarget,
  ModelAssetValidationIssue,
  ModelAssetValidationResult,
} from "./types.js";

const STABLE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function issue(
  issues: ModelAssetValidationIssue[],
  code: ModelAssetValidationIssue["code"],
  path: string,
  message: string,
) {
  issues.push({ code, path, message });
}

function isFiniteVector(value: Vector3Tuple) {
  return value.length === 3 && value.every(Number.isFinite);
}

function validateStableId(
  issues: ModelAssetValidationIssue[],
  value: string,
  path: string,
) {
  if (!STABLE_ID_PATTERN.test(value)) {
    issue(issues, "invalid-id", path, "ID 必须使用稳定的小写 kebab-case。");
  }
}

function validateUniqueIds(
  issues: ModelAssetValidationIssue[],
  values: ReadonlyArray<{ id: string }>,
  path: string,
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    validateStableId(issues, value.id, `${path}[${index}].id`);
    if (seen.has(value.id)) {
      issue(issues, "duplicate-id", `${path}[${index}].id`, `重复 ID：${value.id}`);
    }
    seen.add(value.id);
  });
}

function validateTarget(
  issues: ModelAssetValidationIssue[],
  target: ModelAssetTarget,
  path: string,
  graph: FeatureGraph,
) {
  const featureIds = new Set(graph.features.map((feature) => feature.id));
  const groupIds = new Set((graph.groups ?? []).map((group) => group.id));
  const jointIds = new Set((graph.joints ?? []).map((joint) => joint.id));

  if (target.featureId && !featureIds.has(target.featureId)) {
    issue(issues, "missing-feature", `${path}.featureId`, `找不到特征：${target.featureId}`);
  }
  if (target.groupId && !groupIds.has(target.groupId)) {
    issue(issues, "missing-group", `${path}.groupId`, `找不到分组：${target.groupId}`);
  }
  if (target.jointId && !jointIds.has(target.jointId)) {
    issue(issues, "missing-joint", `${path}.jointId`, `找不到关节：${target.jointId}`);
  }
}

function validateParameters(
  issues: ModelAssetValidationIssue[],
  manifest: ModelAssetManifest,
) {
  manifest.parameters.forEach((parameter, index) => {
    const path = `manifest.parameters[${index}]`;
    if (parameter.type === "number") {
      if (typeof parameter.defaultValue !== "number" || !Number.isFinite(parameter.defaultValue)) {
        issue(issues, "invalid-parameter", `${path}.defaultValue`, "数字参数必须提供有限默认值。");
      }
      if (parameter.minimum !== undefined && parameter.maximum !== undefined && parameter.minimum > parameter.maximum) {
        issue(issues, "invalid-parameter", path, "参数最小值不能大于最大值。");
      }
      if (parameter.step !== undefined && parameter.step <= 0) {
        issue(issues, "invalid-parameter", `${path}.step`, "参数步进必须大于 0。");
      }
    }
    if (parameter.type === "boolean" && typeof parameter.defaultValue !== "boolean") {
      issue(issues, "invalid-parameter", `${path}.defaultValue`, "布尔参数必须提供布尔默认值。");
    }
    if (parameter.type === "select") {
      if (typeof parameter.defaultValue !== "string" || !parameter.options?.includes(parameter.defaultValue)) {
        issue(issues, "invalid-parameter", `${path}.defaultValue`, "选择参数的默认值必须存在于选项中。");
      }
    }
  });
}

function validateProfiles(
  issues: ModelAssetValidationIssue[],
  manifest: ModelAssetManifest,
  graph: FeatureGraph,
) {
  const featureIds = new Set(graph.features.map((feature) => feature.id));
  const devices = new Set<string>();
  manifest.lod.forEach((profile, profileIndex) => {
    if (devices.has(profile.device)) {
      issue(issues, "duplicate-profile", `manifest.lod[${profileIndex}].device`, `设备 ${profile.device} 只能有一个 LOD 配置。`);
    }
    devices.add(profile.device);
    let previousDistance = -Infinity;
    profile.levels.forEach((level, levelIndex) => {
      const path = `manifest.lod[${profileIndex}].levels[${levelIndex}]`;
      validateStableId(issues, level.id, `${path}.id`);
      if (!Number.isFinite(level.maximumDistance) || level.maximumDistance <= previousDistance) {
        issue(issues, "invalid-lod", `${path}.maximumDistance`, "LOD 距离必须有限并严格递增。");
      }
      if (level.triangleBudget !== undefined && (!Number.isInteger(level.triangleBudget) || level.triangleBudget <= 0)) {
        issue(issues, "invalid-lod", `${path}.triangleBudget`, "三角形预算必须是正整数。");
      }
      level.featureIds?.forEach((featureId, featureIndex) => {
        if (!featureIds.has(featureId)) {
          issue(issues, "missing-feature", `${path}.featureIds[${featureIndex}]`, `找不到特征：${featureId}`);
        }
      });
      previousDistance = level.maximumDistance;
    });
  });
  (["desktop", "mobile"] as const).forEach((device) => {
    if (!devices.has(device)) {
      issue(issues, "invalid-lod", "manifest.lod", `缺少 ${device} LOD 配置。`);
    }
  });
}

export function validateModelAssetDefinition(definition: ModelAssetDefinition): ModelAssetValidationResult {
  const issues: ModelAssetValidationIssue[] = [];
  const { manifest } = definition;
  const model = definition.createModel();
  const graph = model.featureGraph;

  if (manifest.schemaVersion !== 1) {
    issue(issues, "model-mismatch", "manifest.schemaVersion", "暂时只支持模型资产契约版本 1。");
  }
  validateStableId(issues, manifest.id, "manifest.id");
  if (!SEMVER_PATTERN.test(manifest.version)) {
    issue(issues, "invalid-version", "manifest.version", "资产版本必须使用 semver。");
  }
  if (!graph) {
    issue(issues, "model-mismatch", "model.featureGraph", "资产工厂必须返回 featureGraph。");
    return { valid: false, issues };
  }
  if (model.name !== manifest.displayName || (model.unit ?? "mm") !== manifest.modelUnit) {
    issue(issues, "model-mismatch", "model", "模型名称和单位必须与 manifest 一致。");
  }

  validateUniqueIds(issues, manifest.parameters, "manifest.parameters");
  validateUniqueIds(issues, manifest.materials, "manifest.materials");
  validateUniqueIds(issues, manifest.colliders, "manifest.colliders");
  validateUniqueIds(issues, manifest.anchors, "manifest.anchors");
  validateUniqueIds(issues, manifest.joints, "manifest.joints");
  validateParameters(issues, manifest);

  if (!Number.isFinite(manifest.placement.groundY)
    || !isFiniteVector(manifest.placement.origin)
    || !isFiniteVector(manifest.placement.defaultScale)
    || manifest.placement.defaultScale.some((value) => value <= 0)) {
    issue(issues, "invalid-placement", "manifest.placement", "放置基准必须使用有限坐标和正数缩放。");
  }

  manifest.materials.forEach((slot, index) => {
    if (slot.color && !HEX_COLOR_PATTERN.test(slot.color)) {
      issue(issues, "invalid-color", `manifest.materials[${index}].color`, "颜色必须使用 #RRGGBB。");
    }
    slot.featureIds.forEach((featureId, featureIndex) => {
      if (!graph.features.some((feature) => feature.id === featureId)) {
        issue(issues, "missing-feature", `manifest.materials[${index}].featureIds[${featureIndex}]`, `找不到特征：${featureId}`);
      }
    });
  });

  manifest.anchors.forEach((anchor, index) => {
    const path = `manifest.anchors[${index}]`;
    if (!isFiniteVector(anchor.position) || !isFiniteVector(anchor.rotation) || (anchor.range !== undefined && anchor.range <= 0)) {
      issue(issues, "invalid-anchor", path, "锚点坐标必须有限，交互距离必须大于 0。");
    }
    validateTarget(issues, anchor, path, graph);
  });

  manifest.colliders.forEach((collider, index) => {
    const path = `manifest.colliders[${index}]`;
    if (!isFiniteVector(collider.position)
      || !isFiniteVector(collider.rotation)
      || !isFiniteVector(collider.size)
      || collider.size.some((value) => value <= 0)
      || (collider.shape !== "box" && (!collider.radius || collider.radius <= 0))
      || (collider.shape !== "box" && (!collider.height || collider.height <= 0))) {
      issue(issues, "invalid-collider", path, "碰撞体尺寸必须为正数且坐标有限。");
    }
    validateTarget(issues, collider, path, graph);
  });

  manifest.joints.forEach((joint, index) => {
    validateTarget(issues, { jointId: joint.jointId }, `manifest.joints[${index}]`, graph);
  });

  const previewDevices = new Set<string>();
  manifest.previews.forEach((preview, index) => {
    if (previewDevices.has(preview.device)) {
      issue(issues, "duplicate-profile", `manifest.previews[${index}].device`, `设备 ${preview.device} 只能有一个预览配置。`);
    }
    previewDevices.add(preview.device);
    if (!isFiniteVector(preview.cameraPosition) || !isFiniteVector(preview.cameraTarget)) {
      issue(issues, "invalid-preview", `manifest.previews[${index}]`, "预览相机坐标必须有限。");
    }
  });
  (["desktop", "mobile"] as const).forEach((device) => {
    if (!previewDevices.has(device)) {
      issue(issues, "invalid-preview", "manifest.previews", `缺少 ${device} 预览配置。`);
    }
  });

  validateProfiles(issues, manifest, graph);
  return { valid: issues.length === 0, issues };
}

export function assertModelAssetDefinition(definition: ModelAssetDefinition) {
  const result = validateModelAssetDefinition(definition);
  if (!result.valid) {
    const detail = result.issues.map((entry) => `${entry.path}: ${entry.message}`).join("\n");
    throw new Error(`模型资产 ${definition.manifest.id} 校验失败：\n${detail}`);
  }
  return definition;
}
