import {
  RUNTIME_DEFINITION_STATUSES,
  RUNTIME_DOMAIN_SCHEMA_VERSION,
  RUNTIME_GOAL_STATUSES,
  RUNTIME_METRIC_MODES,
  RUNTIME_RELATION_CARDINALITIES,
  RUNTIME_RELATION_DIRECTIONS,
  RUNTIME_RESOURCE_CONSERVATION_MODES,
  RUNTIME_SCOPE_KINDS,
  RUNTIME_STATE_STORAGES,
  type RuntimeComponentDefinition,
  type RuntimeDomainDefinitions,
  type RuntimeDomainMutation,
  type RuntimeDomainProjection,
  type RuntimeDomainSnapshot,
  type RuntimeEntityTypeDefinition,
  type RuntimeGoalDefinition,
  type RuntimeMetricDefinition,
  type RuntimeRelationTypeDefinition,
  type RuntimeResourceTypeDefinition,
} from "./domain.js";

export type RuntimeDomainValidationCode = (
  "invalid-structure"
  | "invalid-value"
  | "duplicate-id"
  | "unknown-reference"
  | "state-boundary"
  | "relation-constraint"
  | "revision-conflict"
  | "scope-mismatch"
);

export interface RuntimeDomainValidationIssue {
  readonly code: RuntimeDomainValidationCode;
  readonly path: string;
  readonly message: string;
}

export class RuntimeDomainValidationError extends Error {
  readonly issues: readonly RuntimeDomainValidationIssue[];

  constructor(issues: readonly RuntimeDomainValidationIssue[]) {
    super(`运行时领域数据无效：${issues.map(({ message }) => message).join("；")}`);
    this.name = "RuntimeDomainValidationError";
    this.issues = Object.freeze([...issues]);
  }
}

const TYPE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9-]*)+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  issues: RuntimeDomainValidationIssue[],
  code: RuntimeDomainValidationCode,
  path: string,
  message: string,
) {
  issues.push({ code, path, message });
}

function onlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  issues: RuntimeDomainValidationIssue[],
) {
  const allowed = new Set(allowedKeys);
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) issue(issues, "invalid-structure", `${path}.${key}`, `${path}.${key} 不是受支持的字段`);
  });
}

function stringValue(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  options: { typeId?: boolean; maximum?: number } = {},
): value is string {
  if (typeof value !== "string" || value.length === 0) {
    issue(issues, "invalid-value", path, `${path} 必须是非空字符串`);
    return false;
  }
  if (options.maximum !== undefined && value.length > options.maximum) {
    issue(issues, "invalid-value", path, `${path} 长度不能超过 ${options.maximum}`);
  }
  if (options.typeId && !TYPE_ID_PATTERN.test(value)) {
    issue(issues, "invalid-value", path, `${path} 必须是带命名空间的类型 ID`);
  }
  return true;
}

function revisionValue(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
): value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    issue(issues, "invalid-value", path, `${path} 必须是非负整数修订号`);
    return false;
  }
  return true;
}

function finiteNumber(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issue(issues, "invalid-value", path, `${path} 必须是有限数值`);
    return false;
  }
  return true;
}

function timestampValue(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
): value is string {
  if (!stringValue(value, path, issues) || Number.isNaN(Date.parse(value))) {
    if (typeof value === "string" && value.length > 0) {
      issue(issues, "invalid-value", path, `${path} 必须是有效时间戳`);
    }
    return false;
  }
  return true;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: RuntimeDomainValidationIssue[],
): value is T {
  if (!allowed.includes(value as T)) {
    issue(issues, "invalid-value", path, `${path} 必须是 ${allowed.join("、")} 之一`);
    return false;
  }
  return true;
}

function jsonValue(value: unknown, path: string, issues: RuntimeDomainValidationIssue[]): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return true;
    issue(issues, "invalid-value", path, `${path} 不能包含非有限数值`);
    return false;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => jsonValue(item, `${path}[${index}]`, issues)).every(Boolean);
  }
  if (isRecord(value)) {
    return Object.entries(value).map(([key, item]) => jsonValue(item, `${path}.${key}`, issues)).every(Boolean);
  }
  issue(issues, "invalid-value", path, `${path} 必须是可 JSON 序列化的值`);
  return false;
}

function booleanValue(value: unknown, path: string, issues: RuntimeDomainValidationIssue[]) {
  if (typeof value !== "boolean") issue(issues, "invalid-value", path, `${path} 必须是布尔值`);
}

function uniqueStrings(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  options: { typeIds?: boolean; nonEmpty?: boolean } = {},
): readonly string[] {
  if (!Array.isArray(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是数组`);
    return [];
  }
  if (options.nonEmpty && value.length === 0) issue(issues, "invalid-value", path, `${path} 不能为空`);
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!stringValue(item, `${path}[${index}]`, issues, { typeId: options.typeIds === true })) return;
    if (seen.has(item)) issue(issues, "duplicate-id", `${path}[${index}]`, `${path} 存在重复值 ${item}`);
    seen.add(item);
  });
  return [...seen];
}

function scopeValue(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  expectedRunId?: string,
) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是作用域对象`);
    return;
  }
  onlyKeys(value, ["runId", "kind", "id"], path, issues);
  const hasRunId = stringValue(value.runId, `${path}.runId`, issues);
  enumValue(value.kind, RUNTIME_SCOPE_KINDS, `${path}.kind`, issues);
  const hasId = stringValue(value.id, `${path}.id`, issues);
  if (hasRunId && expectedRunId !== undefined && value.runId !== expectedRunId) {
    issue(issues, "scope-mismatch", `${path}.runId`, `${path}.runId 与外层运行实例不一致`);
  }
  if (hasRunId && hasId && value.kind === "run" && value.id !== value.runId) {
    issue(issues, "scope-mismatch", `${path}.id`, "run 作用域的 id 必须等于 runId");
  }
}

