import type {
  RuntimeDomainEntity,
  RuntimeEntityRelation,
  RuntimeMetricValue,
  RuntimeScope,
} from "../runtime/domain.js";
import type {
  RuntimeAuthorizationContext,
  RuntimeDataGrant,
  RuntimePermissionFieldSelection,
  RuntimePrincipalRoleAssignment,
  RuntimeQueryEntityField,
  RuntimeQueryFieldPath,
  RuntimeRoleDefinition,
} from "./types.js";

interface ActiveGrant {
  readonly assignment: RuntimePrincipalRoleAssignment;
  readonly role: RuntimeRoleDefinition;
  readonly grant: RuntimeDataGrant;
}

export interface RuntimeEntityReadAccess {
  readonly entityFields: "*" | ReadonlySet<RuntimeQueryEntityField>;
  readonly components: "*" | ReadonlyMap<string, RuntimePermissionFieldSelection>;
  readonly relations: "*" | ReadonlyMap<string, RuntimePermissionFieldSelection>;
}

export class RuntimePermissionDeniedError extends Error {
  readonly code = "permission-denied" as const;
  readonly principalId: string;
  readonly capabilityId: string;

  constructor(principalId: string, capabilityId: string) {
    super(`主体 ${principalId} 不具备能力 ${capabilityId}`);
    this.name = "RuntimePermissionDeniedError";
    this.principalId = principalId;
    this.capabilityId = capabilityId;
  }
}

function scopeMatches(
  assignment: RuntimePrincipalRoleAssignment,
  runId: string,
  itemScope: RuntimeScope,
  itemId: string,
  relation?: RuntimeEntityRelation,
): boolean {
  const scope = assignment.scope;
  if (scope.runId !== runId) return false;
  if (scope.kind === "run") return scope.id === runId;
  if (scope.kind === "entity") {
    if (relation) return relation.sourceEntityId === scope.id || relation.targetEntityId === scope.id;
    return scope.id === itemId || (itemScope.kind === "entity" && itemScope.id === scope.id);
  }
  if (scope.kind === "relation") return relation?.id === scope.id;
  return itemScope.kind === "custom" && itemScope.id === scope.id;
}

function activeGrants(
  authorization: RuntimeAuthorizationContext,
  capabilityId: string,
): readonly ActiveGrant[] {
  const roles = new Map(authorization.roles.map((role) => [role.id, role]));
  return authorization.principal.assignments.flatMap((assignment): readonly ActiveGrant[] => {
    const role = roles.get(assignment.roleId);
    if (!role || role.status !== "available" || !role.capabilityIds.includes(capabilityId)) return [];
    return role.dataGrants
      .filter((grant) => grant.capabilityId === capabilityId)
      .map((grant) => ({ assignment, role, grant }));
  });
}

export function assertRuntimeCapability(
  authorization: RuntimeAuthorizationContext,
  capabilityId: string,
): void {
  if (activeGrants(authorization, capabilityId).length === 0) {
    throw new RuntimePermissionDeniedError(authorization.principal.principalId, capabilityId);
  }
}

function selectionIncludes(selection: "*" | readonly string[], value: string): boolean {
  return selection === "*" || selection.includes(value);
}

function mergeFieldSelection(
  current: RuntimePermissionFieldSelection | undefined,
  incoming: RuntimePermissionFieldSelection,
): RuntimePermissionFieldSelection {
  if (current === "*" || incoming === "*") return "*";
  const paths = [...(current ?? []), ...incoming];
  const unique = new Map(paths.map((path) => [JSON.stringify(path), path]));
  return [...unique.values()];
}

