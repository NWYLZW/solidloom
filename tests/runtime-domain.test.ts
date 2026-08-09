import {
  RUNTIME_DOMAIN_SCHEMA_VERSION,
  runtimeDomainDefinitionsSchema,
  runtimeDomainMutationSchema,
  runtimeDomainProjectionSchema,
  runtimeDomainSnapshotSchema,
  validateRuntimeDomainDefinitions,
  validateRuntimeDomainMutation,
  validateRuntimeDomainProjection,
  validateRuntimeDomainSnapshot,
  type RuntimeDomainDefinitions,
  type RuntimeDomainMutation,
  type RuntimeDomainProjection,
  type RuntimeDomainSnapshot,
} from "@solidloom/shared";
import { describe, expect, it } from "vitest";

const now = "2026-08-09T12:00:00.000Z";

function definitionsFixture(): RuntimeDomainDefinitions {
  return {
    schemaVersion: RUNTIME_DOMAIN_SCHEMA_VERSION,
    revision: 3,
    entityTypes: [{
      kind: "entity",
      id: "sample.actor",
      domainPackageId: "sample-package",
      displayName: "主体",
      description: "可组合组件的通用主体。",
      revision: 1,
      status: "planned",
      componentTypeIds: ["sample.profile", "sample.focus", "sample.score"],
    }],
    componentTypes: [
      {
        kind: "component",
        id: "sample.profile",
        domainPackageId: "sample-package",
        displayName: "持久档案",
        description: "随存档保存的字段。",
        revision: 1,
        status: "planned",
        storage: "persistent",
        schema: { type: "object", properties: { value: { type: "number" } } },
        defaultValue: { value: 0 },
      },
      {
        kind: "component",
        id: "sample.focus",
        domainPackageId: "sample-package",
        displayName: "短期状态",
        description: "具有有效期的观察状态。",
        revision: 1,
        status: "planned",
        storage: "ephemeral",
        schema: { type: "object", properties: { active: { type: "boolean" } } },
        ttlMs: 1_000,
      },
      {
        kind: "component",
        id: "sample.score",
        domainPackageId: "sample-package",
        displayName: "派生状态",
        description: "从持久档案计算的状态。",
        revision: 1,
        status: "planned",
        storage: "derived",
        schema: { type: "number" },
        dependencies: ["sample.profile"],
        expression: { language: "solidloom-expression-v1", source: "component('sample.profile').value * 2" },
      },
    ],
    relationTypes: [{
      kind: "relation",
      id: "sample.link",
      domainPackageId: "sample-package",
      displayName: "有向连接",
      description: "两个通用实体之间的有向边。",
      revision: 1,
      status: "planned",
      direction: "directed",
      sourceCardinality: "many",
      targetCardinality: "many",
      sourceEntityTypeIds: ["sample.actor"],
      targetEntityTypeIds: ["sample.actor"],
      attributesSchema: { type: "object" },
      symmetric: false,
      transitive: false,
      uniquePair: true,
    }],
    resourceTypes: [{
      kind: "resource",
      id: "sample.token",
      domainPackageId: "sample-package",
      displayName: "可转移量",
      description: "可拥有和预留的通用资源。",
      revision: 1,
      status: "planned",
      unit: "unit",
      precision: 0,
      divisible: false,
      allowNegative: false,
      conservation: "closed",
      holderEntityTypeIds: ["sample.actor"],
    }],
    metricTypes: [
      {
        kind: "metric",
        id: "sample.total",
        domainPackageId: "sample-package",
        displayName: "累计值",
        description: "不可转移的累计指标。",
        revision: 1,
        status: "planned",
        mode: "counter",
        unit: "point",
      },
      {
        kind: "metric",
        id: "sample.rank",
        domainPackageId: "sample-package",
        displayName: "派生指标",
        description: "从累计值计算的投影。",
        revision: 1,
        status: "planned",
        mode: "derived",
        dependencies: ["sample.total"],
        expression: { language: "solidloom-expression-v1", source: "metric('sample.total') / 10" },
      },
    ],
    goalTypes: [{
      kind: "goal",
      id: "sample.target",
      domainPackageId: "sample-package",
      displayName: "运行目标",
      description: "属于运行实例或实体的完成条件。",
      revision: 1,
      status: "planned",
      allowedScopeKinds: ["run", "entity"],
      completion: { language: "solidloom-expression-v1", source: "metric('sample.total') >= 10" },
      progress: { language: "solidloom-expression-v1", source: "metric('sample.total') / 10" },
    }],
  };
}