function expressionValue(value: unknown, path: string, issues: RuntimeDomainValidationIssue[]) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是表达式对象`);
    return;
  }
  onlyKeys(value, ["language", "source"], path, issues);
  if (value.language !== "solidloom-expression-v1") {
    issue(issues, "invalid-value", `${path}.language`, `${path}.language 必须是 solidloom-expression-v1`);
  }
  stringValue(value.source, `${path}.source`, issues, { maximum: 4_000 });
}

const DEFINITION_BASE_KEYS = ["kind", "id", "domainPackageId", "displayName", "description", "revision", "status"] as const;

function definitionBase(
  value: Record<string, unknown>,
  expectedKind: string,
  path: string,
  issues: RuntimeDomainValidationIssue[],
) {
  if (value.kind !== expectedKind) issue(issues, "invalid-value", `${path}.kind`, `${path}.kind 必须是 ${expectedKind}`);
  stringValue(value.id, `${path}.id`, issues, { typeId: true });
  stringValue(value.domainPackageId, `${path}.domainPackageId`, issues);
  stringValue(value.displayName, `${path}.displayName`, issues, { maximum: 120 });
  stringValue(value.description, `${path}.description`, issues, { maximum: 500 });
  revisionValue(value.revision, `${path}.revision`, issues);
  enumValue(value.status, RUNTIME_DEFINITION_STATUSES, `${path}.status`, issues);
}

function entityTypeDefinition(value: unknown, path: string, issues: RuntimeDomainValidationIssue[]) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是实体类型定义`);
    return;
  }
  onlyKeys(value, [...DEFINITION_BASE_KEYS, "componentTypeIds"], path, issues);
  definitionBase(value, "entity", path, issues);
  uniqueStrings(value.componentTypeIds, `${path}.componentTypeIds`, issues, { typeIds: true });
}

function componentDefinition(value: unknown, path: string, issues: RuntimeDomainValidationIssue[]) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是组件定义`);
    return;
  }
  definitionBase(value, "component", path, issues);
  const storageValid = enumValue(value.storage, RUNTIME_STATE_STORAGES, `${path}.storage`, issues);
  if (!isRecord(value.schema) || !jsonValue(value.schema, `${path}.schema`, issues)) {
    if (!isRecord(value.schema)) issue(issues, "invalid-structure", `${path}.schema`, `${path}.schema 必须是 JSON Schema 对象`);
  }
  if (value.defaultValue !== undefined) jsonValue(value.defaultValue, `${path}.defaultValue`, issues);

  if (storageValid && value.storage === "persistent") {
    onlyKeys(value, [...DEFINITION_BASE_KEYS, "storage", "schema", "defaultValue", "migrationId"], path, issues);
    if (value.migrationId !== undefined) stringValue(value.migrationId, `${path}.migrationId`, issues);
  } else if (storageValid && value.storage === "ephemeral") {
    onlyKeys(value, [...DEFINITION_BASE_KEYS, "storage", "schema", "defaultValue", "ttlMs"], path, issues);
    if (value.ttlMs !== undefined && (!finiteNumber(value.ttlMs, `${path}.ttlMs`, issues) || value.ttlMs <= 0)) {
      if (typeof value.ttlMs === "number" && Number.isFinite(value.ttlMs)) {
        issue(issues, "invalid-value", `${path}.ttlMs`, `${path}.ttlMs 必须大于零`);
      }
    }
  } else if (storageValid && value.storage === "derived") {
    onlyKeys(value, [...DEFINITION_BASE_KEYS, "storage", "schema", "dependencies", "expression"], path, issues);
    uniqueStrings(value.dependencies, `${path}.dependencies`, issues, { typeIds: true, nonEmpty: true });
    expressionValue(value.expression, `${path}.expression`, issues);
  }
}

function relationTypeDefinition(value: unknown, path: string, issues: RuntimeDomainValidationIssue[]) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是关系类型定义`);
    return;
  }
  onlyKeys(value, [
    ...DEFINITION_BASE_KEYS,
    "direction",
    "sourceCardinality",
    "targetCardinality",
    "sourceEntityTypeIds",
    "targetEntityTypeIds",
    "attributesSchema",
    "symmetric",
    "transitive",
    "uniquePair",
  ], path, issues);
  definitionBase(value, "relation", path, issues);
  enumValue(value.direction, RUNTIME_RELATION_DIRECTIONS, `${path}.direction`, issues);
  enumValue(value.sourceCardinality, RUNTIME_RELATION_CARDINALITIES, `${path}.sourceCardinality`, issues);
  enumValue(value.targetCardinality, RUNTIME_RELATION_CARDINALITIES, `${path}.targetCardinality`, issues);
  uniqueStrings(value.sourceEntityTypeIds, `${path}.sourceEntityTypeIds`, issues, { typeIds: true, nonEmpty: true });
  uniqueStrings(value.targetEntityTypeIds, `${path}.targetEntityTypeIds`, issues, { typeIds: true, nonEmpty: true });
  if (!isRecord(value.attributesSchema) || !jsonValue(value.attributesSchema, `${path}.attributesSchema`, issues)) {
    if (!isRecord(value.attributesSchema)) {
      issue(issues, "invalid-structure", `${path}.attributesSchema`, `${path}.attributesSchema 必须是 JSON Schema 对象`);
    }
  }
  booleanValue(value.symmetric, `${path}.symmetric`, issues);
  booleanValue(value.transitive, `${path}.transitive`, issues);
  booleanValue(value.uniquePair, `${path}.uniquePair`, issues);
  if (value.symmetric === true && value.direction !== "undirected") {
    issue(issues, "relation-constraint", `${path}.symmetric`, "对称关系必须声明为 undirected");
  }
}

