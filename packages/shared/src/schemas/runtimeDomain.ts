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
} from "../runtime/domain.js";

const stableId = { type: "string", minLength: 1, maxLength: 200 } as const;
const typeId = {
  type: "string",
  pattern: "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\\.[a-z][a-z0-9-]*)+$",
} as const;
const revision = { type: "integer", minimum: 0 } as const;
const timestamp = { type: "string", format: "date-time" } as const;
const jsonValue = {
  $comment: "Any JSON-serializable value; runtime validation also rejects non-finite numbers.",
} as const;
const jsonObject = { type: "object" } as const;
const uniqueTypeIds = { type: "array", uniqueItems: true, items: typeId } as const;
const nonEmptyUniqueTypeIds = { ...uniqueTypeIds, minItems: 1 } as const;

export const runtimeScopeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["runId", "kind", "id"],
  properties: {
    runId: stableId,
    kind: { enum: RUNTIME_SCOPE_KINDS },
    id: stableId,
  },
} as const;

export const runtimeExpressionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["language", "source"],
  properties: {
    language: { const: "solidloom-expression-v1" },
    source: { type: "string", minLength: 1, maxLength: 4_000 },
  },
} as const;

const definitionBaseProperties = {
  id: typeId,
  domainPackageId: stableId,
  displayName: { type: "string", minLength: 1, maxLength: 120 },
  description: { type: "string", minLength: 1, maxLength: 500 },
  revision,
  status: { enum: RUNTIME_DEFINITION_STATUSES },
} as const;

const definitionBaseRequired = [
  "kind",
  "id",
  "domainPackageId",
  "displayName",
  "description",
  "revision",
  "status",
] as const;

export const runtimeEntityTypeDefinitionSchema = {
  type: "object",
  additionalProperties: false,
  required: [...definitionBaseRequired, "componentTypeIds"],
  properties: {
    ...definitionBaseProperties,
    kind: { const: "entity" },
    componentTypeIds: uniqueTypeIds,
  },
} as const;

export const runtimeComponentDefinitionSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [...definitionBaseRequired, "storage", "schema"],
      properties: {
        ...definitionBaseProperties,
        kind: { const: "component" },
        storage: { const: "persistent" },
        schema: jsonObject,
        defaultValue: jsonValue,
        migrationId: stableId,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...definitionBaseRequired, "storage", "schema"],
      properties: {
        ...definitionBaseProperties,
        kind: { const: "component" },
        storage: { const: "ephemeral" },
        schema: jsonObject,
        defaultValue: jsonValue,
        ttlMs: { type: "number", exclusiveMinimum: 0 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...definitionBaseRequired, "storage", "schema", "dependencies", "expression"],
      properties: {
        ...definitionBaseProperties,
        kind: { const: "component" },
        storage: { const: "derived" },
        schema: jsonObject,
        dependencies: nonEmptyUniqueTypeIds,
        expression: runtimeExpressionSchema,
      },
    },
  ],
} as const;

export const runtimeRelationTypeDefinitionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...definitionBaseRequired,
    "direction",
    "sourceCardinality",
    "targetCardinality",
    "sourceEntityTypeIds",
    "targetEntityTypeIds",
    "attributesSchema",
    "symmetric",
    "transitive",
    "uniquePair",
  ],
  properties: {
    ...definitionBaseProperties,
    kind: { const: "relation" },
    direction: { enum: RUNTIME_RELATION_DIRECTIONS },
    sourceCardinality: { enum: RUNTIME_RELATION_CARDINALITIES },
    targetCardinality: { enum: RUNTIME_RELATION_CARDINALITIES },
    sourceEntityTypeIds: nonEmptyUniqueTypeIds,
    targetEntityTypeIds: nonEmptyUniqueTypeIds,
    attributesSchema: jsonObject,
    symmetric: { type: "boolean" },
    transitive: { type: "boolean" },
    uniquePair: { type: "boolean" },
  },
} as const;

export const runtimeResourceTypeDefinitionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    ...definitionBaseRequired,
    "unit",
    "precision",
    "divisible",
    "allowNegative",
    "conservation",
    "holderEntityTypeIds",
  ],
  properties: {
    ...definitionBaseProperties,
    kind: { const: "resource" },
    unit: { type: "string", minLength: 1, maxLength: 80 },
    precision: { type: "integer", minimum: 0, maximum: 12 },
    divisible: { type: "boolean" },
    allowNegative: { type: "boolean" },
    conservation: { enum: RUNTIME_RESOURCE_CONSERVATION_MODES },
    holderEntityTypeIds: uniqueTypeIds,
  },
} as const;

export const runtimeMetricDefinitionSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [...definitionBaseRequired, "mode"],
      properties: {
        ...definitionBaseProperties,
        kind: { const: "metric" },
        mode: { enum: ["counter", "gauge"] },
        unit: { type: "string", minLength: 1, maxLength: 80 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: [...definitionBaseRequired, "mode", "dependencies", "expression"],
      properties: {
        ...definitionBaseProperties,
        kind: { const: "metric" },
        mode: { const: "derived" },
        unit: { type: "string", minLength: 1, maxLength: 80 },
        dependencies: nonEmptyUniqueTypeIds,
        expression: runtimeExpressionSchema,
      },
    },
  ],
} as const;

export const runtimeGoalDefinitionSchema = {
  type: "object",
  additionalProperties: false,
  required: [...definitionBaseRequired, "allowedScopeKinds", "completion"],
  properties: {
    ...definitionBaseProperties,
    kind: { const: "goal" },
    allowedScopeKinds: {
      type: "array",
      uniqueItems: true,
      minItems: 1,
      items: { enum: RUNTIME_SCOPE_KINDS },
    },
    completion: runtimeExpressionSchema,
    progress: runtimeExpressionSchema,
    failure: runtimeExpressionSchema,
  },
} as const;

export const runtimeDomainDefinitionsSchema = {
  $id: "https://solidloom.local/schemas/runtime-domain-definitions-v1.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SolidLoom 通用运行时领域定义",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "revision",
    "entityTypes",
    "componentTypes",
    "relationTypes",
    "resourceTypes",
    "metricTypes",
    "goalTypes",
  ],
  properties: {
    schemaVersion: { const: RUNTIME_DOMAIN_SCHEMA_VERSION },
    revision,
    entityTypes: { type: "array", items: runtimeEntityTypeDefinitionSchema },
    componentTypes: { type: "array", items: runtimeComponentDefinitionSchema },
    relationTypes: { type: "array", items: runtimeRelationTypeDefinitionSchema },
    resourceTypes: { type: "array", items: runtimeResourceTypeDefinitionSchema },
    metricTypes: { type: "array", items: runtimeMetricDefinitionSchema },
    goalTypes: { type: "array", items: runtimeGoalDefinitionSchema },
  },
} as const;

export const runtimePersistentComponentInstanceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["typeId", "value", "revision", "updatedAt"],
  properties: { typeId, value: jsonValue, revision, updatedAt: timestamp },
} as const;

export const runtimeDomainEntitySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "typeId", "domainPackageId", "scope", "components", "revision", "createdAt", "updatedAt"],
  properties: {
    id: stableId,
    typeId,
    domainPackageId: stableId,
    scope: runtimeScopeSchema,
    components: { type: "array", items: runtimePersistentComponentInstanceSchema },
    revision,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
} as const;

export const runtimeEntityRelationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "typeId", "sourceEntityId", "targetEntityId", "scope", "attributes", "revision", "createdAt", "updatedAt"],
  properties: {
    id: stableId,
    typeId,
    sourceEntityId: stableId,
    targetEntityId: stableId,
    scope: runtimeScopeSchema,
    attributes: jsonObject,
    revision,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
} as const;

export const runtimeResourceAccountSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "resourceTypeId", "holderEntityId", "scope", "balance", "reserved", "revision", "updatedAt"],
  properties: {
    id: stableId,
    resourceTypeId: typeId,
    holderEntityId: { anyOf: [stableId, { type: "null" }] },
    scope: runtimeScopeSchema,
    balance: { type: "number" },
    reserved: { type: "number", minimum: 0 },
    revision,
    updatedAt: timestamp,
  },
} as const;

export const runtimeMetricValueSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "metricTypeId", "scope", "value", "revision", "updatedAt"],
  properties: {
    id: stableId,
    metricTypeId: typeId,
    scope: runtimeScopeSchema,
    value: { type: "number" },
    revision,
    updatedAt: timestamp,
  },
} as const;

export const runtimeGoalStateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "goalTypeId", "scope", "status", "progress", "dueAt", "revision", "createdAt", "updatedAt"],
  properties: {
    id: stableId,
    goalTypeId: typeId,
    scope: runtimeScopeSchema,
    status: { enum: RUNTIME_GOAL_STATUSES },
    progress: { type: "number", minimum: 0, maximum: 1 },
    dueAt: { anyOf: [timestamp, { type: "null" }] },
    revision,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
} as const;