function snapshotFixture(): RuntimeDomainSnapshot {
  const runScope = { runId: "run-1", kind: "run" as const, id: "run-1" };
  const entityScope = { runId: "run-1", kind: "entity" as const, id: "entity-a" };
  return {
    schemaVersion: RUNTIME_DOMAIN_SCHEMA_VERSION,
    runId: "run-1",
    revision: 8,
    capturedAt: now,
    entities: [{
      id: "entity-a",
      typeId: "sample.actor",
      domainPackageId: "sample-package",
      scope: runScope,
      components: [{ typeId: "sample.profile", value: { value: 4 }, revision: 2, updatedAt: now }],
      revision: 2,
      createdAt: now,
      updatedAt: now,
    }],
    relations: [{
      id: "relation-a",
      typeId: "sample.link",
      sourceEntityId: "entity-a",
      targetEntityId: "entity-a",
      scope: runScope,
      attributes: { weight: 1 },
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }],
    resourceAccounts: [{
      id: "account-a",
      resourceTypeId: "sample.token",
      holderEntityId: "entity-a",
      scope: entityScope,
      balance: 5,
      reserved: 1,
      revision: 3,
      updatedAt: now,
    }],
    metricValues: [{
      id: "metric-a",
      metricTypeId: "sample.total",
      scope: runScope,
      value: 4,
      revision: 3,
      updatedAt: now,
    }],
    goals: [{
      id: "goal-a",
      goalTypeId: "sample.target",
      scope: runScope,
      status: "active",
      progress: 0.4,
      dueAt: null,
      revision: 2,
      createdAt: now,
      updatedAt: now,
    }],
  };
}

function minimalDefinitions(namespace: string, customField: string): RuntimeDomainDefinitions {
  return {
    schemaVersion: RUNTIME_DOMAIN_SCHEMA_VERSION,
    revision: 0,
    entityTypes: [{
      kind: "entity",
      id: `${namespace}.subject`,
      domainPackageId: `${namespace}-package`,
      displayName: namespace,
      description: "最小验证实体。",
      revision: 0,
      status: "planned",
      componentTypeIds: [`${namespace}.state`],
    }],
    componentTypes: [{
      kind: "component",
      id: `${namespace}.state`,
      domainPackageId: `${namespace}-package`,
      displayName: customField,
      description: "由领域包自行定义的持久字段。",
      revision: 0,
      status: "planned",
      storage: "persistent",
      schema: { type: "object", properties: { [customField]: { type: "number" } } },
    }],
    relationTypes: [],
    resourceTypes: [],
    metricTypes: [],
    goalTypes: [],
  };
}