function resourceTypeDefinition(value: unknown, path: string, issues: RuntimeDomainValidationIssue[]) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是资源类型定义`);
    return;
  }
  onlyKeys(value, [
    ...DEFINITION_BASE_KEYS,
    "unit",
    "precision",
    "divisible",
    "allowNegative",
    "conservation",
    "holderEntityTypeIds",
  ], path, issues);
  definitionBase(value, "resource", path, issues);
  stringValue(value.unit, `${path}.unit`, issues, { maximum: 80 });
  if (!revisionValue(value.precision, `${path}.precision`, issues) || (value.precision as number) > 12) {
    if (Number.isInteger(value.precision) && (value.precision as number) > 12) {
      issue(issues, "invalid-value", `${path}.precision`, `${path}.precision 不能超过 12`);
    }
  }
  booleanValue(value.divisible, `${path}.divisible`, issues);
  booleanValue(value.allowNegative, `${path}.allowNegative`, issues);
  enumValue(value.conservation, RUNTIME_RESOURCE_CONSERVATION_MODES, `${path}.conservation`, issues);
  uniqueStrings(value.holderEntityTypeIds, `${path}.holderEntityTypeIds`, issues, { typeIds: true });
  if (value.divisible === false && value.precision !== 0) {
    issue(issues, "invalid-value", `${path}.precision`, "不可分割资源的 precision 必须为 0");
  }
}

function metricDefinition(value: unknown, path: string, issues: RuntimeDomainValidationIssue[]) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是指标类型定义`);
    return;
  }
  definitionBase(value, "metric", path, issues);
  const modeValid = enumValue(value.mode, RUNTIME_METRIC_MODES, `${path}.mode`, issues);
  if (value.unit !== undefined) stringValue(value.unit, `${path}.unit`, issues, { maximum: 80 });
  if (modeValid && value.mode === "derived") {
    onlyKeys(value, [...DEFINITION_BASE_KEYS, "mode", "unit", "dependencies", "expression"], path, issues);
    uniqueStrings(value.dependencies, `${path}.dependencies`, issues, { typeIds: true, nonEmpty: true });
    expressionValue(value.expression, `${path}.expression`, issues);
  } else if (modeValid) {
    onlyKeys(value, [...DEFINITION_BASE_KEYS, "mode", "unit"], path, issues);
  }
}