export const runtimeDomainSnapshotSchema = {
  $id: "https://solidloom.local/schemas/runtime-domain-snapshot-v1.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SolidLoom 通用运行时持久快照",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "runId", "revision", "capturedAt", "entities", "relations", "resourceAccounts", "metricValues", "goals"],
  properties: {
    schemaVersion: { const: RUNTIME_DOMAIN_SCHEMA_VERSION },
    runId: stableId,
    revision,
    capturedAt: timestamp,
    entities: { type: "array", items: runtimeDomainEntitySchema },
    relations: { type: "array", items: runtimeEntityRelationSchema },
    resourceAccounts: { type: "array", items: runtimeResourceAccountSchema },
    metricValues: { type: "array", items: runtimeMetricValueSchema },
    goals: { type: "array", items: runtimeGoalStateSchema },
  },
} as const;

export const runtimeEphemeralComponentStateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["entityId", "typeId", "scope", "value", "sourceRevision", "observedAt", "expiresAt"],
  properties: {
    entityId: stableId,
    typeId,
    scope: runtimeScopeSchema,
    value: jsonValue,
    sourceRevision: revision,
    observedAt: timestamp,
    expiresAt: { anyOf: [timestamp, { type: "null" }] },
  },
} as const;

export const runtimeDerivedComponentStateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["entityId", "typeId", "scope", "value", "sourceRevision", "computedAt"],
  properties: {
    entityId: stableId,
    typeId,
    scope: runtimeScopeSchema,
    value: jsonValue,
    sourceRevision: revision,
    computedAt: timestamp,
  },
} as const;

export const runtimeDerivedMetricValueSchema = {
  type: "object",
  additionalProperties: false,
  required: ["metricTypeId", "scope", "value", "sourceRevision", "computedAt"],
  properties: {
    metricTypeId: typeId,
    scope: runtimeScopeSchema,
    value: { type: "number" },
    sourceRevision: revision,
    computedAt: timestamp,
  },
} as const;

export const runtimeDomainProjectionSchema = {
  $id: "https://solidloom.local/schemas/runtime-domain-projection-v1.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SolidLoom 通用运行时短期与派生投影",
  type: "object",
  additionalProperties: false,
  required: ["runId", "baseRevision", "ephemeralComponents", "derivedComponents", "derivedMetrics"],
  properties: {
    runId: stableId,
    baseRevision: revision,
    ephemeralComponents: { type: "array", items: runtimeEphemeralComponentStateSchema },
    derivedComponents: { type: "array", items: runtimeDerivedComponentStateSchema },
    derivedMetrics: { type: "array", items: runtimeDerivedMetricValueSchema },
  },
} as const;

const mutationBaseProperties = {
  id: stableId,
  runId: stableId,
  scope: runtimeScopeSchema,
  expectedRevision: revision,
  issuedAt: timestamp,
} as const;

const mutationBaseRequired = ["id", "runId", "scope", "expectedRevision", "issuedAt", "operation"] as const;

function mutationVariant(
  operation: string,
  payloadRequired: readonly string[],
  payloadProperties: Record<string, unknown>,
) {
  return {
    type: "object",
    additionalProperties: false,
    required: [...mutationBaseRequired, ...payloadRequired],
    properties: {
      ...mutationBaseProperties,
      operation: { const: operation },
      ...payloadProperties,
    },
  } as const;
}

export const runtimeDomainMutationSchema = {
  $id: "https://solidloom.local/schemas/runtime-domain-mutation-v1.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SolidLoom 通用运行时修订写入",
  oneOf: [
    mutationVariant("entity.put", ["entity"], { entity: runtimeDomainEntitySchema }),
    mutationVariant("entity.delete", ["entityId"], { entityId: stableId }),
    mutationVariant("component.set", ["entityId", "component"], {
      entityId: stableId,
      component: runtimePersistentComponentInstanceSchema,
    }),
    mutationVariant("component.remove", ["entityId", "componentTypeId"], {
      entityId: stableId,
      componentTypeId: typeId,
    }),
    mutationVariant("state.ephemeral.set", ["state"], { state: runtimeEphemeralComponentStateSchema }),
    mutationVariant("state.ephemeral.remove", ["entityId", "componentTypeId"], {
      entityId: stableId,
      componentTypeId: typeId,
    }),
    mutationVariant("relation.put", ["relation"], { relation: runtimeEntityRelationSchema }),
    mutationVariant("relation.delete", ["relationId"], { relationId: stableId }),
    mutationVariant("resource.account.put", ["account"], { account: runtimeResourceAccountSchema }),
    mutationVariant("metric.value.put", ["metric"], { metric: runtimeMetricValueSchema }),
    mutationVariant("goal.put", ["goal"], { goal: runtimeGoalStateSchema }),
    mutationVariant("goal.delete", ["goalId"], { goalId: stableId }),
  ],
  $comment: `Supported state storages: ${RUNTIME_STATE_STORAGES.join(", ")}; metric modes: ${RUNTIME_METRIC_MODES.join(", ")}. Derived values never have a write variant.`,
} as const;
