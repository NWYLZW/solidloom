import type {
  RuntimeJsonValue,
  RuntimeScope,
  RuntimeScopeKind,
} from "../runtime/domain.js";

export const RUNTIME_QUERY_SCHEMA_VERSION = 1 as const;
export const RUNTIME_QUERY_MAX_PAGE_SIZE = 100 as const;
export const RUNTIME_QUERY_DEFAULT_PAGE_SIZE = 25 as const;

export const RUNTIME_QUERY_CAPABILITIES = {
  entities: "runtime.query.entities",
  metrics: "runtime.query.metrics",
  savedViews: "runtime.query.saved-views",
} as const;

export type RuntimeQueryCapability = (
  typeof RUNTIME_QUERY_CAPABILITIES[keyof typeof RUNTIME_QUERY_CAPABILITIES]
);

export const RUNTIME_QUERY_ENTITY_FIELDS = [
  "typeId",
  "domainPackageId",
  "scope",
  "revision",
  "createdAt",
  "updatedAt",
] as const;

export type RuntimeQueryEntityField = (typeof RUNTIME_QUERY_ENTITY_FIELDS)[number];
export type RuntimeQueryFieldPath = readonly string[];
export type RuntimeQuerySortDirection = "asc" | "desc";
export type RuntimeQueryNullPlacement = "first" | "last";

export type RuntimeQueryValueOperator = (
  "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains"
  | "exists"
);

export interface RuntimeQueryValuePredicate {
  readonly path: RuntimeQueryFieldPath;
  readonly operator: RuntimeQueryValueOperator;
  readonly value?: RuntimeJsonValue;
}

export interface RuntimeComponentQueryPredicate extends RuntimeQueryValuePredicate {
  readonly componentTypeId: string;
}

export interface RuntimeRelationQueryPredicate {
  readonly relationTypeId: string;
  readonly direction: "outgoing" | "incoming" | "either";
  readonly targetEntityIds?: readonly string[];
  readonly targetEntityTypeIds?: readonly string[];
  readonly attributes?: readonly RuntimeQueryValuePredicate[];
}

export interface RuntimeEntityQueryFilter {
  readonly entityIds?: readonly string[];
  readonly entityTypeIds?: readonly string[];
  readonly components?: readonly RuntimeComponentQueryPredicate[];
  readonly relations?: readonly RuntimeRelationQueryPredicate[];
  readonly changedSinceRevision?: number;
}

export interface RuntimeComponentQueryProjection {
  readonly componentTypeId: string;
  readonly fieldPaths?: readonly RuntimeQueryFieldPath[];
}

export interface RuntimeRelationQueryProjection {
  readonly relationTypeId: string;
  readonly direction: "outgoing" | "incoming" | "either";
  readonly attributePaths?: readonly RuntimeQueryFieldPath[];
}

export interface RuntimeEntityQueryProjection {
  readonly entityFields: readonly RuntimeQueryEntityField[];
  readonly components: readonly RuntimeComponentQueryProjection[];
  readonly relations: readonly RuntimeRelationQueryProjection[];
}

export type RuntimeEntityQuerySort = (
  | {
    readonly source: "entity";
    readonly field: "id" | RuntimeQueryEntityField;
    readonly direction: RuntimeQuerySortDirection;
    readonly nulls?: RuntimeQueryNullPlacement;
  }
  | {
    readonly source: "component";
    readonly componentTypeId: string;
    readonly path: RuntimeQueryFieldPath;
    readonly direction: RuntimeQuerySortDirection;
    readonly nulls?: RuntimeQueryNullPlacement;
  }
);