function goalDefinition(value: unknown, path: string, issues: RuntimeDomainValidationIssue[]) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是目标定义`);
    return;
  }
  onlyKeys(value, [...DEFINITION_BASE_KEYS, "allowedScopeKinds", "completion", "progress", "failure"], path, issues);
  definitionBase(value, "goal", path, issues);
  if (!Array.isArray(value.allowedScopeKinds) || value.allowedScopeKinds.length === 0) {
    issue(issues, "invalid-value", `${path}.allowedScopeKinds`, `${path}.allowedScopeKinds 必须是非空数组`);
  } else {
    const seen = new Set<string>();
    value.allowedScopeKinds.forEach((kind, index) => {
      enumValue(kind, RUNTIME_SCOPE_KINDS, `${path}.allowedScopeKinds[${index}]`, issues);
      if (typeof kind === "string" && seen.has(kind)) {
        issue(issues, "duplicate-id", `${path}.allowedScopeKinds[${index}]`, `${path}.allowedScopeKinds 存在重复值 ${kind}`);
      }
      if (typeof kind === "string") seen.add(kind);
    });
  }
  expressionValue(value.completion, `${path}.completion`, issues);
  if (value.progress !== undefined) expressionValue(value.progress, `${path}.progress`, issues);
  if (value.failure !== undefined) expressionValue(value.failure, `${path}.failure`, issues);
}

const DEFINITION_COLLECTIONS = [
  ["entityTypes", entityTypeDefinition],
  ["componentTypes", componentDefinition],
  ["relationTypes", relationTypeDefinition],
  ["resourceTypes", resourceTypeDefinition],
  ["metricTypes", metricDefinition],
  ["goalTypes", goalDefinition],
] as const;

function recordsById<T extends { readonly id: string }>(values: readonly T[]) {
  return new Map(values.map((value) => [value.id, value]));
}

export function validateRuntimeDomainDefinitions(value: unknown): readonly RuntimeDomainValidationIssue[] {
  const issues: RuntimeDomainValidationIssue[] = [];
  if (!isRecord(value)) return Object.freeze([{
    code: "invalid-structure",
    path: "definitions",
    message: "definitions 必须是对象",
  }]);
  onlyKeys(value, ["schemaVersion", "revision", ...DEFINITION_COLLECTIONS.map(([key]) => key)], "definitions", issues);
  if (value.schemaVersion !== RUNTIME_DOMAIN_SCHEMA_VERSION) {
    issue(issues, "invalid-value", "definitions.schemaVersion", `definitions.schemaVersion 必须是 ${RUNTIME_DOMAIN_SCHEMA_VERSION}`);
  }
  revisionValue(value.revision, "definitions.revision", issues);
  const allIds = new Map<string, string>();
  for (const [key, validator] of DEFINITION_COLLECTIONS) {
    const collection = value[key];
    if (!Array.isArray(collection)) {
      issue(issues, "invalid-structure", `definitions.${key}`, `definitions.${key} 必须是数组`);
      continue;
    }
    collection.forEach((item, index) => {
      const path = `definitions.${key}[${index}]`;
      validator(item, path, issues);
      if (!isRecord(item) || typeof item.id !== "string") return;
      const owner = allIds.get(item.id);
      if (owner) issue(issues, "duplicate-id", `${path}.id`, `类型 ID ${item.id} 同时声明于 ${owner} 和 ${key}`);
      allIds.set(item.id, key);
    });
  }

  const validDefinitionRecords = (collection: unknown) => (
    Array.isArray(collection)
      ? collection.filter((item): item is Record<string, unknown> => isRecord(item) && typeof item.id === "string")
      : []
  );
  const entityTypeValues = validDefinitionRecords(value.entityTypes) as unknown as RuntimeEntityTypeDefinition[];
  const componentTypeValues = validDefinitionRecords(value.componentTypes) as unknown as RuntimeComponentDefinition[];
  const relationTypeValues = validDefinitionRecords(value.relationTypes) as unknown as RuntimeRelationTypeDefinition[];
  const resourceTypeValues = validDefinitionRecords(value.resourceTypes) as unknown as RuntimeResourceTypeDefinition[];
  const metricTypeValues = validDefinitionRecords(value.metricTypes) as unknown as RuntimeMetricDefinition[];
  const entityTypes = recordsById(entityTypeValues);
  const componentTypes = recordsById(componentTypeValues);
  entityTypeValues.forEach((definition, index) => {
    if (!Array.isArray(definition.componentTypeIds)) return;
    definition.componentTypeIds.forEach((componentTypeId, componentIndex) => {
      if (!componentTypes.has(componentTypeId)) {
        issue(issues, "unknown-reference", `definitions.entityTypes[${index}].componentTypeIds[${componentIndex}]`, `找不到组件类型 ${componentTypeId}`);
      }
    });
  });
  componentTypeValues.forEach((definition, index) => {
    if (definition.storage !== "derived" || !Array.isArray(definition.dependencies)) return;
    definition.dependencies.forEach((dependency, dependencyIndex) => {
      if (!componentTypes.has(dependency)) {
        issue(issues, "unknown-reference", `definitions.componentTypes[${index}].dependencies[${dependencyIndex}]`, `找不到派生组件依赖 ${dependency}`);
      }
    });
  });
  relationTypeValues.forEach((definition, index) => {
    const referencedEntityTypeIds = [
      ...(Array.isArray(definition.sourceEntityTypeIds) ? definition.sourceEntityTypeIds : []),
      ...(Array.isArray(definition.targetEntityTypeIds) ? definition.targetEntityTypeIds : []),
    ];
    referencedEntityTypeIds.forEach((entityTypeId) => {
      if (!entityTypes.has(entityTypeId)) {
        issue(issues, "unknown-reference", `definitions.relationTypes[${index}]`, `关系 ${definition.id} 引用了未知实体类型 ${entityTypeId}`);
      }
    });
  });
  resourceTypeValues.forEach((definition, index) => {
    if (!Array.isArray(definition.holderEntityTypeIds)) return;
    definition.holderEntityTypeIds.forEach((entityTypeId, holderIndex) => {
      if (!entityTypes.has(entityTypeId)) {
        issue(issues, "unknown-reference", `definitions.resourceTypes[${index}].holderEntityTypeIds[${holderIndex}]`, `找不到资源持有者实体类型 ${entityTypeId}`);
      }
    });
  });
  const metricTypes = recordsById(metricTypeValues);
  metricTypeValues.forEach((definition, index) => {
    if (definition.mode !== "derived" || !Array.isArray(definition.dependencies)) return;
    definition.dependencies.forEach((dependency, dependencyIndex) => {
      if (!metricTypes.has(dependency)) {
        issue(issues, "unknown-reference", `definitions.metricTypes[${index}].dependencies[${dependencyIndex}]`, `找不到派生指标依赖 ${dependency}`);
      }
    });
  });
  return Object.freeze(issues);
}

function uniqueRecordIds(
  values: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  validator: (value: unknown, path: string, issues: RuntimeDomainValidationIssue[]) => void,
) {
  if (!Array.isArray(values)) {
    issue(issues, "invalid-structure", path, `${path} 必须是数组`);
    return [] as Record<string, unknown>[];
  }
  const records: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const itemPath = `${path}[${index}]`;
    validator(value, itemPath, issues);
    if (!isRecord(value)) return;
    records.push(value);
    if (typeof value.id !== "string") return;
    if (seen.has(value.id)) issue(issues, "duplicate-id", `${itemPath}.id`, `${path} 存在重复 ID ${value.id}`);
    seen.add(value.id);
  });
  return records;
}

function persistentComponent(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  componentTypes?: ReadonlyMap<string, RuntimeComponentDefinition>,
) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是持久组件实例`);
    return;
  }
  onlyKeys(value, ["typeId", "value", "revision", "updatedAt"], path, issues);
  const hasTypeId = stringValue(value.typeId, `${path}.typeId`, issues, { typeId: true });
  jsonValue(value.value, `${path}.value`, issues);
  revisionValue(value.revision, `${path}.revision`, issues);
  timestampValue(value.updatedAt, `${path}.updatedAt`, issues);
  if (hasTypeId && componentTypes) {
    const definition = componentTypes.get(value.typeId as string);
    if (!definition) issue(issues, "unknown-reference", `${path}.typeId`, `找不到组件类型 ${value.typeId as string}`);
    else if (definition.storage !== "persistent") {
      issue(issues, "state-boundary", `${path}.typeId`, `${definition.storage} 组件 ${definition.id} 不能写入持久组件集合`);
    }
  }
}

function entityRecord(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  runId?: string,
  definitions?: RuntimeDomainDefinitions,
) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是实体记录`);
    return;
  }
  onlyKeys(value, ["id", "typeId", "domainPackageId", "scope", "components", "revision", "createdAt", "updatedAt"], path, issues);
  stringValue(value.id, `${path}.id`, issues);
  const hasTypeId = stringValue(value.typeId, `${path}.typeId`, issues, { typeId: true });
  stringValue(value.domainPackageId, `${path}.domainPackageId`, issues);
  scopeValue(value.scope, `${path}.scope`, issues, runId);
  revisionValue(value.revision, `${path}.revision`, issues);
  timestampValue(value.createdAt, `${path}.createdAt`, issues);
  timestampValue(value.updatedAt, `${path}.updatedAt`, issues);
  const componentTypes = definitions ? recordsById(definitions.componentTypes) : undefined;
  const components = uniqueRecordIds(value.components, `${path}.components`, issues, (item, itemPath, itemIssues) => {
    persistentComponent(item, itemPath, itemIssues, componentTypes);
  });
  if (hasTypeId && definitions) {
    const entityType = definitions.entityTypes.find(({ id }) => id === value.typeId);
    if (!entityType) issue(issues, "unknown-reference", `${path}.typeId`, `找不到实体类型 ${value.typeId as string}`);
    else {
      if (entityType.domainPackageId !== value.domainPackageId) {
        issue(issues, "invalid-value", `${path}.domainPackageId`, `实体包 ID 与类型 ${entityType.id} 的声明不一致`);
      }
      components.forEach((component, index) => {
        if (typeof component.typeId === "string" && !entityType.componentTypeIds.includes(component.typeId)) {
          issue(issues, "unknown-reference", `${path}.components[${index}].typeId`, `实体类型 ${entityType.id} 未声明组件 ${component.typeId}`);
        }
      });
    }
  }
}

function relationRecord(value: unknown, path: string, issues: RuntimeDomainValidationIssue[], runId?: string) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是关系记录`);
    return;
  }
  onlyKeys(value, ["id", "typeId", "sourceEntityId", "targetEntityId", "scope", "attributes", "revision", "createdAt", "updatedAt"], path, issues);
  stringValue(value.id, `${path}.id`, issues);
  stringValue(value.typeId, `${path}.typeId`, issues, { typeId: true });
  stringValue(value.sourceEntityId, `${path}.sourceEntityId`, issues);
  stringValue(value.targetEntityId, `${path}.targetEntityId`, issues);
  scopeValue(value.scope, `${path}.scope`, issues, runId);
  if (!isRecord(value.attributes)) issue(issues, "invalid-structure", `${path}.attributes`, `${path}.attributes 必须是对象`);
  else jsonValue(value.attributes, `${path}.attributes`, issues);
  revisionValue(value.revision, `${path}.revision`, issues);
  timestampValue(value.createdAt, `${path}.createdAt`, issues);
  timestampValue(value.updatedAt, `${path}.updatedAt`, issues);
}

