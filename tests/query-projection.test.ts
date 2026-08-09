import {
  RUNTIME_DOMAIN_SCHEMA_VERSION,
  RUNTIME_QUERY_CAPABILITIES,
  RUNTIME_QUERY_SCHEMA_VERSION,
  RuntimePermissionDeniedError,
  RuntimeQueryCursorError,
  RuntimeQueryValidationError,
  executeRuntimeQuery,
  materializeRuntimeSavedQuery,
  type RuntimeAuthorizationContext,
  type RuntimeDomainEntity,
  type RuntimeDomainSnapshot,
  type RuntimeEntityQuery,
  type RuntimeMetricQuery,
  type RuntimeQueryPrincipal,
  type RuntimeRoleDefinition,
  type RuntimeSavedQueryView,
} from "@solidloom/shared";
import { RuntimePermissionService } from "../apps/server/src/permissions/runtime-permission-service.js";
import {
  RuntimeQueryService,
  type RuntimeSnapshotReadRequest,
} from "../apps/server/src/queries/runtime-query-service.js";
import { describe, expect, it } from "vitest";

const timestamp = "2026-08-09T12:00:00.000Z";
const runScope = { runId: "run-query", kind: "run" as const, id: "run-query" };

function entity(
  id: string,
  rank: number,
  revision: number,
  typeId = "sample.node",
): RuntimeDomainEntity {
  return {
    id,
    typeId,
    domainPackageId: "sample-package",
    scope: runScope,
    components: [{
      typeId: "sample.profile",
      value: {
        public: { label: id.toUpperCase() },
        secret: { token: `private-${id}` },
        rank,
      },
      revision,
      updatedAt: timestamp,
    }],
    revision,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function snapshot(revision = 12): RuntimeDomainSnapshot {
  return {
    schemaVersion: RUNTIME_DOMAIN_SCHEMA_VERSION,
    runId: "run-query",
    revision,
    capturedAt: timestamp,
    entities: [
      entity("entity-a", 2, 3),
      entity("entity-b", 2, 7),
      entity("entity-c", 5, 4),
      entity("entity-hidden", 1, 9, "sample.restricted"),
    ],
    relations: [
      {
        id: "relation-visible",
        typeId: "sample.link",
        sourceEntityId: "entity-a",
        targetEntityId: "entity-b",
        scope: runScope,
        attributes: { publicWeight: 4, secretNote: "hidden" },
        revision: 8,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "relation-hidden-target",
        typeId: "sample.link",
        sourceEntityId: "entity-a",
        targetEntityId: "entity-hidden",
        scope: runScope,
        attributes: { publicWeight: 9, secretNote: "hidden" },
        revision: 10,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    resourceAccounts: [],
    metricValues: [
      {
        id: "metric-a",
        metricTypeId: "sample.score",
        scope: { runId: "run-query", kind: "entity", id: "entity-a" },
        value: 4,
        revision: 3,
        updatedAt: timestamp,
      },
      {
        id: "metric-b",
        metricTypeId: "sample.score",
        scope: { runId: "run-query", kind: "entity", id: "entity-b" },
        value: 6,
        revision: 8,
        updatedAt: timestamp,
      },
      {
        id: "metric-secret",
        metricTypeId: "sample.private-score",
        scope: runScope,
        value: 1000,
        revision: 9,
        updatedAt: timestamp,
      },
    ],
    goals: [],
  };
}

function observerRole(): RuntimeRoleDefinition {
  return {
    id: "sample.observer",
    displayName: "受限观察者",
    status: "available",
    capabilityIds: Object.values(RUNTIME_QUERY_CAPABILITIES),
    dataGrants: [
      {
        capabilityId: RUNTIME_QUERY_CAPABILITIES.entities,
        entities: {
          entityTypeIds: ["sample.node"],
          entityFields: ["typeId", "revision"],
          components: [{
            componentTypeId: "sample.profile",
            fieldPaths: [["public"], ["rank"]],
          }],
          relations: [{
            relationTypeId: "sample.link",
            attributePaths: [["publicWeight"]],
          }],
        },
      },
      {
        capabilityId: RUNTIME_QUERY_CAPABILITIES.metrics,
        metrics: {
          metricTypeIds: ["sample.score"],
          scopeKinds: ["entity"],
        },
      },
      { capabilityId: RUNTIME_QUERY_CAPABILITIES.savedViews },
    ],
  };
}

const principal: RuntimeQueryPrincipal = {
  principalId: "principal-observer",
  assignments: [{ roleId: "sample.observer", scope: runScope }],
};

function authorization(role = observerRole()): RuntimeAuthorizationContext {
  return { principal, roles: [role] };
}

function entityQuery(page?: RuntimeEntityQuery["page"]): RuntimeEntityQuery {
  const query: RuntimeEntityQuery = {
    schemaVersion: RUNTIME_QUERY_SCHEMA_VERSION,
    kind: "entities",
    runId: "run-query",
    filter: { entityTypeIds: ["sample.node"] },
    projection: {
      entityFields: ["typeId", "domainPackageId", "revision"],
      components: [{ componentTypeId: "sample.profile" }],
      relations: [{ relationTypeId: "sample.link", direction: "either" }],
    },
    sort: [{
      source: "component",
      componentTypeId: "sample.profile",
      path: ["rank"],
      direction: "asc",
    }],
  };
  return page === undefined ? query : { ...query, page };
}

describe("runtime query projection", () => {
  it("uses stable sorting and revision-bound cursor pagination", () => {
    const first = executeRuntimeQuery(snapshot(), entityQuery({ limit: 2 }), authorization());
    expect(first.kind).toBe("entities");
    if (first.kind !== "entities") throw new Error("unexpected result kind");
    expect(first.items.map(({ id }) => id)).toEqual(["entity-a", "entity-b"]);
    expect(first.pageInfo.hasNextPage).toBe(true);
    expect(first.pageInfo.nextCursor).toBeTypeOf("string");

    const second = executeRuntimeQuery(
      snapshot(),
      entityQuery({ limit: 2, cursor: first.pageInfo.nextCursor ?? undefined }),
      authorization(),
    );
    expect(second.kind).toBe("entities");
    if (second.kind !== "entities") throw new Error("unexpected result kind");
    expect(second.items.map(({ id }) => id)).toEqual(["entity-c"]);
    expect(second.pageInfo.hasNextPage).toBe(false);
  });

  it("rejects cursors after the query or base revision changes", () => {
    const first = executeRuntimeQuery(snapshot(), entityQuery({ limit: 1 }), authorization());
    const cursor = first.pageInfo.nextCursor;
    expect(cursor).not.toBeNull();
    expect(() => executeRuntimeQuery(
      snapshot(),
      { ...entityQuery({ limit: 1, cursor: cursor ?? undefined }), filter: { entityIds: ["entity-a"] } },
      authorization(),
    )).toThrow(RuntimeQueryCursorError);
    expect(() => executeRuntimeQuery(
      snapshot(13),
      entityQuery({ limit: 1, cursor: cursor ?? undefined }),
      authorization(),
    )).toThrowError(expect.objectContaining({ code: "cursor-stale" }));
  });

  it("removes unauthorized entities, metadata, component fields and relation attributes", () => {
    const result = executeRuntimeQuery(snapshot(), entityQuery({ limit: 10 }), authorization());
    expect(result.kind).toBe("entities");
    if (result.kind !== "entities") throw new Error("unexpected result kind");
    expect(result.items.some(({ id }) => id === "entity-hidden")).toBe(false);
    const first = result.items.find(({ id }) => id === "entity-a");
    expect(first).toMatchObject({
      id: "entity-a",
      typeId: "sample.node",
      revision: 3,
      components: [{
        typeId: "sample.profile",
        value: { public: { label: "ENTITY-A" }, rank: 2 },
      }],
      relations: [{
        id: "relation-visible",
        attributes: { publicWeight: 4 },
      }],
    });
    expect(first).not.toHaveProperty("domainPackageId");
    expect(JSON.stringify(first)).not.toContain("private-entity-a");
    expect(JSON.stringify(first)).not.toContain("secretNote");
    expect(JSON.stringify(first)).not.toContain("relation-hidden-target");
  });

  it("does not evaluate filters or sorts through unreadable fields", () => {
    const hiddenFilter: RuntimeEntityQuery = {
      ...entityQuery(),
      filter: {
        components: [{
          componentTypeId: "sample.profile",
          path: ["secret", "token"],
          operator: "eq",
          value: "private-entity-a",
        }],
      },
    };
    expect(executeRuntimeQuery(snapshot(), hiddenFilter, authorization())).toMatchObject({ items: [] });

    const hiddenSort: RuntimeEntityQuery = {
      ...entityQuery(),
      sort: [{
        source: "component",
        componentTypeId: "sample.profile",
        path: ["secret", "token"],
        direction: "asc",
      }],
    };
    expect(executeRuntimeQuery(snapshot(), hiddenSort, authorization())).toMatchObject({ items: [] });
  });

  it("applies role assignments to their exact run or entity scope", () => {
    const entityScoped: RuntimeAuthorizationContext = {
      principal: {
        principalId: "principal-scoped",
        assignments: [{
          roleId: "sample.observer",
          scope: { runId: "run-query", kind: "entity", id: "entity-b" },
        }],
      },
      roles: [observerRole()],
    };
    const result = executeRuntimeQuery(snapshot(), entityQuery(), entityScoped);
    expect(result).toMatchObject({ items: [{ id: "entity-b" }] });
  });

  it("filters by authorized relations and includes relation changes in incremental revisions", () => {
    const query: RuntimeEntityQuery = {
      ...entityQuery(),
      filter: {
        changedSinceRevision: 7,
        relations: [{
          relationTypeId: "sample.link",
          direction: "outgoing",
          targetEntityIds: ["entity-b"],
          attributes: [{ path: ["publicWeight"], operator: "gte", value: 4 }],
        }],
      },
    };
    const result = executeRuntimeQuery(snapshot(), query, authorization());
    expect(result).toMatchObject({
      revision: { baseRevision: 12, changedSinceRevision: 7 },
      items: [{ id: "entity-a" }],
    });
  });

  it("aggregates only metric types and scopes granted to the observer", () => {
    const query: RuntimeMetricQuery = {
      schemaVersion: RUNTIME_QUERY_SCHEMA_VERSION,
      kind: "metrics",
      runId: "run-query",
      groupBy: ["metricTypeId"],
      aggregates: [
        { id: "items", operation: "count" },
        { id: "total", operation: "sum" },
        { id: "mean", operation: "average" },
      ],
      sort: [{ source: "aggregate", aggregateId: "total", direction: "desc" }],
    };
    const result = executeRuntimeQuery(snapshot(), query, authorization());
    expect(result).toMatchObject({
      kind: "metrics",
      items: [{
        group: { metricTypeId: "sample.score" },
        aggregates: { items: 2, total: 10, mean: 5 },
      }],
    });
    expect(JSON.stringify(result)).not.toContain("private-score");
    expect(JSON.stringify(result)).not.toContain("1000");
  });

  it("requires an available role capability and does not let planned roles authorize access", () => {
    expect(() => executeRuntimeQuery(snapshot(), entityQuery(), {
      principal,
      roles: [{ ...observerRole(), status: "planned" }],
    })).toThrow(RuntimePermissionDeniedError);
  });

  it("materializes available saved views but refuses planned capability placeholders", () => {
    const view: RuntimeSavedQueryView = {
      schemaVersion: RUNTIME_QUERY_SCHEMA_VERSION,
      kind: "saved-query-view",
      id: "sample.node-list",
      domainPackageId: "sample-package",
      displayName: "节点列表",
      description: "通用实体保存视图。",
      revision: 1,
      status: "available",
      query: {
        kind: "entities",
        filter: { entityTypeIds: ["sample.node"] },
        projection: { entityFields: ["typeId"], components: [], relations: [] },
      },
    };
    expect(materializeRuntimeSavedQuery(view, "run-query", { limit: 5 })).toMatchObject({
      kind: "entities",
      runId: "run-query",
      page: { limit: 5 },
    });
    expect(() => materializeRuntimeSavedQuery({ ...view, status: "planned" }, "run-query"))
      .toThrowError(expect.objectContaining({ code: "saved-view-planned" }));
  });

  it("runs the same serialized query through the server boundary without exposing a database API", async () => {
    const reads: RuntimeSnapshotReadRequest[] = [];
    const permissions = new RuntimePermissionService({
      readRoles: async (roleIds) => roleIds.includes("sample.observer") ? [observerRole()] : [],
    });
    const service = new RuntimeQueryService({
      permissions,
      snapshots: {
        readSnapshot: async (request) => {
          reads.push(request);
          return snapshot(request.revision ?? 12);
        },
      },
    });
    const first = await service.execute(principal, entityQuery({ limit: 1 }));
    const cursor = first.pageInfo.nextCursor;
    await service.execute(principal, entityQuery({ limit: 1, cursor: cursor ?? undefined }));
    expect(reads).toEqual([{ runId: "run-query" }, { runId: "run-query", revision: 12 }]);
    expect(Object.keys(service)).toEqual([]);
  });

  it("validates bounded page sizes and field paths before execution", () => {
    expect(() => executeRuntimeQuery(snapshot(), entityQuery({ limit: 101 }), authorization()))
      .toThrow(RuntimeQueryValidationError);
    expect(() => executeRuntimeQuery(snapshot(), {
      ...entityQuery(),
      filter: {
        components: [{
          componentTypeId: "sample.profile",
          path: ["__proto__"],
          operator: "exists",
        }],
      },
    }, authorization())).toThrow(RuntimeQueryValidationError);
  });
});
