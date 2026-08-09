import {
  assertDomainPackageMigrationReady,
  builtInDomainRegistry,
  compareSemanticVersions,
  createDomainPackageRegistry,
  defineDomainPackage,
  defineFactoryModelModule,
  DomainPackageContractError,
  DomainPackageManifestValidationError,
  domainPackageManifestSchema,
  isValidVersionRange,
  planDomainPackageMigration,
  satisfiesVersionRange,
  type DomainPackageManifest,
} from "@solidloom/shared";
import { describe, expect, it } from "vitest";

function manifest(
  id: string,
  overrides: Partial<DomainPackageManifest> = {},
): DomainPackageManifest {
  return {
    schemaVersion: 1,
    id,
    namespace: id,
    displayName: id,
    description: `${id} 测试领域包。`,
    version: "1.0.0",
    dataVersion: "1.0.0",
    status: "planned",
    platformVersion: "^0.1.0",
    dependencies: [],
    extends: [],
    definitions: {
      entityTypes: [],
      componentTypes: [],
      relationTypes: [],
      resourceTypes: [],
      metricTypes: [],
      actionTypes: [],
      processTypes: [],
      ruleSets: [],
      viewDefinitions: [],
    },
    migrations: [],
    ...overrides,
  };
}

function domainPackage(id: string, overrides: Partial<DomainPackageManifest> = {}) {
  return defineDomainPackage(manifest(id, overrides), {
    models: [],
    capabilities: [],
    uiExtensions: [],
  });
}

describe("domain package manifest contract", () => {
  it("exports a serializable schema and a complete built-in cyber factory manifest", () => {
    expect(JSON.parse(JSON.stringify(domainPackageManifestSchema))).toMatchObject({
      properties: { schemaVersion: { const: 1 } },
      required: expect.arrayContaining(["platformVersion", "dataVersion", "migrations"]),
    });
    const cyberFactory = builtInDomainRegistry.packages.get("cyber-factory");
    expect(cyberFactory?.manifest).toMatchObject({
      schemaVersion: 1,
      namespace: "cyber-factory",
      platformVersion: "^0.1.0",
      dataVersion: "1.0.0",
    });
    expect(createDomainPackageRegistry([]).packages.list()).toEqual([]);
  });

  it("requires namespaced definition IDs and rejects duplicate declarations", () => {
    expect(() => domainPackage("office", {
      definitions: {
        ...manifest("office").definitions,
        entityTypes: ["other.employee"],
      },
    })).toThrow(DomainPackageManifestValidationError);
    expect(() => domainPackage("office", {
      definitions: {
        ...manifest("office").definitions,
        entityTypes: ["office.employee"],
        componentTypes: ["office.employee"],
      },
    })).toThrow("同时声明");
  });

  it("does not allow a planned package to advertise available contributions", () => {
    const model = defineFactoryModelModule({
      id: "planned-model",
      status: "available",
      createModel: () => ({ name: "测试模型" }),
    });
    expect(() => defineDomainPackage(manifest("planned-domain"), {
      models: [model],
      capabilities: [],
      uiExtensions: [],
    })).toThrow("planned 领域包不能包含 available 贡献");
  });

  it("validates platform and package dependency compatibility before registration", () => {
    const foundation = domainPackage("foundation", { version: "2.1.0" });
    const consumer = domainPackage("consumer", {
      dependencies: [{ id: "foundation", version: "^2.0.0" }],
    });
    expect(createDomainPackageRegistry([foundation, consumer]).packages.ids())
      .toEqual(["foundation", "consumer"]);

    expect(() => createDomainPackageRegistry([consumer])).toThrowError(
      expect.objectContaining({ code: "dependency-missing" }),
    );
    expect(() => createDomainPackageRegistry([
      domainPackage("foundation", { version: "1.9.0" }),
      consumer,
    ])).toThrowError(expect.objectContaining({ code: "dependency-incompatible" }));
    expect(() => createDomainPackageRegistry([
      domainPackage("future", { platformVersion: ">=1.0.0" }),
    ])).toThrowError(expect.objectContaining({ code: "platform-incompatible" }));
  });

  it("requires explicit installed dependencies for package extensions", () => {
    const extension = domainPackage("extension", {
      extends: ["foundation"],
      dependencies: [{ id: "foundation", version: "^1.0.0" }],
    });
    expect(() => createDomainPackageRegistry([extension])).toThrowError(
      expect.objectContaining({ code: "dependency-missing" }),
    );
    expect(createDomainPackageRegistry([domainPackage("foundation"), extension]).packages.has("extension"))
      .toBe(true);
  });

  it("rejects duplicate namespaces and dependency cycles with diagnostic codes", () => {
    const first = domainPackage("first", { namespace: "shared" });
    const second = domainPackage("second", { namespace: "shared" });
    expect(() => createDomainPackageRegistry([first, second])).toThrowError(
      expect.objectContaining({ code: "namespace-conflict" }),
    );

    const left = domainPackage("left", { dependencies: [{ id: "right", version: "*" }] });
    const right = domainPackage("right", { dependencies: [{ id: "left", version: "*" }] });
    expect(() => createDomainPackageRegistry([left, right])).toThrowError(
      expect.objectContaining({ code: "dependency-cycle" }),
    );
  });
});

describe("domain package versions and migrations", () => {
  it("supports the documented conservative semantic version ranges", () => {
    expect(isValidVersionRange(">=0.1.0 <1.0.0")).toBe(true);
    expect(isValidVersionRange("^2.3.0")).toBe(true);
    expect(isValidVersionRange("2.x")).toBe(false);
    expect(satisfiesVersionRange("0.5.0", "^0.1.0")).toBe(false);
    expect(satisfiesVersionRange("2.7.1", "^2.3.0")).toBe(true);
    expect(satisfiesVersionRange("3.0.0", "^2.3.0")).toBe(false);
    expect(compareSemanticVersions("1.0.0-beta.2", "1.0.0")).toBeLessThan(0);
  });

  it("distinguishes ready, planned and unavailable migration paths", () => {
    const baseMigrations: DomainPackageManifest["migrations"] = [
      {
        id: "operations.migration.v1-v2",
        from: "1.0.0",
        to: "2.0.0",
        entry: "./migrations/v1-v2.js",
        status: "available",
      },
      {
        id: "operations.migration.v2-v3",
        from: "2.0.0",
        to: "3.0.0",
        entry: "./migrations/v2-v3.js",
        status: "planned",
      },
    ];
    const plannedManifest = manifest("operations", {
      dataVersion: "3.0.0",
      migrations: baseMigrations,
    });
    const planned = planDomainPackageMigration(plannedManifest, "1.0.0");
    expect(planned).toMatchObject({ status: "planned", from: "1.0.0", to: "3.0.0" });
    expect(() => assertDomainPackageMigrationReady(planned)).toThrow(DomainPackageContractError);

    const readyManifest = manifest("operations", {
      dataVersion: "3.0.0",
      migrations: baseMigrations.map((migration) => ({ ...migration, status: "available" })),
    });
    expect(planDomainPackageMigration(readyManifest, "1.0.0")).toMatchObject({
      status: "ready",
      steps: [{ from: "1.0.0", to: "2.0.0" }, { from: "2.0.0", to: "3.0.0" }],
    });
    expect(planDomainPackageMigration(readyManifest, "0.5.0")).toMatchObject({
      status: "unavailable",
      steps: [],
    });
    expect(planDomainPackageMigration(readyManifest, "4.0.0")).toMatchObject({
      status: "unavailable",
      reason: expect.stringContaining("不能静默降级"),
    });
  });
});
