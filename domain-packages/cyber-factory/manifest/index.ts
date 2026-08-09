import type {
  DomainPackageDefinitionCatalog,
  DomainPackageManifest,
  RuntimeDomainDefinitions,
} from "@solidloom/shared";
import {
  CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  cyberFactoryComponentTypes,
  cyberFactoryEntityTypes,
  cyberFactoryMetricTypes,
  cyberFactoryResourceTypes,
  cyberFactoryRuleSetIds,
} from "../entities/index.js";
import { cyberFactoryRelationTypes } from "../relations/index.js";
import {
  cyberFactoryAuthorizationProfile,
  type CyberFactoryAuthorizationProfile,
} from "./permissions.js";

export const cyberFactoryDefinitionCatalog = {
  entityTypes: cyberFactoryEntityTypes.map(({ id }) => id),
  componentTypes: cyberFactoryComponentTypes.map(({ id }) => id),
  relationTypes: cyberFactoryRelationTypes.map(({ id }) => id),
  resourceTypes: cyberFactoryResourceTypes.map(({ id }) => id),
  metricTypes: cyberFactoryMetricTypes.map(({ id }) => id),
  actionTypes: [],
  processTypes: [],
  ruleSets: [cyberFactoryRuleSetIds.defaultAuthorization],
  viewDefinitions: [],
} as const satisfies DomainPackageDefinitionCatalog;

export const cyberFactoryManifest = {
  schemaVersion: 1,
  id: CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  namespace: CYBER_FACTORY_DOMAIN_PACKAGE_ID,
  displayName: "赛博工厂",
  description: "由组织、人员、空间、资产、任务和生产单元组成的可选运营领域包。",
  version: "1.0.0",
  dataVersion: "1.0.0",
  status: "available",
  platformVersion: "^0.1.0",
  dependencies: [],
  extends: [],
  definitions: cyberFactoryDefinitionCatalog,
  migrations: [],
} as const satisfies DomainPackageManifest;

export const cyberFactoryRuntimeDefinitions = {
  schemaVersion: 1,
  revision: 1,
  entityTypes: cyberFactoryEntityTypes,
  componentTypes: cyberFactoryComponentTypes,
  relationTypes: cyberFactoryRelationTypes,
  resourceTypes: cyberFactoryResourceTypes,
  metricTypes: cyberFactoryMetricTypes,
  goalTypes: [],
} as const satisfies RuntimeDomainDefinitions;

export interface CyberFactoryDomainBundle {
  readonly manifest: DomainPackageManifest;
  readonly runtimeDefinitions: RuntimeDomainDefinitions;
  readonly authorization: CyberFactoryAuthorizationProfile;
}

export function createCyberFactoryDomainBundle(
  options: { readonly enabled?: boolean } = {},
): CyberFactoryDomainBundle | null {
  if (options.enabled === false) return null;
  return Object.freeze({
    manifest: cyberFactoryManifest,
    runtimeDefinitions: cyberFactoryRuntimeDefinitions,
    authorization: cyberFactoryAuthorizationProfile,
  });
}

export const cyberFactoryDomainBundle = createCyberFactoryDomainBundle()!;

export * from "./permissions.js";
