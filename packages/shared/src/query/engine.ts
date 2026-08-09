import type {
  RuntimeDomainEntity,
  RuntimeDomainSnapshot,
  RuntimeEntityRelation,
  RuntimeJsonValue,
  RuntimeMetricValue,
} from "../runtime/domain.js";
import {
  createRuntimeQueryCursor,
  fingerprintRuntimeQuery,
  resolveRuntimeQueryCursor,
  RuntimeQueryCursorError,
} from "./cursor.js";
import {
  assertRuntimeCapability,
  canReadRuntimeMetric,
  intersectRuntimeFieldPaths,
  isRuntimeFieldPathAllowed,
  resolveRuntimeEntityReadAccess,
  resolveRuntimeRelationReadAccess,
  type RuntimeEntityReadAccess,
} from "./permissions.js";
import {
  RUNTIME_QUERY_CAPABILITIES,
  RUNTIME_QUERY_DEFAULT_PAGE_SIZE,
  RUNTIME_QUERY_MAX_PAGE_SIZE,
  RUNTIME_QUERY_SCHEMA_VERSION,
  type RuntimeAuthorizationContext,
  type RuntimeComponentQueryPredicate,
  type RuntimeEntityQuery,
  type RuntimeEntityQueryResult,
  type RuntimeEntityQuerySort,
  type RuntimeMetricAggregateRow,
  type RuntimeMetricGroupField,
  type RuntimeMetricQuery,
  type RuntimeMetricQueryResult,
  type RuntimeMetricQuerySort,
  type RuntimePermissionFieldSelection,
  type RuntimeProjectedComponent,
  type RuntimeProjectedEntity,
  type RuntimeProjectedRelation,
  type RuntimeQuery,
  type RuntimeQueryFieldPath,
  type RuntimeQueryPageInfo,
  type RuntimeQueryPageRequest,
  type RuntimeQueryResult,
  type RuntimeQueryValuePredicate,
  type RuntimeRelationQueryPredicate,
  type RuntimeSavedQueryView,
} from "./types.js";

export class RuntimeQueryValidationError extends Error {
  readonly code: "invalid-query" | "run-not-found" | "saved-view-planned";

  constructor(code: RuntimeQueryValidationError["code"], message: string) {
    super(message);
    this.name = "RuntimeQueryValidationError";
    this.code = code;
  }
}

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function assertFieldPath(path: RuntimeQueryFieldPath, label: string): void {
  if (!Array.isArray(path) || path.some((segment) => (
    typeof segment !== "string" || segment.length === 0 || FORBIDDEN_PATH_SEGMENTS.has(segment)
  ))) {
    throw new RuntimeQueryValidationError("invalid-query", `${label} 包含无效字段路径`);
  }
}

function assertPage(page: RuntimeQueryPageRequest | undefined): number {
  const limit = page?.limit ?? RUNTIME_QUERY_DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > RUNTIME_QUERY_MAX_PAGE_SIZE) {
    throw new RuntimeQueryValidationError(
      "invalid-query",
      `分页 limit 必须是 1 到 ${RUNTIME_QUERY_MAX_PAGE_SIZE} 的整数`,
    );
  }
  if (page?.cursor !== undefined && page.cursor.length === 0) {
    throw new RuntimeQueryValidationError("invalid-query", "分页 cursor 不能为空字符串");
  }
  return limit;
}

function assertValuePredicate(predicate: RuntimeQueryValuePredicate, label: string): void {
  assertFieldPath(predicate.path, label);
  if (predicate.operator !== "exists" && predicate.value === undefined) {
    throw new RuntimeQueryValidationError("invalid-query", `${label} 的 ${predicate.operator} 运算需要 value`);
  }
  if (predicate.operator === "in" && !Array.isArray(predicate.value)) {
    throw new RuntimeQueryValidationError("invalid-query", `${label} 的 in 运算需要数组 value`);
  }
}