function resourceAccount(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  runId?: string,
  resourceTypes?: ReadonlyMap<string, RuntimeResourceTypeDefinition>,
) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是资源账户`);
    return;
  }
  onlyKeys(value, ["id", "resourceTypeId", "holderEntityId", "scope", "balance", "reserved", "revision", "updatedAt"], path, issues);
  stringValue(value.id, `${path}.id`, issues);
  const hasTypeId = stringValue(value.resourceTypeId, `${path}.resourceTypeId`, issues, { typeId: true });
  if (value.holderEntityId !== null) stringValue(value.holderEntityId, `${path}.holderEntityId`, issues);
  scopeValue(value.scope, `${path}.scope`, issues, runId);
  const balanceValid = finiteNumber(value.balance, `${path}.balance`, issues);
  const reservedValid = finiteNumber(value.reserved, `${path}.reserved`, issues);
  if (reservedValid && (value.reserved as number) < 0) issue(issues, "invalid-value", `${path}.reserved`, `${path}.reserved 不能为负数`);
  revisionValue(value.revision, `${path}.revision`, issues);
  timestampValue(value.updatedAt, `${path}.updatedAt`, issues);
  if (hasTypeId && resourceTypes) {
    const definition = resourceTypes.get(value.resourceTypeId as string);
    if (!definition) issue(issues, "unknown-reference", `${path}.resourceTypeId`, `找不到资源类型 ${value.resourceTypeId as string}`);
    else if (balanceValid && !definition.allowNegative && (value.balance as number) < 0) {
      issue(issues, "invalid-value", `${path}.balance`, `资源 ${definition.id} 不允许负余额`);
    } else if (balanceValid && reservedValid && !definition.allowNegative && (value.reserved as number) > (value.balance as number)) {
      issue(issues, "invalid-value", `${path}.reserved`, `资源 ${definition.id} 的预留量不能超过余额`);
    }
  }
}

function metricRecord(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  runId?: string,
  metricTypes?: ReadonlyMap<string, RuntimeMetricDefinition>,
) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是指标记录`);
    return;
  }
  onlyKeys(value, ["id", "metricTypeId", "scope", "value", "revision", "updatedAt"], path, issues);
  stringValue(value.id, `${path}.id`, issues);
  const hasTypeId = stringValue(value.metricTypeId, `${path}.metricTypeId`, issues, { typeId: true });
  scopeValue(value.scope, `${path}.scope`, issues, runId);
  finiteNumber(value.value, `${path}.value`, issues);
  revisionValue(value.revision, `${path}.revision`, issues);
  timestampValue(value.updatedAt, `${path}.updatedAt`, issues);
  if (hasTypeId && metricTypes) {
    const definition = metricTypes.get(value.metricTypeId as string);
    if (!definition) issue(issues, "unknown-reference", `${path}.metricTypeId`, `找不到指标类型 ${value.metricTypeId as string}`);
    else if (definition.mode === "derived") {
      issue(issues, "state-boundary", `${path}.metricTypeId`, `派生指标 ${definition.id} 不能写入持久指标集合`);
    }
  }
}

