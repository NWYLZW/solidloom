export const RUNTIME_DOMAIN_SCHEMA_VERSION = 1 as const;

export const RUNTIME_DEFINITION_STATUSES = ["available", "planned"] as const;
export const RUNTIME_STATE_STORAGES = ["persistent", "ephemeral", "derived"] as const;
export const RUNTIME_SCOPE_KINDS = ["run", "entity", "relation", "custom"] as const;
export const RUNTIME_RELATION_DIRECTIONS = ["directed", "undirected"] as const;
export const RUNTIME_RELATION_CARDINALITIES = ["one", "many"] as const;
export const RUNTIME_RESOURCE_CONSERVATION_MODES = ["none", "closed"] as const;
export const RUNTIME_METRIC_MODES = ["counter", "gauge", "derived"] as const;
export const RUNTIME_GOAL_STATUSES = ["active", "completed", "failed", "cancelled"] as const;

export type RuntimeDefinitionStatus = (typeof RUNTIME_DEFINITION_STATUSES)[number];
export type RuntimeStateStorage = (typeof RUNTIME_STATE_STORAGES)[number];
export type RuntimeScopeKind = (typeof RUNTIME_SCOPE_KINDS)[number];
export type RuntimeRelationDirection = (typeof RUNTIME_RELATION_DIRECTIONS)[number];
export type RuntimeRelationCardinality = (typeof RUNTIME_RELATION_CARDINALITIES)[number];
export type RuntimeResourceConservationMode = (typeof RUNTIME_RESOURCE_CONSERVATION_MODES)[number];
export type RuntimeMetricMode = (typeof RUNTIME_METRIC_MODES)[number];
export type RuntimeGoalStatus = (typeof RUNTIME_GOAL_STATUSES)[number];

export type RuntimeJsonPrimitive = boolean | number | string | null;
export type RuntimeJsonValue = (
  RuntimeJsonPrimitive
  | readonly RuntimeJsonValue[]
  | { readonly [key: string]: RuntimeJsonValue }
);
export type RuntimeJsonObject = { readonly [key: string]: RuntimeJsonValue };
export type RuntimeJsonSchema = RuntimeJsonObject;

export interface RuntimeScope {
  readonly runId: string;
  readonly kind: RuntimeScopeKind;
  readonly id: string;
}

export interface RuntimeExpression {
  readonly language: "solidloom-expression-v1";
  readonly source: string;
}

interface RuntimeDefinitionBase {
  readonly id: string;
  readonly domainPackageId: string;
  readonly displayName: string;
  readonly description: string;
  readonly revision: number;
  readonly status: RuntimeDefinitionStatus;
}

export interface RuntimeEntityTypeDefinition extends RuntimeDefinitionBase {
  readonly kind: "entity";
  readonly componentTypeIds: readonly string[];
}

interface RuntimeComponentDefinitionBase extends RuntimeDefinitionBase {
  readonly kind: "component";
  readonly schema: RuntimeJsonSchema;
}

export interface RuntimePersistentComponentDefinition extends RuntimeComponentDefinitionBase {
  readonly storage: "persistent";
  readonly defaultValue?: RuntimeJsonValue;
  readonly migrationId?: string;
}

export interface RuntimeEphemeralComponentDefinition extends RuntimeComponentDefinitionBase {
  readonly storage: "ephemeral";
  readonly defaultValue?: RuntimeJsonValue;
  readonly ttlMs?: number;
}

export interface RuntimeDerivedComponentDefinition extends RuntimeComponentDefinitionBase {
  readonly storage: "derived";
  readonly dependencies: readonly string[];
  readonly expression: RuntimeExpression;
}

export type RuntimeComponentDefinition = (
  RuntimePersistentComponentDefinition
  | RuntimeEphemeralComponentDefinition
  | RuntimeDerivedComponentDefinition
);
export type RuntimeStateDefinition = RuntimeComponentDefinition;

export interface RuntimeRelationTypeDefinition extends RuntimeDefinitionBase {
  readonly kind: "relation";
  readonly direction: RuntimeRelationDirection;
  readonly sourceCardinality: RuntimeRelationCardinality;
  readonly targetCardinality: RuntimeRelationCardinality;
  readonly sourceEntityTypeIds: readonly string[];
  readonly targetEntityTypeIds: readonly string[];
  readonly attributesSchema: RuntimeJsonSchema;
  readonly symmetric: boolean;
  readonly transitive: boolean;
  readonly uniquePair: boolean;
}

export interface RuntimeResourceTypeDefinition extends RuntimeDefinitionBase {
  readonly kind: "resource";
  readonly unit: string;
  readonly precision: number;
  readonly divisible: boolean;
  readonly allowNegative: boolean;
  readonly conservation: RuntimeResourceConservationMode;
  readonly holderEntityTypeIds: readonly string[];
}

interface RuntimeMetricDefinitionBase extends RuntimeDefinitionBase {
  readonly kind: "metric";
  readonly unit?: string;
}

export interface RuntimeStoredMetricDefinition extends RuntimeMetricDefinitionBase {
  readonly mode: "counter" | "gauge";
}

export interface RuntimeDerivedMetricDefinition extends RuntimeMetricDefinitionBase {
  readonly mode: "derived";
  readonly dependencies: readonly string[];
  readonly expression: RuntimeExpression;
}

export type RuntimeMetricDefinition = RuntimeStoredMetricDefinition | RuntimeDerivedMetricDefinition;