function assertEntityQuery(query: RuntimeEntityQuery): void {
  assertPage(query.page);
  query.filter?.components?.forEach((predicate, index) => {
    assertValuePredicate(predicate, `components[${index}]`);
  });
  query.filter?.relations?.forEach((predicate, relationIndex) => {
    predicate.attributes?.forEach((attribute, attributeIndex) => {
      assertValuePredicate(attribute, `relations[${relationIndex}].attributes[${attributeIndex}]`);
    });
  });
  query.projection.components.forEach((component, index) => {
    component.fieldPaths?.forEach((path) => assertFieldPath(path, `projection.components[${index}]`));
  });
  query.projection.relations.forEach((relation, index) => {
    relation.attributePaths?.forEach((path) => assertFieldPath(path, `projection.relations[${index}]`));
  });
  query.sort?.forEach((sort, index) => {
    if (sort.source === "component") assertFieldPath(sort.path, `sort[${index}]`);
  });
  const changedSince = query.filter?.changedSinceRevision;
  if (changedSince !== undefined && (!Number.isInteger(changedSince) || changedSince < 0)) {
    throw new RuntimeQueryValidationError("invalid-query", "changedSinceRevision 必须是非负整数");
  }
}

function assertMetricQuery(query: RuntimeMetricQuery): void {
  assertPage(query.page);
  if (query.aggregates.length === 0) {
    throw new RuntimeQueryValidationError("invalid-query", "指标查询至少需要一个聚合定义");
  }
  const aggregateIds = new Set<string>();
  query.aggregates.forEach((aggregate) => {
    if (!aggregate.id || aggregateIds.has(aggregate.id)) {
      throw new RuntimeQueryValidationError("invalid-query", "指标聚合 ID 必须非空且唯一");
    }
    aggregateIds.add(aggregate.id);
  });
  query.sort?.forEach((sort) => {
    if (sort.source === "aggregate" && !aggregateIds.has(sort.aggregateId)) {
      throw new RuntimeQueryValidationError("invalid-query", `排序引用了未知聚合 ${sort.aggregateId}`);
    }
  });
  const changedSince = query.filter?.changedSinceRevision;
  if (changedSince !== undefined && (!Number.isInteger(changedSince) || changedSince < 0)) {
    throw new RuntimeQueryValidationError("invalid-query", "changedSinceRevision 必须是非负整数");
  }
}

function assertQuery(snapshot: RuntimeDomainSnapshot, query: RuntimeQuery): void {
  if (query.schemaVersion !== RUNTIME_QUERY_SCHEMA_VERSION) {
    throw new RuntimeQueryValidationError("invalid-query", "查询 schemaVersion 不受支持");
  }
  if (!query.runId || query.runId !== snapshot.runId) {
    throw new RuntimeQueryValidationError("invalid-query", "查询 runId 与快照不一致");
  }
  if (query.kind === "entities") assertEntityQuery(query);
  else assertMetricQuery(query);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function getPath(value: RuntimeJsonValue, path: RuntimeQueryFieldPath): RuntimeJsonValue | undefined {
  let current: RuntimeJsonValue | undefined = value;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Readonly<Record<string, RuntimeJsonValue>>)[segment];
  }
  return current;
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "string" && typeof right === "string") return left < right ? -1 : 1;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  const leftJson = stableJson(left);
  const rightJson = stableJson(right);
  return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function matchesPredicate(value: RuntimeJsonValue | undefined, predicate: RuntimeQueryValuePredicate): boolean {
  if (predicate.operator === "exists") return value !== undefined;
  const expected = predicate.value;
  if (predicate.operator === "eq") return valuesEqual(value, expected);
  if (predicate.operator === "neq") return !valuesEqual(value, expected);
  if (predicate.operator === "in") return (expected as readonly RuntimeJsonValue[]).some((item) => valuesEqual(value, item));
  if (predicate.operator === "contains") {
    if (typeof value === "string" && typeof expected === "string") return value.includes(expected);
    if (Array.isArray(value)) return value.some((item) => valuesEqual(item, expected));
    return false;
  }
  if (value === undefined || expected === undefined) return false;
  const comparison = compareValues(value, expected);
  if (predicate.operator === "gt") return comparison > 0;
  if (predicate.operator === "gte") return comparison >= 0;
  if (predicate.operator === "lt") return comparison < 0;
  return comparison <= 0;
}