export function resolveRuntimeEntityReadAccess(
  authorization: RuntimeAuthorizationContext,
  capabilityId: string,
  entity: RuntimeDomainEntity,
): RuntimeEntityReadAccess | null {
  const grants = activeGrants(authorization, capabilityId).filter(({ assignment, grant }) => {
    const entityGrant = grant.entities;
    if (!entityGrant) return false;
    if (!scopeMatches(assignment, entity.scope.runId, entity.scope, entity.id)) return false;
    if (!selectionIncludes(entityGrant.entityTypeIds, entity.typeId)) return false;
    return entityGrant.entityIds === undefined || entityGrant.entityIds.includes(entity.id);
  });
  if (grants.length === 0) return null;

  let allEntityFields = false;
  let allComponents = false;
  let allRelations = false;
  const entityFields = new Set<RuntimeQueryEntityField>();
  const components = new Map<string, RuntimePermissionFieldSelection>();
  const relations = new Map<string, RuntimePermissionFieldSelection>();

  grants.forEach(({ grant }) => {
    const entityGrant = grant.entities;
    if (!entityGrant) return;
    if (entityGrant.entityFields === "*") allEntityFields = true;
    else entityGrant.entityFields.forEach((field) => entityFields.add(field));

    if (entityGrant.components === "*") allComponents = true;
    else entityGrant.components.forEach((component) => {
      components.set(
        component.componentTypeId,
        mergeFieldSelection(components.get(component.componentTypeId), component.fieldPaths),
      );
    });

    if (entityGrant.relations === "*") allRelations = true;
    else entityGrant.relations.forEach((relation) => {
      relations.set(
        relation.relationTypeId,
        mergeFieldSelection(relations.get(relation.relationTypeId), relation.attributePaths),
      );
    });
  });

  return {
    entityFields: allEntityFields ? "*" : entityFields,
    components: allComponents ? "*" : components,
    relations: allRelations ? "*" : relations,
  };
}

export function resolveRuntimeRelationReadAccess(
  authorization: RuntimeAuthorizationContext,
  capabilityId: string,
  relation: RuntimeEntityRelation,
  visibleFromEntity: RuntimeDomainEntity,
): RuntimePermissionFieldSelection | null {
  const entityAccess = resolveRuntimeEntityReadAccess(authorization, capabilityId, visibleFromEntity);
  if (!entityAccess) return null;
  if (entityAccess.relations === "*") return "*";
  return entityAccess.relations.get(relation.typeId) ?? null;
}

export function canReadRuntimeMetric(
  authorization: RuntimeAuthorizationContext,
  capabilityId: string,
  metric: RuntimeMetricValue,
): boolean {
  return activeGrants(authorization, capabilityId).some(({ assignment, grant }) => {
    const metricGrant = grant.metrics;
    if (!metricGrant) return false;
    if (!scopeMatches(assignment, metric.scope.runId, metric.scope, metric.id)) return false;
    if (!selectionIncludes(metricGrant.metricTypeIds, metric.metricTypeId)) return false;
    if (metricGrant.scopeKinds && !metricGrant.scopeKinds.includes(metric.scope.kind)) return false;
    return metricGrant.scopeIds === undefined || metricGrant.scopeIds.includes(metric.scope.id);
  });
}

function isPrefix(prefix: RuntimeQueryFieldPath, value: RuntimeQueryFieldPath): boolean {
  return prefix.length <= value.length && prefix.every((segment, index) => segment === value[index]);
}

export function isRuntimeFieldPathAllowed(
  selection: RuntimePermissionFieldSelection,
  path: RuntimeQueryFieldPath,
): boolean {
  return selection === "*" || selection.some((allowed) => isPrefix(allowed, path));
}

export function intersectRuntimeFieldPaths(
  requested: readonly RuntimeQueryFieldPath[] | undefined,
  granted: RuntimePermissionFieldSelection,
): "*" | readonly RuntimeQueryFieldPath[] {
  if (requested === undefined) return granted;
  if (granted === "*") return requested;

  const intersections: RuntimeQueryFieldPath[] = [];
  requested.forEach((requestPath) => {
    granted.forEach((grantPath) => {
      if (isPrefix(grantPath, requestPath)) intersections.push(requestPath);
      else if (isPrefix(requestPath, grantPath)) intersections.push(grantPath);
    });
  });
  const unique = new Map(intersections.map((path) => [JSON.stringify(path), path]));
  return [...unique.values()];
}