function goalRecord(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  runId?: string,
  goalTypes?: ReadonlyMap<string, RuntimeGoalDefinition>,
) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是目标状态`);
    return;
  }
  onlyKeys(value, ["id", "goalTypeId", "scope", "status", "progress", "dueAt", "revision", "createdAt", "updatedAt"], path, issues);
  stringValue(value.id, `${path}.id`, issues);
  const hasTypeId = stringValue(value.goalTypeId, `${path}.goalTypeId`, issues, { typeId: true });
  scopeValue(value.scope, `${path}.scope`, issues, runId);
  enumValue(value.status, RUNTIME_GOAL_STATUSES, `${path}.status`, issues);
  if (finiteNumber(value.progress, `${path}.progress`, issues) && ((value.progress as number) < 0 || (value.progress as number) > 1)) {
    issue(issues, "invalid-value", `${path}.progress`, `${path}.progress 必须位于 0 到 1`);
  }
  if (value.dueAt !== null) timestampValue(value.dueAt, `${path}.dueAt`, issues);
  revisionValue(value.revision, `${path}.revision`, issues);
  timestampValue(value.createdAt, `${path}.createdAt`, issues);
  timestampValue(value.updatedAt, `${path}.updatedAt`, issues);
  if (hasTypeId && goalTypes) {
    const definition = goalTypes.get(value.goalTypeId as string);
    if (!definition) issue(issues, "unknown-reference", `${path}.goalTypeId`, `找不到目标类型 ${value.goalTypeId as string}`);
    else if (isRecord(value.scope) && !definition.allowedScopeKinds.includes(value.scope.kind as never)) {
      issue(issues, "scope-mismatch", `${path}.scope.kind`, `目标 ${definition.id} 不允许 ${String(value.scope.kind)} 作用域`);
    }
  }
}

export function validateRuntimeDomainSnapshot(
  value: unknown,
  definitions?: RuntimeDomainDefinitions,
): readonly RuntimeDomainValidationIssue[] {
  const issues: RuntimeDomainValidationIssue[] = [];
  if (!isRecord(value)) return Object.freeze([{ code: "invalid-structure", path: "snapshot", message: "snapshot 必须是对象" }]);
  onlyKeys(value, ["schemaVersion", "runId", "revision", "capturedAt", "entities", "relations", "resourceAccounts", "metricValues", "goals"], "snapshot", issues);
  if (value.schemaVersion !== RUNTIME_DOMAIN_SCHEMA_VERSION) {
    issue(issues, "invalid-value", "snapshot.schemaVersion", `snapshot.schemaVersion 必须是 ${RUNTIME_DOMAIN_SCHEMA_VERSION}`);
  }
  const hasRunId = stringValue(value.runId, "snapshot.runId", issues);
  const runId = hasRunId ? value.runId as string : undefined;
  revisionValue(value.revision, "snapshot.revision", issues);
  timestampValue(value.capturedAt, "snapshot.capturedAt", issues);
  const entities = uniqueRecordIds(value.entities, "snapshot.entities", issues, (item, path, itemIssues) => {
    entityRecord(item, path, itemIssues, runId, definitions);
  });
  const entityById = new Map(entities.filter(({ id }) => typeof id === "string").map((entity) => [entity.id as string, entity]));
  const relationTypes = definitions ? recordsById(definitions.relationTypes) : undefined;
  const relations = uniqueRecordIds(value.relations, "snapshot.relations", issues, (item, path, itemIssues) => {
    relationRecord(item, path, itemIssues, runId);
  });
  relations.forEach((relation, index) => {
    const source = entityById.get(relation.sourceEntityId as string);
    const target = entityById.get(relation.targetEntityId as string);
    if (!source) issue(issues, "unknown-reference", `snapshot.relations[${index}].sourceEntityId`, `找不到来源实体 ${String(relation.sourceEntityId)}`);
    if (!target) issue(issues, "unknown-reference", `snapshot.relations[${index}].targetEntityId`, `找不到目标实体 ${String(relation.targetEntityId)}`);
    if (!relationTypes || typeof relation.typeId !== "string") return;
    const definition = relationTypes.get(relation.typeId);
    if (!definition) {
      issue(issues, "unknown-reference", `snapshot.relations[${index}].typeId`, `找不到关系类型 ${relation.typeId}`);
      return;
    }
    if (source && !definition.sourceEntityTypeIds.includes(source.typeId as string)) {
      issue(issues, "relation-constraint", `snapshot.relations[${index}].sourceEntityId`, `关系 ${definition.id} 不允许来源实体类型 ${String(source.typeId)}`);
    }
    if (target && !definition.targetEntityTypeIds.includes(target.typeId as string)) {
      issue(issues, "relation-constraint", `snapshot.relations[${index}].targetEntityId`, `关系 ${definition.id} 不允许目标实体类型 ${String(target.typeId)}`);
    }
  });
  if (relationTypes) {
    relationTypes.forEach((definition) => {
      const matching = relations.filter(({ typeId }) => typeId === definition.id);
      const pairs = new Set<string>();
      const sources = new Set<string>();
      const targets = new Set<string>();
      matching.forEach((relation, index) => {
        const pair = `${String(relation.sourceEntityId)}\u0000${String(relation.targetEntityId)}`;
        if (definition.uniquePair && pairs.has(pair)) {
          issue(issues, "relation-constraint", `snapshot.relations[${index}]`, `关系 ${definition.id} 不允许重复实体对`);
        }
        pairs.add(pair);
        if (definition.sourceCardinality === "one" && sources.has(String(relation.sourceEntityId))) {
          issue(issues, "relation-constraint", `snapshot.relations[${index}].sourceEntityId`, `关系 ${definition.id} 的来源基数为 one`);
        }
        if (definition.targetCardinality === "one" && targets.has(String(relation.targetEntityId))) {
          issue(issues, "relation-constraint", `snapshot.relations[${index}].targetEntityId`, `关系 ${definition.id} 的目标基数为 one`);
        }
        sources.add(String(relation.sourceEntityId));
        targets.add(String(relation.targetEntityId));
      });
    });
  }
  const resourceTypes = definitions ? recordsById(definitions.resourceTypes) : undefined;
  const accounts = uniqueRecordIds(value.resourceAccounts, "snapshot.resourceAccounts", issues, (item, path, itemIssues) => {
    resourceAccount(item, path, itemIssues, runId, resourceTypes);
  });
  accounts.forEach((account, index) => {
    if (account.holderEntityId === null || typeof account.holderEntityId !== "string") return;
    const holder = entityById.get(account.holderEntityId);
    if (!holder) {
      issue(issues, "unknown-reference", `snapshot.resourceAccounts[${index}].holderEntityId`, `找不到资源持有者实体 ${account.holderEntityId}`);
      return;
    }
    if (!resourceTypes || typeof account.resourceTypeId !== "string") return;
    const definition = resourceTypes.get(account.resourceTypeId);
    if (definition && !definition.holderEntityTypeIds.includes(holder.typeId as string)) {
      issue(issues, "scope-mismatch", `snapshot.resourceAccounts[${index}].holderEntityId`, `资源 ${definition.id} 不允许实体类型 ${String(holder.typeId)} 持有`);
    }
  });
  const metricTypes = definitions ? recordsById(definitions.metricTypes) : undefined;
  uniqueRecordIds(value.metricValues, "snapshot.metricValues", issues, (item, path, itemIssues) => {
    metricRecord(item, path, itemIssues, runId, metricTypes);
  });
  const goalTypes = definitions ? recordsById(definitions.goalTypes) : undefined;
  uniqueRecordIds(value.goals, "snapshot.goals", issues, (item, path, itemIssues) => {
    goalRecord(item, path, itemIssues, runId, goalTypes);
  });
  return Object.freeze(issues);
}

function ephemeralState(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  runId?: string,
  componentTypes?: ReadonlyMap<string, RuntimeComponentDefinition>,
) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是短期组件状态`);
    return;
  }
  onlyKeys(value, ["entityId", "typeId", "scope", "value", "sourceRevision", "observedAt", "expiresAt"], path, issues);
  stringValue(value.entityId, `${path}.entityId`, issues);
  const hasTypeId = stringValue(value.typeId, `${path}.typeId`, issues, { typeId: true });
  scopeValue(value.scope, `${path}.scope`, issues, runId);
  jsonValue(value.value, `${path}.value`, issues);
  revisionValue(value.sourceRevision, `${path}.sourceRevision`, issues);
  timestampValue(value.observedAt, `${path}.observedAt`, issues);
  if (value.expiresAt !== null) timestampValue(value.expiresAt, `${path}.expiresAt`, issues);
  if (hasTypeId && componentTypes) {
    const definition = componentTypes.get(value.typeId as string);
    if (!definition) issue(issues, "unknown-reference", `${path}.typeId`, `找不到组件类型 ${value.typeId as string}`);
    else if (definition.storage !== "ephemeral") {
      issue(issues, "state-boundary", `${path}.typeId`, `组件 ${definition.id} 不是短期状态`);
    }
  }
}

