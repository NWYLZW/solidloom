import type { CapabilityDefinition } from "../types.js";
import {
  createRegistrationRegistry,
  type RegistrationRegistry,
} from "../registry/index.js";
import { createModelModuleRegistry, type ModelModule } from "../models/registry.js";
import { DomainPackageContractError, DomainPackageManifestValidationError } from "./errors.js";
import {
  assertDomainPackageManifest,
  DOMAIN_PACKAGE_DEFINITION_KINDS,
  freezeDomainPackageManifest,
  type DomainPackageDefinitionKind,
  type DomainPackageManifest,
} from "./manifest.js";
import { satisfiesVersionRange } from "./version.js";
import type {
  DomainPackageDefinition,
  UiExtensionDescriptor,
} from "./types.js";

export const SOLIDLOOM_DOMAIN_PLATFORM_VERSION = "0.1.0";

export interface DomainTypeDeclaration {
  readonly id: string;
  readonly packageId: string;
  readonly kind: DomainPackageDefinitionKind;
}

export function defineDomainPackage(
  manifestInput: DomainPackageManifest,
  contributions: Omit<DomainPackageDefinition, "id" | "manifest">,
): DomainPackageDefinition {
  assertDomainPackageManifest(manifestInput);
  const manifest = freezeDomainPackageManifest(manifestInput);
  createModelModuleRegistry(contributions.models);
  createRegistrationRegistry("领域包能力", contributions.capabilities);
  createRegistrationRegistry("领域包界面扩展", contributions.uiExtensions);
  if (manifest.status === "planned") {
    const availableIds = [
      ...contributions.models,
      ...contributions.capabilities,
      ...contributions.uiExtensions,
    ].filter((contribution) => contribution.status === "available").map((contribution) => contribution.id);
    if (availableIds.length > 0) {
      throw new DomainPackageManifestValidationError(manifest.id, [
        `planned 领域包不能包含 available 贡献：${availableIds.join("、")}`,
      ]);
    }
  }
  return Object.freeze({
    id: manifest.id,
    manifest,
    models: Object.freeze([...contributions.models]),
    capabilities: Object.freeze([...contributions.capabilities]),
    uiExtensions: Object.freeze([...contributions.uiExtensions]),
  });
}

export interface DomainPackageRegistry {
  readonly platformVersion: string;
  readonly packages: RegistrationRegistry<DomainPackageDefinition>;
  readonly declarations: RegistrationRegistry<DomainTypeDeclaration>;
  readonly models: RegistrationRegistry<ModelModule>;
  readonly capabilities: RegistrationRegistry<CapabilityDefinition>;
  readonly uiExtensions: RegistrationRegistry<UiExtensionDescriptor>;
}

export interface DomainPackageRegistryOptions {
  readonly platformVersion?: string;
}

function assertUniqueNamespaces(packages: readonly DomainPackageDefinition[]): void {
  const owners = new Map<string, string>();
  for (const domainPackage of packages) {
    const existing = owners.get(domainPackage.manifest.namespace);
    if (existing) {
      throw new DomainPackageContractError(
        "namespace-conflict",
        `领域包 ${domainPackage.id} 与 ${existing} 使用了相同命名空间 ${domainPackage.manifest.namespace}。`,
        {
          packageId: domainPackage.id,
          details: { namespace: domainPackage.manifest.namespace, existingPackageId: existing },
        },
      );
    }
    owners.set(domainPackage.manifest.namespace, domainPackage.id);
  }
}

function assertPlatformCompatibility(
  packages: readonly DomainPackageDefinition[],
  platformVersion: string,
): void {
  for (const domainPackage of packages) {
    if (satisfiesVersionRange(platformVersion, domainPackage.manifest.platformVersion)) continue;
    throw new DomainPackageContractError(
      "platform-incompatible",
      `领域包 ${domainPackage.id}@${domainPackage.manifest.version} 不兼容 SolidLoom ${platformVersion}；要求 ${domainPackage.manifest.platformVersion}。`,
      {
        packageId: domainPackage.id,
        details: { platformVersion, requiredVersion: domainPackage.manifest.platformVersion },
      },
    );
  }
}