function relationDirectionMatches(
  relation: RuntimeEntityRelation,
  entityId: string,
  direction: RuntimeRelationQueryPredicate["direction"],
): boolean {
  if (direction === "outgoing") return relation.sourceEntityId === entityId;
  if (direction === "incoming") return relation.targetEntityId === entityId;
  return relation.sourceEntityId === entityId || relation.targetEntityId === entityId;
}

function relatedEntityId(relation: RuntimeEntityRelation, entityId: string): string {
  return relation.sourceEntityId === entityId ? relation.targetEntityId : relation.sourceEntityId;
}

function componentSelection(
  access: RuntimeEntityReadAccess,
  componentTypeId: string,
): RuntimePermissionFieldSelection | null {
  if (access.components === "*") return "*";
  return access.components.get(componentTypeId) ?? null;
}

function relationSelection(
  access: RuntimeEntityReadAccess,
  relationTypeId: string,
): RuntimePermissionFieldSelection | null {
  if (access.relations === "*") return "*";
  return access.relations.get(relationTypeId) ?? null;
}

function matchesComponentPredicate(
  entity: RuntimeDomainEntity,
  access: RuntimeEntityReadAccess,
  predicate: RuntimeComponentQueryPredicate,
): boolean {
  const selection = componentSelection(access, predicate.componentTypeId);
  if (!selection || !isRuntimeFieldPathAllowed(selection, predicate.path)) return false;
  const component = entity.components.find(({ typeId }) => typeId === predicate.componentTypeId);
  return component !== undefined && matchesPredicate(getPath(component.value, predicate.path), predicate);
}

function matchesRelationPredicate(
  snapshot: RuntimeDomainSnapshot,
  authorization: RuntimeAuthorizationContext,
  entity: RuntimeDomainEntity,
  access: RuntimeEntityReadAccess,
  predicate: RuntimeRelationQueryPredicate,
): boolean {
  const selection = relationSelection(access, predicate.relationTypeId);
  if (!selection) return false;
  return snapshot.relations.some((relation) => {
    if (relation.typeId !== predicate.relationTypeId || !relationDirectionMatches(relation, entity.id, predicate.direction)) {
      return false;
    }
    const otherId = relatedEntityId(relation, entity.id);
    const otherEntity = snapshot.entities.find(({ id }) => id === otherId);
    if (!otherEntity || !resolveRuntimeEntityReadAccess(authorization, RUNTIME_QUERY_CAPABILITIES.entities, otherEntity)) {
      return false;
    }
    if (predicate.targetEntityIds && !predicate.targetEntityIds.includes(otherId)) return false;
    if (predicate.targetEntityTypeIds && !predicate.targetEntityTypeIds.includes(otherEntity.typeId)) return false;
    return predicate.attributes?.every((attribute) => (
      isRuntimeFieldPathAllowed(selection, attribute.path)
      && matchesPredicate(getPath(relation.attributes, attribute.path), attribute)
    )) ?? true;
  });
}

function entityChangedSince(
  snapshot: RuntimeDomainSnapshot,
  entity: RuntimeDomainEntity,
  revision: number,
): boolean {
  return (
    entity.revision > revision
    || entity.components.some((component) => component.revision > revision)
    || snapshot.relations.some((relation) => (
      relation.revision > revision
      && (relation.sourceEntityId === entity.id || relation.targetEntityId === entity.id)
    ))
  );
}

