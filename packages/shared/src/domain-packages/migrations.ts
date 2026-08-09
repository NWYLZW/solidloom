import { DomainPackageContractError } from "./errors.js";
import type {
  DomainPackageManifest,
  DomainPackageMigrationDeclaration,
} from "./manifest.js";
import { compareSemanticVersions, parseSemanticVersion } from "./version.js";

export type DomainPackageMigrationPlanStatus =
  | "current"
  | "ready"
  | "planned"
  | "unavailable";

export interface DomainPackageMigrationPlan {
  readonly packageId: string;
  readonly from: string;
  readonly to: string;
  readonly status: DomainPackageMigrationPlanStatus;
  readonly steps: readonly DomainPackageMigrationDeclaration[];
  readonly reason?: string;
}

function findMigrationPath(
  migrations: readonly DomainPackageMigrationDeclaration[],
  from: string,
  to: string,
  availableOnly: boolean,
): readonly DomainPackageMigrationDeclaration[] | undefined {
  const queue: Array<{ version: string; steps: readonly DomainPackageMigrationDeclaration[] }> = [
    { version: from, steps: [] },
  ];
  const visited = new Set([from]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const outgoing = migrations
      .filter((migration) => migration.from === current.version)
      .filter((migration) => !availableOnly || migration.status === "available")
      .sort((left, right) => compareSemanticVersions(left.to, right.to));
    for (const migration of outgoing) {
      const steps = [...current.steps, migration];
      if (migration.to === to) return steps;
      if (visited.has(migration.to)) continue;
      visited.add(migration.to);
      queue.push({ version: migration.to, steps });
    }
  }
  return undefined;
}

function freezePlan(plan: DomainPackageMigrationPlan): DomainPackageMigrationPlan {
  return Object.freeze({ ...plan, steps: Object.freeze([...plan.steps]) });
}

export function planDomainPackageMigration(
  manifest: DomainPackageManifest,
  installedDataVersion: string,
): DomainPackageMigrationPlan {
  if (!parseSemanticVersion(installedDataVersion)) {
    return freezePlan({
      packageId: manifest.id,
      from: installedDataVersion,
      to: manifest.dataVersion,
      status: "unavailable",
      steps: [],
      reason: "存档中的领域数据版本不是有效的语义版本。",
    });
  }
  const comparison = compareSemanticVersions(installedDataVersion, manifest.dataVersion);
  if (comparison === 0) {
    return freezePlan({
      packageId: manifest.id,
      from: installedDataVersion,
      to: manifest.dataVersion,
      status: "current",
      steps: [],
    });
  }
  if (comparison > 0) {
    return freezePlan({
      packageId: manifest.id,
      from: installedDataVersion,
      to: manifest.dataVersion,
      status: "unavailable",
      steps: [],
      reason: "当前领域包不能静默降级较新的存档数据。",
    });
  }
  const readyPath = findMigrationPath(manifest.migrations, installedDataVersion, manifest.dataVersion, true);
  if (readyPath) {
    return freezePlan({
      packageId: manifest.id,
      from: installedDataVersion,
      to: manifest.dataVersion,
      status: "ready",
      steps: readyPath,
    });
  }
  const declaredPath = findMigrationPath(manifest.migrations, installedDataVersion, manifest.dataVersion, false);
  if (declaredPath) {
    return freezePlan({
      packageId: manifest.id,
      from: installedDataVersion,
      to: manifest.dataVersion,
      status: "planned",
      steps: declaredPath,
      reason: "迁移路径已经声明，但至少一个迁移入口仍为 planned。",
    });
  }
  return freezePlan({
    packageId: manifest.id,
    from: installedDataVersion,
    to: manifest.dataVersion,
    status: "unavailable",
    steps: [],
    reason: "没有从存档数据版本到当前领域数据版本的完整迁移路径。",
  });
}

export function assertDomainPackageMigrationReady(plan: DomainPackageMigrationPlan): void {
  if (plan.status === "current" || plan.status === "ready") return;
  throw new DomainPackageContractError(
    "migration-not-ready",
    `领域包 ${plan.packageId} 不能从 ${plan.from} 迁移到 ${plan.to}：${plan.reason ?? plan.status}`,
    { packageId: plan.packageId, details: { ...plan } },
  );
}