function derivedState(
  value: unknown,
  path: string,
  issues: RuntimeDomainValidationIssue[],
  runId?: string,
  componentTypes?: ReadonlyMap<string, RuntimeComponentDefinition>,
) {
  if (!isRecord(value)) {
    issue(issues, "invalid-structure", path, `${path} 必须是派生组件状态`);
    return;
  }
  onlyKeys(value, ["entityId", "typeId", "scope", "value", "sourceRevision", "computedAt"], path, issues);
  stringValue(value.entityId, `${path}.entityId`, issues);
  const hasTypeId = stringValue(value.typeId, `${path}.typeId`, issues, { typeId: true });
  scopeValue(value.scope, `${path}.scope`, issues, runId);
  jsonValue(value.value, `${path}.value`, issues);
  revisionValue(value.sourceRevision, `${path}.sourceRevision`, issues);
  timestampValue(value.computedAt, `${path}.computedAt`, issues);
  if (hasTypeId && componentTypes) {
    const definition = componentTypes.get(value.typeId as string);
    if (!definition) issue(issues, "unknown-reference", `${path}.typeId`, `找不到组件类型 ${value.typeId as string}`);
    else if (definition.storage !== "derived") {
      issue(issues, "state-boundary", `${path}.typeId`, `组件 ${definition.id} 不是派生状态`);
    }
  }
}

export function validateRuntimeDomainProjection(
  value: unknown,
  definitions?: RuntimeDomainDefinitions,
): readonly RuntimeDomainValidationIssue[] {
  const issues: RuntimeDomainValidationIssue[] = [];
  if (!isRecord(value)) return Object.freeze([{ code: "invalid-structure", path: "projection", message: "projection 必须是对象" }]);
  onlyKeys(value, ["runId", "baseRevision", "ephemeralComponents", "derivedComponents", "derivedMetrics"], "projection", issues);
  const hasRunId = stringValue(value.runId, "projection.runId", issues);
  const runId = hasRunId ? value.runId as string : undefined;
  revisionValue(value.baseRevision, "projection.baseRevision", issues);
  const componentTypes = definitions ? recordsById(definitions.componentTypes) : undefined;
  if (!Array.isArray(value.ephemeralComponents)) issue(issues, "invalid-structure", "projection.ephemeralComponents", "projection.ephemeralComponents 必须是数组");
  else value.ephemeralComponents.forEach((state, index) => ephemeralState(state, `projection.ephemeralComponents[${index}]`, issues, runId, componentTypes));
  if (!Array.isArray(value.derivedComponents)) issue(issues, "invalid-structure", "projection.derivedComponents", "projection.derivedComponents 必须是数组");
  else value.derivedComponents.forEach((state, index) => derivedState(state, `projection.derivedComponents[${index}]`, issues, runId, componentTypes));
  const metricTypes = definitions ? recordsById(definitions.metricTypes) : undefined;
  if (!Array.isArray(value.derivedMetrics)) issue(issues, "invalid-structure", "projection.derivedMetrics", "projection.derivedMetrics 必须是数组");
  else value.derivedMetrics.forEach((metric, index) => {
    const path = `projection.derivedMetrics[${index}]`;
    if (!isRecord(metric)) {
      issue(issues, "invalid-structure", path, `${path} 必须是派生指标`);
      return;
    }
    onlyKeys(metric, ["metricTypeId", "scope", "value", "sourceRevision", "computedAt"], path, issues);
    const hasTypeId = stringValue(metric.metricTypeId, `${path}.metricTypeId`, issues, { typeId: true });
    scopeValue(metric.scope, `${path}.scope`, issues, runId);
    finiteNumber(metric.value, `${path}.value`, issues);
    revisionValue(metric.sourceRevision, `${path}.sourceRevision`, issues);
    timestampValue(metric.computedAt, `${path}.computedAt`, issues);
    if (hasTypeId && metricTypes) {
      const definition = metricTypes.get(metric.metricTypeId as string);
      if (!definition) issue(issues, "unknown-reference", `${path}.metricTypeId`, `找不到指标类型 ${metric.metricTypeId as string}`);
      else if (definition.mode !== "derived") issue(issues, "state-boundary", `${path}.metricTypeId`, `指标 ${definition.id} 不是派生指标`);
    }
  });
  return Object.freeze(issues);
}

const MUTATION_PAYLOAD_KEYS: Readonly<Record<string, readonly string[]>> = {
  "entity.put": ["entity"],
  "entity.delete": ["entityId"],
  "component.set": ["entityId", "component"],
  "component.remove": ["entityId", "componentTypeId"],
  "state.ephemeral.set": ["state"],
  "state.ephemeral.remove": ["entityId", "componentTypeId"],
  "relation.put": ["relation"],
  "relation.delete": ["relationId"],
  "resource.account.put": ["account"],
  "metric.value.put": ["metric"],
  "goal.put": ["goal"],
  "goal.delete": ["goalId"],
};