export interface RuntimeQueryPageRequest {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface RuntimeEntityQueryDefinition {
  readonly kind: "entities";
  readonly filter?: RuntimeEntityQueryFilter;
  readonly projection: RuntimeEntityQueryProjection;
  readonly sort?: readonly RuntimeEntityQuerySort[];
}

export interface RuntimeEntityQuery extends RuntimeEntityQueryDefinition {
  readonly schemaVersion: typeof RUNTIME_QUERY_SCHEMA_VERSION;
  readonly runId: string;
  readonly page?: RuntimeQueryPageRequest;
}

export type RuntimeMetricGroupField = "metricTypeId" | "scope.kind" | "scope.id";
export type RuntimeMetricAggregateOperation = "count" | "sum" | "average" | "minimum" | "maximum";

export interface RuntimeMetricAggregateDefinition {
  readonly id: string;
  readonly operation: RuntimeMetricAggregateOperation;
}

export interface RuntimeMetricQueryFilter {
  readonly metricTypeIds?: readonly string[];
  readonly scopeKinds?: readonly RuntimeScopeKind[];
  readonly scopeIds?: readonly string[];
  readonly changedSinceRevision?: number;
}

export type RuntimeMetricQuerySort = (
  | {
    readonly source: "group";
    readonly field: RuntimeMetricGroupField;
    readonly direction: RuntimeQuerySortDirection;
    readonly nulls?: RuntimeQueryNullPlacement;
  }
  | {
    readonly source: "aggregate";
    readonly aggregateId: string;
    readonly direction: RuntimeQuerySortDirection;
    readonly nulls?: RuntimeQueryNullPlacement;
  }
);

export interface RuntimeMetricQueryDefinition {
  readonly kind: "metrics";
  readonly filter?: RuntimeMetricQueryFilter;
  readonly groupBy: readonly RuntimeMetricGroupField[];
  readonly aggregates: readonly RuntimeMetricAggregateDefinition[];
  readonly sort?: readonly RuntimeMetricQuerySort[];
}

export interface RuntimeMetricQuery extends RuntimeMetricQueryDefinition {
  readonly schemaVersion: typeof RUNTIME_QUERY_SCHEMA_VERSION;
  readonly runId: string;
  readonly page?: RuntimeQueryPageRequest;
}

export type RuntimeQueryDefinition = RuntimeEntityQueryDefinition | RuntimeMetricQueryDefinition;
export type RuntimeQuery = RuntimeEntityQuery | RuntimeMetricQuery;

export interface RuntimeSavedQueryView {
  readonly schemaVersion: typeof RUNTIME_QUERY_SCHEMA_VERSION;
  readonly kind: "saved-query-view";
  readonly id: string;
  readonly domainPackageId: string;
  readonly displayName: string;
  readonly description: string;
  readonly revision: number;
  readonly status: "available" | "planned";
  readonly query: RuntimeQueryDefinition;
}

export type RuntimePermissionFieldSelection = "*" | readonly RuntimeQueryFieldPath[];
export type RuntimePermissionTypeSelection = "*" | readonly string[];

export interface RuntimeComponentReadGrant {
  readonly componentTypeId: string;
  readonly fieldPaths: RuntimePermissionFieldSelection;
}

export interface RuntimeRelationReadGrant {
  readonly relationTypeId: string;
  readonly attributePaths: RuntimePermissionFieldSelection;
}

export interface RuntimeEntityReadGrant {
  readonly entityTypeIds: RuntimePermissionTypeSelection;
  readonly entityIds?: readonly string[];
  readonly entityFields: "*" | readonly RuntimeQueryEntityField[];
  readonly components: "*" | readonly RuntimeComponentReadGrant[];
  readonly relations: "*" | readonly RuntimeRelationReadGrant[];
}

export interface RuntimeMetricReadGrant {
  readonly metricTypeIds: RuntimePermissionTypeSelection;
  readonly scopeKinds?: readonly RuntimeScopeKind[];
  readonly scopeIds?: readonly string[];
}

export interface RuntimeDataGrant {
  readonly capabilityId: string;
  readonly entities?: RuntimeEntityReadGrant;
  readonly metrics?: RuntimeMetricReadGrant;
}

export interface RuntimeRoleDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly status: "available" | "planned";
  readonly capabilityIds: readonly string[];
  readonly dataGrants: readonly RuntimeDataGrant[];
}

export interface RuntimePrincipalRoleAssignment {
  readonly roleId: string;
  readonly scope: RuntimeScope;
}

export interface RuntimeQueryPrincipal {
  readonly principalId: string;
  readonly assignments: readonly RuntimePrincipalRoleAssignment[];
}

export interface RuntimeAuthorizationContext {
  readonly principal: RuntimeQueryPrincipal;
  readonly roles: readonly RuntimeRoleDefinition[];
}

export interface RuntimeProjectedComponent {
  readonly typeId: string;
  readonly value: RuntimeJsonValue;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface RuntimeProjectedRelation {
  readonly id: string;
  readonly typeId: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly attributes: Readonly<Record<string, RuntimeJsonValue>>;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface RuntimeProjectedEntity {
  readonly id: string;
  readonly typeId?: string;
  readonly domainPackageId?: string;
  readonly scope?: RuntimeScope;
  readonly revision?: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly components: readonly RuntimeProjectedComponent[];
  readonly relations: readonly RuntimeProjectedRelation[];
}

export interface RuntimeQueryPageInfo {
  readonly limit: number;
  readonly hasNextPage: boolean;
  readonly nextCursor: string | null;
}

export interface RuntimeQueryRevisionInfo {
  readonly baseRevision: number;
  readonly changedSinceRevision: number | null;
}

export interface RuntimeEntityQueryResult {
  readonly schemaVersion: typeof RUNTIME_QUERY_SCHEMA_VERSION;
  readonly kind: "entities";
  readonly runId: string;
  readonly revision: RuntimeQueryRevisionInfo;
  readonly items: readonly RuntimeProjectedEntity[];
  readonly pageInfo: RuntimeQueryPageInfo;
}

export interface RuntimeMetricAggregateRow {
  readonly key: string;
  readonly group: Readonly<Partial<Record<RuntimeMetricGroupField, string>>>;
  readonly aggregates: Readonly<Record<string, number | null>>;
}

export interface RuntimeMetricQueryResult {
  readonly schemaVersion: typeof RUNTIME_QUERY_SCHEMA_VERSION;
  readonly kind: "metrics";
  readonly runId: string;
  readonly revision: RuntimeQueryRevisionInfo;
  readonly items: readonly RuntimeMetricAggregateRow[];
  readonly pageInfo: RuntimeQueryPageInfo;
}

export type RuntimeQueryResult = RuntimeEntityQueryResult | RuntimeMetricQueryResult;
