import {
  assertDomainPackageMigrationReady,
  planDomainPackageMigration,
  type DomainPackageManifest,
  type DomainPackageMigrationDeclaration,
  type RuntimeJsonObject,
  type RuntimeJsonValue,
} from "@solidloom/shared";
import type { RuntimeEventEnvelope } from "../events/types.js";
import { cloneRuntimeJson } from "../events/integrity.js";
import { RuntimeArchiveMigrationError } from "./errors.js";
import { RuntimeMigrationRegistry } from "./runtime-migration-registry.js";
import type {
  RuntimeArchive,
  RuntimeDomainPackageVersions,
  RuntimeMigrationHandler,
  RuntimeMigrationSubject,
} from "./types.js";

interface PreparedStep {
  readonly packageId: string;
  readonly declaration: DomainPackageMigrationDeclaration;
  readonly handler: RuntimeMigrationHandler;
}

interface PreparedPackagePlan {
  readonly packageId: string;
  readonly targetVersion: string;
  readonly steps: readonly PreparedStep[];
}

function manifestMap(manifests: readonly DomainPackageManifest[]): ReadonlyMap<string, DomainPackageManifest> {
  const map = new Map<string, DomainPackageManifest>();
  for (const manifest of manifests) {
    if (map.has(manifest.id)) {
      throw new RuntimeArchiveMigrationError(
        "duplicate-domain-package",
        `当前运行环境重复安装了领域包 ${manifest.id}。`,
        manifest.id,
      );
    }
    map.set(manifest.id, manifest);
  }
  return map;
}

export class RuntimeArchiveMigrator {
  readonly #registry: RuntimeMigrationRegistry;

  constructor(registry = new RuntimeMigrationRegistry()) {
    this.#registry = registry;
  }

  migrateArchive<Value extends RuntimeJsonValue>(
    runId: string,
    archive: RuntimeArchive<Value>,
    currentManifests: readonly DomainPackageManifest[],
  ): RuntimeArchive<Value> {
    const installed = manifestMap(currentManifests);
    const plans = this.#preparePlans(archive.packageVersions, installed);
    let value: RuntimeJsonValue = cloneRuntimeJson(archive.value);
    const packageVersions: Record<string, string> = { ...archive.packageVersions };
    for (const plan of plans) {
      value = this.#applySteps(runId, "snapshot", value, plan.steps);
      packageVersions[plan.packageId] = plan.targetVersion;
    }
    for (const manifest of currentManifests) {
      packageVersions[manifest.id] ??= manifest.dataVersion;
    }
    return Object.freeze({
      value: value as Value,
      packageVersions: Object.freeze(packageVersions),
    });
  }

  migrateEventPayload(
    event: RuntimeEventEnvelope,
    currentManifests: readonly DomainPackageManifest[],
  ): RuntimeJsonObject {
    if (!event.domainPackage) return cloneRuntimeJson(event.payload);
    const installed = manifestMap(currentManifests);
    const manifest = installed.get(event.domainPackage.id);
    if (!manifest) {
      throw new RuntimeArchiveMigrationError(
        "domain-package-not-installed",
        `事件 ${event.id} 依赖的领域包 ${event.domainPackage.id} 未安装。`,
        event.domainPackage.id,
      );
    }
    const plans = this.#preparePlans(
      { [event.domainPackage.id]: event.domainPackage.dataVersion },
      installed,
    );
    const plan = plans.find((candidate) => candidate.packageId === event.domainPackage?.id);
    if (!plan) return cloneRuntimeJson(event.payload);
    return this.#applySteps(
      event.runId,
      "event",
      cloneRuntimeJson(event.payload),
      plan.steps,
      event.type,
    ) as RuntimeJsonObject;
  }

  #preparePlans(
    savedVersions: RuntimeDomainPackageVersions,
    installed: ReadonlyMap<string, DomainPackageManifest>,
  ): readonly PreparedPackagePlan[] {
    for (const packageId of Object.keys(savedVersions)) {
      if (!installed.has(packageId)) {
        throw new RuntimeArchiveMigrationError(
          "domain-package-not-installed",
          `存档依赖的领域包 ${packageId} 未安装，拒绝丢弃该领域数据。`,
          packageId,
        );
      }
    }
    const plans: PreparedPackagePlan[] = [];
    for (const [packageId, savedVersion] of Object.entries(savedVersions).sort(([left], [right]) => left.localeCompare(right))) {
      const manifest = installed.get(packageId);
      if (!manifest) continue;
      const plan = planDomainPackageMigration(manifest, savedVersion);
      assertDomainPackageMigrationReady(plan);
      const steps = plan.steps.map((declaration) => Object.freeze({
        packageId,
        declaration,
        handler: this.#registry.require(packageId, declaration),
      }));
      plans.push(Object.freeze({
        packageId,
        targetVersion: manifest.dataVersion,
        steps: Object.freeze(steps),
      }));
    }
    return Object.freeze(plans);
  }

  #applySteps(
    runId: string,
    subject: RuntimeMigrationSubject,
    source: RuntimeJsonValue,
    steps: readonly PreparedStep[],
    eventType?: string,
  ): RuntimeJsonValue {
    let value = source;
    for (const step of steps) {
      try {
        value = cloneRuntimeJson(step.handler(cloneRuntimeJson(value), {
          subject,
          runId,
          packageId: step.packageId,
          migrationId: step.declaration.id,
          fromDataVersion: step.declaration.from,
          toDataVersion: step.declaration.to,
          ...(eventType ? { eventType } : {}),
        }));
      } catch (error) {
        if (error instanceof RuntimeArchiveMigrationError) throw error;
        throw new RuntimeArchiveMigrationError(
          "migration-handler-failed",
          `领域包 ${step.packageId} 的迁移 ${step.declaration.id} 执行失败：${error instanceof Error ? error.message : String(error)}`,
          step.packageId,
        );
      }
    }
    return value;
  }
}