function assertDependencies(
  packages: RegistrationRegistry<DomainPackageDefinition>,
): void {
  for (const domainPackage of packages.list()) {
    for (const dependency of domainPackage.manifest.dependencies) {
      const installed = packages.get(dependency.id);
      if (!installed && dependency.optional) continue;
      if (!installed) {
        throw new DomainPackageContractError(
          "dependency-missing",
          `领域包 ${domainPackage.id} 缺少依赖 ${dependency.id}@${dependency.version}。`,
          { packageId: domainPackage.id, details: { dependency } },
        );
      }
      if (!satisfiesVersionRange(installed.manifest.version, dependency.version)) {
        throw new DomainPackageContractError(
          "dependency-incompatible",
          `领域包 ${domainPackage.id} 要求 ${dependency.id}@${dependency.version}，当前为 ${installed.manifest.version}。`,
          {
            packageId: domainPackage.id,
            details: { dependency, installedVersion: installed.manifest.version },
          },
        );
      }
    }
    for (const extendedPackageId of domainPackage.manifest.extends) {
      const installed = packages.get(extendedPackageId);
      if (!installed) {
        throw new DomainPackageContractError(
          "extension-missing",
          `领域包 ${domainPackage.id} 声明扩展 ${extendedPackageId}，但该领域包未安装。`,
          { packageId: domainPackage.id, details: { extendedPackageId } },
        );
      }
      if (!domainPackage.manifest.dependencies.some((dependency) => dependency.id === extendedPackageId)) {
        throw new DomainPackageContractError(
          "extension-missing",
          `领域包 ${domainPackage.id} 必须为扩展目标 ${extendedPackageId} 声明版本依赖。`,
          { packageId: domainPackage.id, details: { extendedPackageId } },
        );
      }
    }
  }
}

function assertNoDependencyCycles(packages: RegistrationRegistry<DomainPackageDefinition>): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (packageId: string, path: readonly string[]): void => {
    if (visited.has(packageId)) return;
    if (visiting.has(packageId)) {
      const cycleStart = path.indexOf(packageId);
      const cycle = [...path.slice(cycleStart), packageId];
      throw new DomainPackageContractError(
        "dependency-cycle",
        `领域包依赖形成循环：${cycle.join(" → ")}`,
        { packageId, details: { cycle } },
      );
    }
    visiting.add(packageId);
    const domainPackage = packages.get(packageId);
    for (const dependency of domainPackage?.manifest.dependencies ?? []) {
      if (packages.has(dependency.id)) visit(dependency.id, [...path, packageId]);
    }
    visiting.delete(packageId);
    visited.add(packageId);
  };
  packages.ids().forEach((packageId) => visit(packageId, []));
}

function collectDeclarations(
  packages: readonly DomainPackageDefinition[],
): readonly DomainTypeDeclaration[] {
  const declarations: DomainTypeDeclaration[] = [];
  const owners = new Map<string, DomainTypeDeclaration>();
  for (const domainPackage of packages) {
    for (const kind of DOMAIN_PACKAGE_DEFINITION_KINDS) {
      for (const id of domainPackage.manifest.definitions[kind]) {
        const declaration = Object.freeze({ id, packageId: domainPackage.id, kind });
        const existing = owners.get(id);
        if (existing) {
          throw new DomainPackageContractError(
            "definition-conflict",
            `领域定义 ${id} 同时由 ${existing.packageId} 和 ${domainPackage.id} 声明。`,
            { packageId: domainPackage.id, details: { declaration, existing } },
          );
        }
        owners.set(id, declaration);
        declarations.push(declaration);
      }
    }
  }
  return declarations;
}

export function createDomainPackageRegistry(
  packagesInput: Iterable<DomainPackageDefinition>,
  options: DomainPackageRegistryOptions = {},
): DomainPackageRegistry {
  const values = [...packagesInput];
  const platformVersion = options.platformVersion ?? SOLIDLOOM_DOMAIN_PLATFORM_VERSION;
  const packages = createRegistrationRegistry("领域包注册表", values);
  assertUniqueNamespaces(values);
  assertPlatformCompatibility(values, platformVersion);
  assertDependencies(packages);
  assertNoDependencyCycles(packages);
  const declarations = collectDeclarations(values);
  return Object.freeze({
    platformVersion,
    packages,
    declarations: createRegistrationRegistry("领域定义注册表", declarations),
    models: createModelModuleRegistry(values.flatMap((domainPackage) => domainPackage.models)),
    capabilities: createRegistrationRegistry(
      "领域能力注册表",
      values.flatMap((domainPackage) => domainPackage.capabilities),
    ),
    uiExtensions: createRegistrationRegistry(
      "界面扩展注册表",
      values.flatMap((domainPackage) => domainPackage.uiExtensions),
    ),
  });
}

export function assembleCapabilities(
  coreCapabilities: Iterable<CapabilityDefinition>,
  domainRegistry: DomainPackageRegistry,
) {
  return createRegistrationRegistry("能力注册表", [
    ...coreCapabilities,
    ...domainRegistry.capabilities.list(),
  ]).list();
}