function referencedSortIsReadable(
  entity: RuntimeDomainEntity,
  access: RuntimeEntityReadAccess,
  sort: RuntimeEntityQuerySort,
): boolean {
  if (sort.source === "entity") {
    return sort.field === "id" || access.entityFields === "*" || access.entityFields.has(sort.field);
  }
  const selection = componentSelection(access, sort.componentTypeId);
  return selection !== null && isRuntimeFieldPathAllowed(selection, sort.path)
    && entity.components.some(({ typeId }) => typeId === sort.componentTypeId);
}

function filterEntities(
  snapshot: RuntimeDomainSnapshot,
  query: RuntimeEntityQuery,
  authorization: RuntimeAuthorizationContext,
): readonly { entity: RuntimeDomainEntity; access: RuntimeEntityReadAccess }[] {
  return snapshot.entities.flatMap((entity) => {
    const access = resolveRuntimeEntityReadAccess(authorization, RUNTIME_QUERY_CAPABILITIES.entities, entity);
    if (!access) return [];
    const filter = query.filter;
    if (filter?.entityIds && !filter.entityIds.includes(entity.id)) return [];
    if (filter?.entityTypeIds && !filter.entityTypeIds.includes(entity.typeId)) return [];
    if (filter?.changedSinceRevision !== undefined && !entityChangedSince(snapshot, entity, filter.changedSinceRevision)) {
      return [];
    }
    if (filter?.components && !filter.components.every((item) => matchesComponentPredicate(entity, access, item))) {
      return [];
    }
    if (filter?.relations && !filter.relations.every((item) => (
      matchesRelationPredicate(snapshot, authorization, entity, access, item)
    ))) return [];
    if (query.sort && !query.sort.every((sort) => referencedSortIsReadable(entity, access, sort))) return [];
    return [{ entity, access }];
  });
}

function entitySortValue(entity: RuntimeDomainEntity, sort: RuntimeEntityQuerySort): unknown {
  if (sort.source === "entity") return entity[sort.field];
  const component = entity.components.find(({ typeId }) => typeId === sort.componentTypeId);
  return component ? getPath(component.value, sort.path) : undefined;
}

function compareNullable(
  left: unknown,
  right: unknown,
  direction: "asc" | "desc",
  nulls: "first" | "last" = "last",
): number {
  const leftMissing = left === undefined || left === null;
  const rightMissing = right === undefined || right === null;
  if (leftMissing || rightMissing) {
    if (leftMissing && rightMissing) return 0;
    return (leftMissing ? -1 : 1) * (nulls === "first" ? 1 : -1);
  }
  return compareValues(left, right) * (direction === "asc" ? 1 : -1);
}

function sortEntities(
  entries: readonly { entity: RuntimeDomainEntity; access: RuntimeEntityReadAccess }[],
  sorts: readonly RuntimeEntityQuerySort[] | undefined,
): readonly { entity: RuntimeDomainEntity; access: RuntimeEntityReadAccess }[] {
  return [...entries].sort((left, right) => {
    for (const sort of sorts ?? []) {
      const compared = compareNullable(
        entitySortValue(left.entity, sort),
        entitySortValue(right.entity, sort),
        sort.direction,
        sort.nulls,
      );
      if (compared !== 0) return compared;
    }
    return left.entity.id < right.entity.id ? -1 : left.entity.id > right.entity.id ? 1 : 0;
  });
}

function setPath(target: Record<string, RuntimeJsonValue>, path: RuntimeQueryFieldPath, value: RuntimeJsonValue): void {
  if (path.length === 0) return;
  let cursor = target;
  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      cursor[segment] = value;
      return;
    }
    const next = cursor[segment];
    if (typeof next !== "object" || next === null || Array.isArray(next)) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, RuntimeJsonValue>;
  });
}