export interface RuntimeGoalDefinition extends RuntimeDefinitionBase {
  readonly kind: "goal";
  readonly allowedScopeKinds: readonly RuntimeScopeKind[];
  readonly completion: RuntimeExpression;
  readonly progress?: RuntimeExpression;
  readonly failure?: RuntimeExpression;
}

export interface RuntimeDomainDefinitions {
  readonly schemaVersion: typeof RUNTIME_DOMAIN_SCHEMA_VERSION;
  readonly revision: number;
  readonly entityTypes: readonly RuntimeEntityTypeDefinition[];
  readonly componentTypes: readonly RuntimeComponentDefinition[];
  readonly relationTypes: readonly RuntimeRelationTypeDefinition[];
  readonly resourceTypes: readonly RuntimeResourceTypeDefinition[];
  readonly metricTypes: readonly RuntimeMetricDefinition[];
  readonly goalTypes: readonly RuntimeGoalDefinition[];
}

export interface RuntimePersistentComponentInstance {
  readonly typeId: string;
  readonly value: RuntimeJsonValue;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface RuntimeDomainEntity {
  readonly id: string;
  readonly typeId: string;
  readonly domainPackageId: string;
  readonly scope: RuntimeScope;
  readonly components: readonly RuntimePersistentComponentInstance[];
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RuntimeEntityRelation {
  readonly id: string;
  readonly typeId: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly scope: RuntimeScope;
  readonly attributes: RuntimeJsonObject;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RuntimeResourceAccount {
  readonly id: string;
  readonly resourceTypeId: string;
  readonly holderEntityId: string | null;
  readonly scope: RuntimeScope;
  readonly balance: number;
  readonly reserved: number;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface RuntimeMetricValue {
  readonly id: string;
  readonly metricTypeId: string;
  readonly scope: RuntimeScope;
  readonly value: number;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface RuntimeGoalState {
  readonly id: string;
  readonly goalTypeId: string;
  readonly scope: RuntimeScope;
  readonly status: RuntimeGoalStatus;
  readonly progress: number;
  readonly dueAt: string | null;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RuntimeDomainSnapshot {
  readonly schemaVersion: typeof RUNTIME_DOMAIN_SCHEMA_VERSION;
  readonly runId: string;
  readonly revision: number;
  readonly capturedAt: string;
  readonly entities: readonly RuntimeDomainEntity[];
  readonly relations: readonly RuntimeEntityRelation[];
  readonly resourceAccounts: readonly RuntimeResourceAccount[];
  readonly metricValues: readonly RuntimeMetricValue[];
  readonly goals: readonly RuntimeGoalState[];
}

export interface RuntimeEphemeralComponentState {
  readonly entityId: string;
  readonly typeId: string;
  readonly scope: RuntimeScope;
  readonly value: RuntimeJsonValue;
  readonly sourceRevision: number;
  readonly observedAt: string;
  readonly expiresAt: string | null;
}

export interface RuntimeDerivedComponentState {
  readonly entityId: string;
  readonly typeId: string;
  readonly scope: RuntimeScope;
  readonly value: RuntimeJsonValue;
  readonly sourceRevision: number;
  readonly computedAt: string;
}

export interface RuntimeDerivedMetricValue {
  readonly metricTypeId: string;
  readonly scope: RuntimeScope;
  readonly value: number;
  readonly sourceRevision: number;
  readonly computedAt: string;
}

export interface RuntimeDomainProjection {
  readonly runId: string;
  readonly baseRevision: number;
  readonly ephemeralComponents: readonly RuntimeEphemeralComponentState[];
  readonly derivedComponents: readonly RuntimeDerivedComponentState[];
  readonly derivedMetrics: readonly RuntimeDerivedMetricValue[];
}

export type RuntimeComponentState = (
  RuntimePersistentComponentInstance
  | RuntimeEphemeralComponentState
  | RuntimeDerivedComponentState
);

interface RuntimeDomainMutationBase {
  readonly id: string;
  readonly runId: string;
  readonly scope: RuntimeScope;
  readonly expectedRevision: number;
  readonly issuedAt: string;
}

export type RuntimeDomainMutation = (
  | RuntimeDomainMutationBase & { readonly operation: "entity.put"; readonly entity: RuntimeDomainEntity }
  | RuntimeDomainMutationBase & { readonly operation: "entity.delete"; readonly entityId: string }
  | RuntimeDomainMutationBase & {
    readonly operation: "component.set";
    readonly entityId: string;
    readonly component: RuntimePersistentComponentInstance;
  }
  | RuntimeDomainMutationBase & {
    readonly operation: "component.remove";
    readonly entityId: string;
    readonly componentTypeId: string;
  }
  | RuntimeDomainMutationBase & {
    readonly operation: "state.ephemeral.set";
    readonly state: RuntimeEphemeralComponentState;
  }
  | RuntimeDomainMutationBase & {
    readonly operation: "state.ephemeral.remove";
    readonly entityId: string;
    readonly componentTypeId: string;
  }
  | RuntimeDomainMutationBase & { readonly operation: "relation.put"; readonly relation: RuntimeEntityRelation }
  | RuntimeDomainMutationBase & { readonly operation: "relation.delete"; readonly relationId: string }
  | RuntimeDomainMutationBase & {
    readonly operation: "resource.account.put";
    readonly account: RuntimeResourceAccount;
  }
  | RuntimeDomainMutationBase & { readonly operation: "metric.value.put"; readonly metric: RuntimeMetricValue }
  | RuntimeDomainMutationBase & { readonly operation: "goal.put"; readonly goal: RuntimeGoalState }
  | RuntimeDomainMutationBase & { readonly operation: "goal.delete"; readonly goalId: string }
);
