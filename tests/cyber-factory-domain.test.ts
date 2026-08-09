import {
  RUNTIME_QUERY_CAPABILITIES,
  assertRuntimeDomainDefinitions,
  builtInDomainRegistry,
  createDomainPackageRegistry,
  defineDomainPackage,
  validateRuntimeDomainDefinitions,
  validateRuntimeDomainSnapshot,
  type RuntimeDomainEntity,
  type RuntimeDomainSnapshot,
} from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
  cyberFactoryComponentTypes,
  cyberFactoryEntityTypeIds,
  cyberFactoryModelEntityTypeMap,
  cyberFactoryMetricTypes,
  cyberFactoryResourceTypes,
  resolveCyberFactoryEntityTypeForModel,
} from "../domain-packages/cyber-factory/entities/index.js";
import {
  createCyberFactoryDomainBundle,
  cyberFactoryAuthorizationProfile,
  cyberFactoryDefinitionCatalog,
  cyberFactoryManifest,
  cyberFactoryRuntimeDefinitions,
} from "../domain-packages/cyber-factory/manifest/index.js";
import { cyberFactoryRelationTypes } from "../domain-packages/cyber-factory/relations/index.js";

const timestamp = "2026-08-10T00:00:00.000Z";
const runScope = { runId: "run-cyber-factory", kind: "run" as const, id: "run-cyber-factory" };

function entity(id: string, typeId: string): RuntimeDomainEntity {
  return {
    id,
    typeId,
    domainPackageId: "cyber-factory",
    scope: runScope,
    components: [],
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function snapshot(): RuntimeDomainSnapshot {
  return {
    schemaVersion: 1,
    runId: runScope.runId,
    revision: 1,
    capturedAt: timestamp,
    entities: [
      entity("organization-a", cyberFactoryEntityTypeIds.organization),
      entity("employee-a", cyberFactoryEntityTypeIds.employee),
      entity("task-a", cyberFactoryEntityTypeIds.task),
    ],
    relations: [
      {
        id: "employment-a",
        typeId: "cyber-factory.employed-by",
        sourceEntityId: "employee-a",
        targetEntityId: "organization-a",
        scope: runScope,
        attributes: { title: "工程师" },
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "assignment-a",
        typeId: "cyber-factory.assigned-to",
        sourceEntityId: "employee-a",
        targetEntityId: "task-a",
        scope: runScope,
        attributes: { allocation: 0.8 },
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    resourceAccounts: [],
    metricValues: [],
    goals: [],
  };
}

describe("赛博工厂领域包", () => {
  it("通过通用领域定义校验且 manifest 与运行时目录一致", () => {
    expect(validateRuntimeDomainDefinitions(cyberFactoryRuntimeDefinitions)).toEqual([]);
    expect(() => assertRuntimeDomainDefinitions(cyberFactoryRuntimeDefinitions)).not.toThrow();
    expect(cyberFactoryManifest.definitions).toEqual(cyberFactoryDefinitionCatalog);
    expect(cyberFactoryDefinitionCatalog).toEqual({
      entityTypes: cyberFactoryRuntimeDefinitions.entityTypes.map(({ id }) => id),
      componentTypes: cyberFactoryComponentTypes.map(({ id }) => id),
      relationTypes: cyberFactoryRelationTypes.map(({ id }) => id),
      resourceTypes: cyberFactoryResourceTypes.map(({ id }) => id),
      metricTypes: cyberFactoryMetricTypes.map(({ id }) => id),
      actionTypes: [],
      processTypes: [],
      ruleSets: [cyberFactoryAuthorizationProfile.id],
      viewDefinitions: [],
    });
    expect(builtInDomainRegistry.packages.get("cyber-factory")?.manifest.definitions)
      .toEqual(cyberFactoryDefinitionCatalog);
  });

  it("可以独立启用或禁用而不修改平台类型", () => {
    expect(createCyberFactoryDomainBundle({ enabled: false })).toBeNull();
    const bundle = createCyberFactoryDomainBundle();
    expect(bundle?.manifest.id).toBe("cyber-factory");

    const packageDefinition = defineDomainPackage(cyberFactoryManifest, {
      models: [],
      capabilities: [],
      uiExtensions: [],
    });
    expect(createDomainPackageRegistry([]).packages.has("cyber-factory")).toBe(false);
    expect(createDomainPackageRegistry([packageDefinition]).packages.has("cyber-factory")).toBe(true);
  });

  it("由通用校验器验证关系端点与定义字段", () => {
    const valid = snapshot();
    expect(validateRuntimeDomainSnapshot(valid, cyberFactoryRuntimeDefinitions)).toEqual([]);

    const wrongSource = {
      ...valid,
      relations: [{
        ...valid.relations[0]!,
        sourceEntityId: "organization-a",
        attributes: { unsupported: true },
      }],
    };
    expect(validateRuntimeDomainSnapshot(wrongSource, cyberFactoryRuntimeDefinitions)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "relation-constraint" }),
      ]),
    );

    const definitionWithPrivateField = {
      ...cyberFactoryRuntimeDefinitions,
      componentTypes: [{
        ...cyberFactoryRuntimeDefinitions.componentTypes[0]!,
        factoryOnlyValue: true,
      }, ...cyberFactoryRuntimeDefinitions.componentTypes.slice(1)],
    };
    expect(validateRuntimeDomainDefinitions(definitionWithPrivateField)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "invalid-structure" })]),
    );
  });

  it("提供命名空间隔离的角色和最小读取授权", () => {
    expect(cyberFactoryAuthorizationProfile.namespace).toBe("cyber-factory");
    expect(cyberFactoryAuthorizationProfile.roles).toHaveLength(3);
    for (const role of cyberFactoryAuthorizationProfile.roles) {
      expect(role.id).toMatch(/^cyber-factory\.role\./);
      expect(role.capabilityIds).toEqual(expect.arrayContaining([
        RUNTIME_QUERY_CAPABILITIES.entities,
        RUNTIME_QUERY_CAPABILITIES.metrics,
      ]));
      expect(role.dataGrants).not.toHaveLength(0);
    }
  });

  it("为现有领域模型提供稳定的实体类型迁移映射", () => {
    for (const [modelId, typeId] of Object.entries(cyberFactoryModelEntityTypeMap)) {
      expect(resolveCyberFactoryEntityTypeForModel(modelId)).toBe(typeId);
      expect(cyberFactoryDefinitionCatalog.entityTypes).toContain(typeId);
    }
    expect(resolveCyberFactoryEntityTypeForModel("unknown-model")).toBeNull();
    expect(resolveCyberFactoryEntityTypeForModel("cyber-factory-warehouse-stacker-crane"))
      .toBe(cyberFactoryEntityTypeIds.device);
  });
});