function projectJsonValue(
  value: RuntimeJsonValue,
  paths: "*" | readonly RuntimeQueryFieldPath[],
): RuntimeJsonValue {
  if (paths === "*" || paths.some((path) => path.length === 0)) return value;
  const projected: Record<string, RuntimeJsonValue> = {};
  paths.forEach((path) => {
    const selected = getPath(value, path);
    if (selected !== undefined) setPath(projected, path, selected);
  });
  return projected;
}

function projectComponents(
  entity: RuntimeDomainEntity,
  access: RuntimeEntityReadAccess,
  query: RuntimeEntityQuery,
): readonly RuntimeProjectedComponent[] {
  return query.projection.components.flatMap((requested) => {
    const granted = componentSelection(access, requested.componentTypeId);
    if (!granted) return [];
    const paths = intersectRuntimeFieldPaths(requested.fieldPaths, granted);
    if (paths !== "*" && paths.length === 0) return [];
    const component = entity.components.find(({ typeId }) => typeId === requested.componentTypeId);
    if (!component) return [];
    return [{
      typeId: component.typeId,
      value: projectJsonValue(component.value, paths),
      revision: component.revision,
      updatedAt: component.updatedAt,
    }];
  });
}

function projectRelations(
  snapshot: RuntimeDomainSnapshot,
  authorization: RuntimeAuthorizationContext,
  entity: RuntimeDomainEntity,
  query: RuntimeEntityQuery,
): readonly RuntimeProjectedRelation[] {
  const projected = new Map<string, RuntimeProjectedRelation>();
  query.projection.relations.forEach((requested) => {
    snapshot.relations.forEach((relation) => {
      if (relation.typeId !== requested.relationTypeId || !relationDirectionMatches(relation, entity.id, requested.direction)) {
        return;
      }
      const granted = resolveRuntimeRelationReadAccess(
        authorization,
        RUNTIME_QUERY_CAPABILITIES.entities,
        relation,
        entity,
      );
      if (!granted) return;
      const other = snapshot.entities.find(({ id }) => id === relatedEntityId(relation, entity.id));
      if (!other || !resolveRuntimeEntityReadAccess(authorization, RUNTIME_QUERY_CAPABILITIES.entities, other)) return;
      const paths = intersectRuntimeFieldPaths(requested.attributePaths, granted);
      projected.set(relation.id, {
        id: relation.id,
        typeId: relation.typeId,
        sourceEntityId: relation.sourceEntityId,
        targetEntityId: relation.targetEntityId,
        attributes: projectJsonValue(relation.attributes, paths) as Readonly<Record<string, RuntimeJsonValue>>,
        revision: relation.revision,
        updatedAt: relation.updatedAt,
      });
    });
  });
  return [...projected.values()].sort((left, right) => (
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  ));
}

function projectEntity(
  snapshot: RuntimeDomainSnapshot,
  authorization: RuntimeAuthorizationContext,
  entry: { entity: RuntimeDomainEntity; access: RuntimeEntityReadAccess },
  query: RuntimeEntityQuery,
): RuntimeProjectedEntity {
  const { entity, access } = entry;
  const requestedFields = query.projection.entityFields.filter((field) => (
    access.entityFields === "*" || access.entityFields.has(field)
  ));
  const fields = Object.fromEntries(requestedFields.map((field) => [field, entity[field]]));
  return {
    id: entity.id,
    ...fields,
    components: projectComponents(entity, access, query),
    relations: projectRelations(snapshot, authorization, entity, query),
  } as RuntimeProjectedEntity;
}

function withoutPage(query: RuntimeQuery): unknown {
  const { page: _page, ...definition } = query;
  return definition;
}

