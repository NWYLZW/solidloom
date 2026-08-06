import type { CapabilityDefinition } from "../types.js";
import {
  createRegistrationRegistry,
  type RegistrationRegistry,
} from "../registry/index.js";
import { createModelModuleRegistry, type ModelModule } from "../models/registry.js";
import type {
  DomainPackageDefinition,
  DomainPackageManifest,
  UiExtensionDescriptor,
} from "./types.js";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function defineDomainPackage(
  manifest: DomainPackageManifest,
  contributions: Omit<DomainPackageDefinition, "id" | "manifest">,
): DomainPackageDefinition {
  if (!SEMVER_PATTERN.test(manifest.version)) {
    throw new Error(`领域包 ${manifest.id} 必须使用 semver 版本。`);
  }
  createModelModuleRegistry(contributions.models);
  createRegistrationRegistry("领域包能力", contributions.capabilities);
  createRegistrationRegistry("领域包界面扩展", contributions.uiExtensions);
  return Object.freeze({
    id: manifest.id,
    manifest,
    models: [...contributions.models],
    capabilities: [...contributions.capabilities],
    uiExtensions: [...contributions.uiExtensions],
  });
}

export interface DomainPackageRegistry {
  packages: RegistrationRegistry<DomainPackageDefinition>;
  models: RegistrationRegistry<ModelModule>;
  capabilities: RegistrationRegistry<CapabilityDefinition>;
  uiExtensions: RegistrationRegistry<UiExtensionDescriptor>;
}

export function createDomainPackageRegistry(
  packages: Iterable<DomainPackageDefinition>,
): DomainPackageRegistry {
  const values = [...packages];
  return Object.freeze({
    packages: createRegistrationRegistry("领域包注册表", values),
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