describe("runtime domain contract", () => {
  it("maps four unrelated domains without changing the platform contract", () => {
    const catalogs = [
      minimalDefinitions("worksite", "capacity"),
      minimalDefinitions("lineage", "continuity"),
      minimalDefinitions("academy", "attunement"),
      minimalDefinitions("civic", "stability"),
    ];

    for (const catalog of catalogs) {
      expect(validateRuntimeDomainDefinitions(catalog)).toEqual([]);
      expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);
    }
  });

  it("validates a revisioned persistent snapshot with typed relations, resources, metrics and goals", () => {
    const definitions = definitionsFixture();
    const snapshot = snapshotFixture();

    expect(validateRuntimeDomainDefinitions(definitions)).toEqual([]);
    expect(validateRuntimeDomainSnapshot(snapshot, definitions)).toEqual([]);
    expect(snapshot.resourceAccounts[0]?.reserved).toBe(1);
    expect(snapshot.metricValues[0]).not.toHaveProperty("reserved");
  });

  it("keeps ephemeral and derived values out of persistent snapshots", () => {
    const definitions = definitionsFixture();
    const snapshot = snapshotFixture();
    const invalidSnapshot = {
      ...snapshot,
      entities: [{
        ...snapshot.entities[0]!,
        components: [{ typeId: "sample.focus", value: { active: true }, revision: 1, updatedAt: now }],
      }],
      metricValues: [{
        ...snapshot.metricValues[0]!,
        metricTypeId: "sample.rank",
      }],
    };
    const issues = validateRuntimeDomainSnapshot(invalidSnapshot, definitions);
    expect(issues.filter(({ code }) => code === "state-boundary")).toHaveLength(2);

    const projection: RuntimeDomainProjection = {
      runId: "run-1",
      baseRevision: snapshot.revision,
      ephemeralComponents: [{
        entityId: "entity-a",
        typeId: "sample.focus",
        scope: { runId: "run-1", kind: "entity", id: "entity-a" },
        value: { active: true },
        sourceRevision: snapshot.revision,
        observedAt: now,
        expiresAt: "2026-08-09T12:00:01.000Z",
      }],
      derivedComponents: [{
        entityId: "entity-a",
        typeId: "sample.score",
        scope: { runId: "run-1", kind: "entity", id: "entity-a" },
        value: 8,
        sourceRevision: snapshot.revision,
        computedAt: now,
      }],
      derivedMetrics: [{
        metricTypeId: "sample.rank",
        scope: { runId: "run-1", kind: "run", id: "run-1" },
        value: 0.4,
        sourceRevision: snapshot.revision,
        computedAt: now,
      }],
    };
    expect(validateRuntimeDomainProjection(projection, definitions)).toEqual([]);
    expect(runtimeDomainSnapshotSchema.properties).not.toHaveProperty("ephemeralComponents");
    expect(runtimeDomainSnapshotSchema.properties).not.toHaveProperty("derivedComponents");
  });

  it("requires concurrency control on every write and reports stale revisions", () => {
    const definitions = definitionsFixture();
    const snapshot = snapshotFixture();
    const mutation: RuntimeDomainMutation = {
      id: "mutation-a",
      runId: snapshot.runId,
      scope: { runId: snapshot.runId, kind: "run", id: snapshot.runId },
      expectedRevision: snapshot.revision,
      issuedAt: now,
      operation: "entity.put",
      entity: snapshot.entities[0]!,
    };

    expect(validateRuntimeDomainMutation(mutation, {
      definitions,
      currentRevision: snapshot.revision,
    })).toEqual([]);
    expect(validateRuntimeDomainMutation(mutation, {
      definitions,
      currentRevision: snapshot.revision + 1,
    })).toEqual(expect.arrayContaining([expect.objectContaining({ code: "revision-conflict" })]));
    const { expectedRevision: _omitted, ...withoutRevision } = mutation;
    expect(validateRuntimeDomainMutation(withoutRevision)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "mutation.expectedRevision" })]),
    );
    expect(runtimeDomainMutationSchema.oneOf.every(({ required }) => required.includes("expectedRevision"))).toBe(true);
  });

  it("validates every supported revisioned write shape", () => {
    const definitions = definitionsFixture();
    const snapshot = snapshotFixture();
    const base = {
      id: "mutation-a",
      runId: snapshot.runId,
      scope: { runId: snapshot.runId, kind: "run" as const, id: snapshot.runId },
      expectedRevision: snapshot.revision,
      issuedAt: now,
    };
    const writes: RuntimeDomainMutation[] = [
      { ...base, operation: "entity.put", entity: snapshot.entities[0]! },
      { ...base, operation: "entity.delete", entityId: "entity-a" },
      { ...base, operation: "component.set", entityId: "entity-a", component: snapshot.entities[0]!.components[0]! },
      { ...base, operation: "component.remove", entityId: "entity-a", componentTypeId: "sample.profile" },
      {
        ...base,
        operation: "state.ephemeral.set",
        state: {
          entityId: "entity-a",
          typeId: "sample.focus",
          scope: { runId: "run-1", kind: "entity", id: "entity-a" },
          value: { active: true },
          sourceRevision: snapshot.revision,
          observedAt: now,
          expiresAt: null,
        },
      },
      { ...base, operation: "state.ephemeral.remove", entityId: "entity-a", componentTypeId: "sample.focus" },
      { ...base, operation: "relation.put", relation: snapshot.relations[0]! },
      { ...base, operation: "relation.delete", relationId: "relation-a" },
      { ...base, operation: "resource.account.put", account: snapshot.resourceAccounts[0]! },
      { ...base, operation: "metric.value.put", metric: snapshot.metricValues[0]! },
      { ...base, operation: "goal.put", goal: snapshot.goals[0]! },
      { ...base, operation: "goal.delete", goalId: "goal-a" },
    ];

    expect(writes.map((write) => validateRuntimeDomainMutation(write, {
      currentRevision: snapshot.revision,
      definitions,
    }))).toEqual(writes.map(() => []));
  });

  it("does not expose a write operation for derived state", () => {
    const definitions = definitionsFixture();
    const derivedWrite = {
      id: "mutation-derived",
      runId: "run-1",
      scope: { runId: "run-1", kind: "entity", id: "entity-a" },
      expectedRevision: 8,
      issuedAt: now,
      operation: "component.set",
      entityId: "entity-a",
      component: { typeId: "sample.score", value: 8, revision: 1, updatedAt: now },
    };
    expect(validateRuntimeDomainMutation(derivedWrite, { definitions })).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "state-boundary" })]),
    );
    expect(runtimeDomainMutationSchema.oneOf.map(({ properties }) => properties.operation.const)).not.toContain("state.derived.set");
  });

  it("enforces typed relation cardinality and scoped resource limits", () => {
    const baseDefinitions = definitionsFixture();
    const definitions: RuntimeDomainDefinitions = {
      ...baseDefinitions,
      relationTypes: [{ ...baseDefinitions.relationTypes[0]!, sourceCardinality: "one" }],
    };
    const baseSnapshot = snapshotFixture();
    const snapshot: RuntimeDomainSnapshot = {
      ...baseSnapshot,
      entities: [
        ...baseSnapshot.entities,
        {
          ...baseSnapshot.entities[0]!,
          id: "entity-b",
          scope: { runId: "run-1", kind: "run", id: "run-1" },
        },
      ],
      relations: [
        ...baseSnapshot.relations,
        {
          ...baseSnapshot.relations[0]!,
          id: "relation-b",
          targetEntityId: "entity-b",
        },
      ],
      resourceAccounts: [{ ...baseSnapshot.resourceAccounts[0]!, balance: -1, reserved: 0 }],
    };

    const issues = validateRuntimeDomainSnapshot(snapshot, definitions);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "relation-constraint" }),
      expect.objectContaining({ path: "snapshot.resourceAccounts[0].balance" }),
    ]));
  });

  it("exports serializable schemas for definitions, snapshots, projections and mutations", () => {
    const schemas = [
      runtimeDomainDefinitionsSchema,
      runtimeDomainSnapshotSchema,
      runtimeDomainProjectionSchema,
      runtimeDomainMutationSchema,
    ];
    for (const schema of schemas) expect(() => JSON.stringify(schema)).not.toThrow();
    expect(runtimeDomainDefinitionsSchema.properties.schemaVersion.const).toBe(RUNTIME_DOMAIN_SCHEMA_VERSION);
  });

  it("reports malformed definition collections without throwing during cross-reference checks", () => {
    const definitions = definitionsFixture();
    const malformed = {
      ...definitions,
      entityTypes: [null, { ...definitions.entityTypes[0], componentTypeIds: 42 }],
      componentTypes: [null, { ...definitions.componentTypes[2], dependencies: 42 }],
      relationTypes: [{ ...definitions.relationTypes[0], sourceEntityTypeIds: 42 }],
      resourceTypes: [{ ...definitions.resourceTypes[0], holderEntityTypeIds: 42 }],
      metricTypes: [{ ...definitions.metricTypes[1], dependencies: ["sample.missing"] }],
    };

    expect(() => validateRuntimeDomainDefinitions(malformed)).not.toThrow();
    expect(validateRuntimeDomainDefinitions(malformed)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid-structure", path: "definitions.entityTypes[0]" }),
      expect.objectContaining({ code: "unknown-reference", path: "definitions.metricTypes[0].dependencies[0]" }),
    ]));
  });
});