function paginate<T>(options: {
  readonly items: readonly T[];
  readonly itemKey: (item: T) => string;
  readonly page: RuntimeQueryPageRequest | undefined;
  readonly kind: "entities" | "metrics";
  readonly runId: string;
  readonly baseRevision: number;
  readonly queryFingerprint: string;
}): { readonly items: readonly T[]; readonly pageInfo: RuntimeQueryPageInfo } {
  const limit = assertPage(options.page);
  let start = 0;
  if (options.page?.cursor) {
    const lastItemKey = resolveRuntimeQueryCursor(options.page.cursor, {
      kind: options.kind,
      runId: options.runId,
      baseRevision: options.baseRevision,
      queryFingerprint: options.queryFingerprint,
    });
    const cursorIndex = options.items.findIndex((item) => options.itemKey(item) === lastItemKey);
    if (cursorIndex < 0) throw new RuntimeQueryCursorError("cursor-mismatch", "游标项目不在当前结果集中");
    start = cursorIndex + 1;
  }
  const items = options.items.slice(start, start + limit);
  const hasNextPage = start + items.length < options.items.length;
  const lastItem = items.at(-1);
  const nextCursor = hasNextPage && lastItem
    ? createRuntimeQueryCursor({
      version: RUNTIME_QUERY_SCHEMA_VERSION,
      kind: options.kind,
      runId: options.runId,
      baseRevision: options.baseRevision,
      queryFingerprint: options.queryFingerprint,
      lastItemKey: options.itemKey(lastItem),
    })
    : null;
  return { items, pageInfo: { limit, hasNextPage, nextCursor } };
}

function executeEntityQuery(
  snapshot: RuntimeDomainSnapshot,
  query: RuntimeEntityQuery,
  authorization: RuntimeAuthorizationContext,
): RuntimeEntityQueryResult {
  assertRuntimeCapability(authorization, RUNTIME_QUERY_CAPABILITIES.entities);
  const sorted = sortEntities(filterEntities(snapshot, query, authorization), query.sort);
  const fingerprint = fingerprintRuntimeQuery(withoutPage(query));
  const page = paginate({
    items: sorted,
    itemKey: ({ entity }) => entity.id,
    page: query.page,
    kind: "entities",
    runId: query.runId,
    baseRevision: snapshot.revision,
    queryFingerprint: fingerprint,
  });
  return {
    schemaVersion: RUNTIME_QUERY_SCHEMA_VERSION,
    kind: "entities",
    runId: query.runId,
    revision: {
      baseRevision: snapshot.revision,
      changedSinceRevision: query.filter?.changedSinceRevision ?? null,
    },
    items: page.items.map((entry) => projectEntity(snapshot, authorization, entry, query)),
    pageInfo: page.pageInfo,
  };
}

function metricGroupValue(metric: RuntimeMetricValue, field: RuntimeMetricGroupField): string {
  if (field === "metricTypeId") return metric.metricTypeId;
  if (field === "scope.kind") return metric.scope.kind;
  return metric.scope.id;
}

function aggregateMetrics(query: RuntimeMetricQuery, metrics: readonly RuntimeMetricValue[]): readonly RuntimeMetricAggregateRow[] {
  const groups = new Map<string, { group: Record<string, string>; values: number[] }>();
  metrics.forEach((metric) => {
    const group = Object.fromEntries(query.groupBy.map((field) => [field, metricGroupValue(metric, field)]));
    const key = query.groupBy.length === 0 ? "all" : stableJson(group);
    const current = groups.get(key) ?? { group, values: [] };
    current.values.push(metric.value);
    groups.set(key, current);
  });
  if (query.groupBy.length === 0 && groups.size === 0) groups.set("all", { group: {}, values: [] });
  return [...groups.entries()].map(([key, { group, values }]) => {
    const total = values.reduce((sum, value) => sum + value, 0);
    const aggregates = Object.fromEntries(query.aggregates.map((aggregate): [string, number | null] => {
      if (aggregate.operation === "count") return [aggregate.id, values.length];
      if (values.length === 0) return [aggregate.id, null];
      if (aggregate.operation === "sum") return [aggregate.id, total];
      if (aggregate.operation === "average") return [aggregate.id, total / values.length];
      if (aggregate.operation === "minimum") return [aggregate.id, Math.min(...values)];
      return [aggregate.id, Math.max(...values)];
    }));
    return { key, group, aggregates };
  });
}