export function validateRuntimeDomainMutation(
  value: unknown,
  options: { readonly currentRevision?: number; readonly definitions?: RuntimeDomainDefinitions } = {},
): readonly RuntimeDomainValidationIssue[] {
  const issues: RuntimeDomainValidationIssue[] = [];
  if (!isRecord(value)) return Object.freeze([{ code: "invalid-structure", path: "mutation", message: "mutation 必须是对象" }]);
  const operation = typeof value.operation === "string" ? value.operation : "";
  const payloadKeys = MUTATION_PAYLOAD_KEYS[operation];
  onlyKeys(value, ["id", "runId", "scope", "expectedRevision", "issuedAt", "operation", ...(payloadKeys ?? [])], "mutation", issues);
  stringValue(value.id, "mutation.id", issues);
  const hasRunId = stringValue(value.runId, "mutation.runId", issues);
  const runId = hasRunId ? value.runId as string : undefined;
  scopeValue(value.scope, "mutation.scope", issues, runId);
  const hasRevision = revisionValue(value.expectedRevision, "mutation.expectedRevision", issues);
  timestampValue(value.issuedAt, "mutation.issuedAt", issues);
  if (!payloadKeys) {
    issue(issues, "invalid-value", "mutation.operation", `mutation.operation 不受支持：${String(value.operation)}`);
    return Object.freeze(issues);
  }
  if (hasRevision && options.currentRevision !== undefined && value.expectedRevision !== options.currentRevision) {
    issue(issues, "revision-conflict", "mutation.expectedRevision", `预期修订 ${String(value.expectedRevision)} 与当前修订 ${options.currentRevision} 不一致`);
  }
  const componentTypes = options.definitions ? recordsById(options.definitions.componentTypes) : undefined;
  const resourceTypes = options.definitions ? recordsById(options.definitions.resourceTypes) : undefined;
  const metricTypes = options.definitions ? recordsById(options.definitions.metricTypes) : undefined;
  const goalTypes = options.definitions ? recordsById(options.definitions.goalTypes) : undefined;
  switch (operation) {
    case "entity.put":
      entityRecord(value.entity, "mutation.entity", issues, runId, options.definitions);
      break;
    case "entity.delete":
      stringValue(value.entityId, "mutation.entityId", issues);
      break;
    case "component.set":
      stringValue(value.entityId, "mutation.entityId", issues);
      persistentComponent(value.component, "mutation.component", issues, componentTypes);
      break;
    case "component.remove":
    case "state.ephemeral.remove":
      stringValue(value.entityId, "mutation.entityId", issues);
      stringValue(value.componentTypeId, "mutation.componentTypeId", issues, { typeId: true });
      if (typeof value.componentTypeId === "string" && componentTypes) {
        const definition = componentTypes.get(value.componentTypeId);
        if (!definition) issue(issues, "unknown-reference", "mutation.componentTypeId", `找不到组件类型 ${value.componentTypeId}`);
        else if (operation === "state.ephemeral.remove" && definition.storage !== "ephemeral") {
          issue(issues, "state-boundary", "mutation.componentTypeId", `组件 ${definition.id} 不是短期状态`);
        } else if (operation === "component.remove" && definition.storage !== "persistent") {
          issue(issues, "state-boundary", "mutation.componentTypeId", `组件 ${definition.id} 不是持久状态`);
        }
      }
      break;
    case "state.ephemeral.set":
      ephemeralState(value.state, "mutation.state", issues, runId, componentTypes);
      break;
    case "relation.put": {
      const relation = value.relation;
      relationRecord(relation, "mutation.relation", issues, runId);
      if (isRecord(relation) && typeof relation.typeId === "string" && options.definitions
        && !options.definitions.relationTypes.some(({ id }) => id === relation.typeId)) {
        issue(issues, "unknown-reference", "mutation.relation.typeId", `找不到关系类型 ${relation.typeId}`);
      }
      break;
    }
    case "relation.delete":
      stringValue(value.relationId, "mutation.relationId", issues);
      break;
    case "resource.account.put":
      resourceAccount(value.account, "mutation.account", issues, runId, resourceTypes);
      break;
    case "metric.value.put":
      metricRecord(value.metric, "mutation.metric", issues, runId, metricTypes);
      break;
    case "goal.put":
      goalRecord(value.goal, "mutation.goal", issues, runId, goalTypes);
      break;
    case "goal.delete":
      stringValue(value.goalId, "mutation.goalId", issues);
      break;
  }
  return Object.freeze(issues);
}

export function assertRuntimeDomainDefinitions(value: unknown): asserts value is RuntimeDomainDefinitions {
  const issues = validateRuntimeDomainDefinitions(value);
  if (issues.length > 0) throw new RuntimeDomainValidationError(issues);
}

export function assertRuntimeDomainSnapshot(
  value: unknown,
  definitions?: RuntimeDomainDefinitions,
): asserts value is RuntimeDomainSnapshot {
  const issues = validateRuntimeDomainSnapshot(value, definitions);
  if (issues.length > 0) throw new RuntimeDomainValidationError(issues);
}

export function assertRuntimeDomainProjection(
  value: unknown,
  definitions?: RuntimeDomainDefinitions,
): asserts value is RuntimeDomainProjection {
  const issues = validateRuntimeDomainProjection(value, definitions);
  if (issues.length > 0) throw new RuntimeDomainValidationError(issues);
}

export function assertRuntimeDomainMutation(
  value: unknown,
  options: { readonly currentRevision?: number; readonly definitions?: RuntimeDomainDefinitions } = {},
): asserts value is RuntimeDomainMutation {
  const issues = validateRuntimeDomainMutation(value, options);
  if (issues.length > 0) throw new RuntimeDomainValidationError(issues);
}