function metricSortValue(row: RuntimeMetricAggregateRow, sort: RuntimeMetricQuerySort): unknown {
  if (sort.source === "group") return row.group[sort.field];
  return row.aggregates[sort.aggregateId];
}

function sortMetricRows(
  rows: readonly RuntimeMetricAggregateRow[],
  sorts: readonly RuntimeMetricQuerySort[] | undefined,
): readonly RuntimeMetricAggregateRow[] {
  return [...rows].sort((left, right) => {
    for (const sort of sorts ?? []) {
      const compared = compareNullable(
        metricSortValue(left, sort),
        metricSortValue(right, sort),
        sort.direction,
        sort.nulls,
      );
      if (compared !== 0) return compared;
    }
    return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
  });
}

function executeMetricQuery(
  snapshot: RuntimeDomainSnapshot,
  query: RuntimeMetricQuery,
  authorization: RuntimeAuthorizationContext,
): RuntimeMetricQueryResult {
  assertRuntimeCapability(authorization, RUNTIME_QUERY_CAPABILITIES.metrics);
  const metrics = snapshot.metricValues.filter((metric) => {
    if (!canReadRuntimeMetric(authorization, RUNTIME_QUERY_CAPABILITIES.metrics, metric)) return false;
    if (query.filter?.metricTypeIds && !query.filter.metricTypeIds.includes(metric.metricTypeId)) return false;
    if (query.filter?.scopeKinds && !query.filter.scopeKinds.includes(metric.scope.kind)) return false;
    if (query.filter?.scopeIds && !query.filter.scopeIds.includes(metric.scope.id)) return false;
    return query.filter?.changedSinceRevision === undefined || metric.revision > query.filter.changedSinceRevision;
  });
  const sorted = sortMetricRows(aggregateMetrics(query, metrics), query.sort);
  const fingerprint = fingerprintRuntimeQuery(withoutPage(query));
  const page = paginate({
    items: sorted,
    itemKey: ({ key }) => key,
    page: query.page,
    kind: "metrics",
    runId: query.runId,
    baseRevision: snapshot.revision,
    queryFingerprint: fingerprint,
  });
  return {
    schemaVersion: RUNTIME_QUERY_SCHEMA_VERSION,
    kind: "metrics",
    runId: query.runId,
    revision: {
      baseRevision: snapshot.revision,
      changedSinceRevision: query.filter?.changedSinceRevision ?? null,
    },
    items: page.items,
    pageInfo: page.pageInfo,
  };
}

export function executeRuntimeQuery(
  snapshot: RuntimeDomainSnapshot,
  query: RuntimeQuery,
  authorization: RuntimeAuthorizationContext,
): RuntimeQueryResult {
  assertQuery(snapshot, query);
  return query.kind === "entities"
    ? executeEntityQuery(snapshot, query, authorization)
    : executeMetricQuery(snapshot, query, authorization);
}

export function materializeRuntimeSavedQuery(
  view: RuntimeSavedQueryView,
  runId: string,
  page?: RuntimeQueryPageRequest,
): RuntimeQuery {
  if (view.schemaVersion !== RUNTIME_QUERY_SCHEMA_VERSION) {
    throw new RuntimeQueryValidationError("invalid-query", "保存视图 schemaVersion 不受支持");
  }
  if (view.status !== "available") {
    throw new RuntimeQueryValidationError("saved-view-planned", `保存视图 ${view.id} 尚未可用`);
  }
  if (!runId) throw new RuntimeQueryValidationError("invalid-query", "runId 不能为空");
  const base = {
    ...view.query,
    schemaVersion: RUNTIME_QUERY_SCHEMA_VERSION,
    runId,
  };
  return page === undefined ? base : { ...base, page };
}
