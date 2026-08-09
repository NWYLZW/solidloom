import { DomainPackageManifestValidationError } from "./errors.js";
import {
  compareSemanticVersions,
  isValidVersionRange,
  parseSemanticVersion,
  SEMANTIC_VERSION_PATTERN,
} from "./version.js";

export const DOMAIN_PACKAGE_MANIFEST_SCHEMA_VERSION = 1 as const;
export const DOMAIN_PACKAGE_STATUSES = ["available", "planned"] as const;
export const DOMAIN_PACKAGE_DEFINITION_KINDS = [
  "entityTypes",
  "componentTypes",
  "relationTypes",
  "resourceTypes",
  "metricTypes",
  "actionTypes",
  "processTypes",
  "ruleSets",
  "viewDefinitions",
] as const;

export type DomainPackageStatus = (typeof DOMAIN_PACKAGE_STATUSES)[number];
export type DomainPackageDefinitionKind = (typeof DOMAIN_PACKAGE_DEFINITION_KINDS)[number];

export interface DomainPackageDependency {
  readonly id: string;
  readonly version: string;
  readonly optional?: boolean;
}

export interface DomainPackageMigrationDeclaration {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly entry: string;
  readonly status: DomainPackageStatus;
}

export type DomainPackageDefinitionCatalog = {
  readonly [Kind in DomainPackageDefinitionKind]: readonly string[];
};

export interface DomainPackageManifest {
  readonly schemaVersion: typeof DOMAIN_PACKAGE_MANIFEST_SCHEMA_VERSION;
  readonly id: string;
  readonly namespace: string;
  readonly displayName: string;
  readonly description: string;
  readonly version: string;
  readonly dataVersion: string;
  readonly status: DomainPackageStatus;
  readonly platformVersion: string;
  readonly dependencies: readonly DomainPackageDependency[];
  readonly extends: readonly string[];
  readonly definitions: DomainPackageDefinitionCatalog;
  readonly migrations: readonly DomainPackageMigrationDeclaration[];
}

const PACKAGE_ID_PATTERN_SOURCE = "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$";
const DEFINITION_ID_PATTERN_SOURCE =
  "^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\\.[a-z][a-z0-9-]*)+$";
const MIGRATION_ENTRY_PATTERN_SOURCE = "^\\./[A-Za-z0-9._/-]+\\.js$";

export const DOMAIN_PACKAGE_ID_PATTERN = new RegExp(PACKAGE_ID_PATTERN_SOURCE);
export const DOMAIN_PACKAGE_DEFINITION_ID_PATTERN = new RegExp(DEFINITION_ID_PATTERN_SOURCE);
export const DOMAIN_PACKAGE_MIGRATION_ENTRY_PATTERN = new RegExp(MIGRATION_ENTRY_PATTERN_SOURCE);

const identifierArraySchema = {
  type: "array",
  items: { type: "string", pattern: DEFINITION_ID_PATTERN_SOURCE },
  uniqueItems: true,
} as const;

export const domainPackageManifestSchema = {
  $id: "https://solidloom.local/schemas/domain-package-manifest-v1.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SolidLoom 领域包 manifest",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "id",
    "namespace",
    "displayName",
    "description",
    "version",
    "dataVersion",
    "status",
    "platformVersion",
    "dependencies",
    "extends",
    "definitions",
    "migrations",
  ],
  properties: {
    schemaVersion: { const: DOMAIN_PACKAGE_MANIFEST_SCHEMA_VERSION },
    id: { type: "string", pattern: PACKAGE_ID_PATTERN_SOURCE },
    namespace: { type: "string", pattern: PACKAGE_ID_PATTERN_SOURCE },
    displayName: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: "string", minLength: 1, maxLength: 500 },
    version: { type: "string", pattern: SEMANTIC_VERSION_PATTERN.source },
    dataVersion: { type: "string", pattern: SEMANTIC_VERSION_PATTERN.source },
    status: { enum: DOMAIN_PACKAGE_STATUSES },
    platformVersion: { type: "string", minLength: 1, maxLength: 120 },
    dependencies: {
      type: "array",
      uniqueItems: true,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "version"],
        properties: {
          id: { type: "string", pattern: PACKAGE_ID_PATTERN_SOURCE },
          version: { type: "string", minLength: 1, maxLength: 120 },
          optional: { type: "boolean" },
        },
      },
    },
    extends: {
      type: "array",
      uniqueItems: true,
      items: { type: "string", pattern: PACKAGE_ID_PATTERN_SOURCE },
    },
    definitions: {
      type: "object",
      additionalProperties: false,
      required: DOMAIN_PACKAGE_DEFINITION_KINDS,
      properties: {
        entityTypes: identifierArraySchema,
        componentTypes: identifierArraySchema,
        relationTypes: identifierArraySchema,
        resourceTypes: identifierArraySchema,
        metricTypes: identifierArraySchema,
        actionTypes: identifierArraySchema,
        processTypes: identifierArraySchema,
        ruleSets: identifierArraySchema,
        viewDefinitions: identifierArraySchema,
      },
    },
    migrations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "from", "to", "entry", "status"],
        properties: {
          id: { type: "string", pattern: DEFINITION_ID_PATTERN_SOURCE },
          from: { type: "string", pattern: SEMANTIC_VERSION_PATTERN.source },
          to: { type: "string", pattern: SEMANTIC_VERSION_PATTERN.source },
          entry: { type: "string", pattern: MIGRATION_ENTRY_PATTERN_SOURCE },
          status: { enum: DOMAIN_PACKAGE_STATUSES },
        },
      },
    },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  issues: string[],
): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issues.push(`${path}.${key} 不是受支持的字段`);
  }
}

function validateString(
  value: unknown,
  path: string,
  issues: string[],
  options: { pattern?: RegExp; maxLength?: number } = {},
): value is string {
  if (typeof value !== "string" || value.length === 0) {
    issues.push(`${path} 必须是非空字符串`);
    return false;
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    issues.push(`${path} 长度不能超过 ${options.maxLength}`);
  }
  if (options.pattern && !options.pattern.test(value)) issues.push(`${path} 格式无效`);
  return true;
}

function validateStringArray(
  value: unknown,
  path: string,
  issues: string[],
  itemPattern: RegExp,
): value is string[] {
  if (!Array.isArray(value)) {
    issues.push(`${path} 必须是数组`);
    return false;
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!validateString(item, `${path}[${index}]`, issues, { pattern: itemPattern })) return;
    if (seen.has(item)) issues.push(`${path} 存在重复 ID：${item}`);
    seen.add(item);
  });
  return true;
}

function validateDefinitions(
  value: unknown,
  namespace: string | undefined,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push("manifest.definitions 必须是对象");
    return;
  }
  hasOnlyKeys(value, DOMAIN_PACKAGE_DEFINITION_KINDS, "manifest.definitions", issues);
  const allIds = new Map<string, string>();
  for (const kind of DOMAIN_PACKAGE_DEFINITION_KINDS) {
    const path = `manifest.definitions.${kind}`;
    if (!validateStringArray(value[kind], path, issues, DOMAIN_PACKAGE_DEFINITION_ID_PATTERN)) continue;
    for (const id of value[kind] as string[]) {
      if (namespace && !id.startsWith(`${namespace}.`)) {
        issues.push(`${path} 中的 ${id} 必须位于 ${namespace}. 命名空间`);
      }
      const existingKind = allIds.get(id);
      if (existingKind) issues.push(`${id} 同时声明于 ${existingKind} 和 ${kind}`);
      allIds.set(id, kind);
    }
  }
}

function validateDependencies(value: unknown, packageId: string | undefined, issues: string[]): void {
  if (!Array.isArray(value)) {
    issues.push("manifest.dependencies 必须是数组");
    return;
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const path = `manifest.dependencies[${index}]`;
    if (!isRecord(item)) {
      issues.push(`${path} 必须是对象`);
      return;
    }
    hasOnlyKeys(item, ["id", "version", "optional"], path, issues);
    const hasId = validateString(item.id, `${path}.id`, issues, { pattern: DOMAIN_PACKAGE_ID_PATTERN });
    if (validateString(item.version, `${path}.version`, issues) && !isValidVersionRange(item.version)) {
      issues.push(`${path}.version 不是支持的版本范围`);
    }
    if (item.optional !== undefined && typeof item.optional !== "boolean") {
      issues.push(`${path}.optional 必须是布尔值`);
    }
    if (hasId) {
      const dependencyId = item.id as string;
      if (dependencyId === packageId) issues.push(`${path}.id 不能依赖自身`);
      if (seen.has(dependencyId)) issues.push(`manifest.dependencies 存在重复依赖：${dependencyId}`);
      seen.add(dependencyId);
    }
  });
}

function validateMigrations(
  value: unknown,
  namespace: string | undefined,
  dataVersion: string | undefined,
  issues: string[],
): void {
  if (!Array.isArray(value)) {
    issues.push("manifest.migrations 必须是数组");
    return;
  }
  const ids = new Set<string>();
  const edges = new Set<string>();
  value.forEach((item, index) => {
    const path = `manifest.migrations[${index}]`;
    if (!isRecord(item)) {
      issues.push(`${path} 必须是对象`);
      return;
    }
    hasOnlyKeys(item, ["id", "from", "to", "entry", "status"], path, issues);
    const hasId = validateString(item.id, `${path}.id`, issues, {
      pattern: DOMAIN_PACKAGE_DEFINITION_ID_PATTERN,
    });
    const hasFrom = validateString(item.from, `${path}.from`, issues) && Boolean(parseSemanticVersion(item.from));
    const hasTo = validateString(item.to, `${path}.to`, issues) && Boolean(parseSemanticVersion(item.to));
    if (hasId) {
      const migrationId = item.id as string;
      if (namespace && !migrationId.startsWith(`${namespace}.`)) {
        issues.push(`${path}.id 必须位于 ${namespace}. 命名空间`);
      }
      if (ids.has(migrationId)) issues.push(`manifest.migrations 存在重复 ID：${migrationId}`);
      ids.add(migrationId);
    }
    if (hasFrom && hasTo) {
      if (compareSemanticVersions(item.from as string, item.to as string) >= 0) {
        issues.push(`${path} 必须从较低版本迁移到较高版本`);
      }
      if (dataVersion && compareSemanticVersions(item.to as string, dataVersion) > 0) {
        issues.push(`${path}.to 不能高于 manifest.dataVersion`);
      }
      const edge = `${item.from}->${item.to}`;
      if (edges.has(edge)) issues.push(`manifest.migrations 存在重复迁移边：${edge}`);
      edges.add(edge);
    } else {
      if (typeof item.from === "string" && !parseSemanticVersion(item.from)) {
        issues.push(`${path}.from 必须使用语义版本`);
      }
      if (typeof item.to === "string" && !parseSemanticVersion(item.to)) {
        issues.push(`${path}.to 必须使用语义版本`);
      }
    }
    if (!validateString(item.entry, `${path}.entry`, issues, {
      pattern: DOMAIN_PACKAGE_MIGRATION_ENTRY_PATTERN,
    }) || (typeof item.entry === "string" && item.entry.includes(".."))) {
      if (typeof item.entry === "string" && item.entry.includes("..")) {
        issues.push(`${path}.entry 不能越过领域包目录`);
      }
    }
    if (!DOMAIN_PACKAGE_STATUSES.includes(item.status as DomainPackageStatus)) {
      issues.push(`${path}.status 必须是 available 或 planned`);
    }
  });
}

export function validateDomainPackageManifest(value: unknown): readonly string[] {
  const issues: string[] = [];
  if (!isRecord(value)) return Object.freeze(["manifest 必须是对象"]);
  hasOnlyKeys(value, domainPackageManifestSchema.required, "manifest", issues);
  if (value.schemaVersion !== DOMAIN_PACKAGE_MANIFEST_SCHEMA_VERSION) {
    issues.push(`manifest.schemaVersion 必须是 ${DOMAIN_PACKAGE_MANIFEST_SCHEMA_VERSION}`);
  }
  const hasId = validateString(value.id, "manifest.id", issues, { pattern: DOMAIN_PACKAGE_ID_PATTERN });
  const hasNamespace = validateString(value.namespace, "manifest.namespace", issues, {
    pattern: DOMAIN_PACKAGE_ID_PATTERN,
  });
  validateString(value.displayName, "manifest.displayName", issues, { maxLength: 120 });
  validateString(value.description, "manifest.description", issues, { maxLength: 500 });
  if (!validateString(value.version, "manifest.version", issues) || !parseSemanticVersion(value.version)) {
    if (typeof value.version === "string") issues.push("manifest.version 必须使用语义版本");
  }
  const dataVersionValid = validateString(value.dataVersion, "manifest.dataVersion", issues)
    && Boolean(parseSemanticVersion(value.dataVersion));
  if (typeof value.dataVersion === "string" && !parseSemanticVersion(value.dataVersion)) {
    issues.push("manifest.dataVersion 必须使用语义版本");
  }
  if (!DOMAIN_PACKAGE_STATUSES.includes(value.status as DomainPackageStatus)) {
    issues.push("manifest.status 必须是 available 或 planned");
  }
  if (validateString(value.platformVersion, "manifest.platformVersion", issues)
    && !isValidVersionRange(value.platformVersion)) {
    issues.push("manifest.platformVersion 不是支持的版本范围");
  }
  validateDependencies(value.dependencies, hasId ? value.id as string : undefined, issues);
  const extensionsValid = validateStringArray(
    value.extends,
    "manifest.extends",
    issues,
    DOMAIN_PACKAGE_ID_PATTERN,
  );
  if (extensionsValid) {
    for (const extensionId of value.extends as string[]) {
      if (extensionId === value.id) issues.push("manifest.extends 不能包含自身");
    }
  }
  validateDefinitions(value.definitions, hasNamespace ? value.namespace as string : undefined, issues);
  validateMigrations(
    value.migrations,
    hasNamespace ? value.namespace as string : undefined,
    dataVersionValid ? value.dataVersion as string : undefined,
    issues,
  );
  return Object.freeze(issues);
}

export function assertDomainPackageManifest(value: unknown): asserts value is DomainPackageManifest {
  const issues = validateDomainPackageManifest(value);
  if (issues.length > 0) {
    const packageId = isRecord(value) && typeof value.id === "string" ? value.id : undefined;
    throw new DomainPackageManifestValidationError(packageId, issues);
  }
}

export function freezeDomainPackageManifest(manifest: DomainPackageManifest): DomainPackageManifest {
  const definitions = Object.fromEntries(
    DOMAIN_PACKAGE_DEFINITION_KINDS.map((kind) => [kind, Object.freeze([...manifest.definitions[kind]])]),
  ) as DomainPackageDefinitionCatalog;
  return Object.freeze({
    ...manifest,
    dependencies: Object.freeze(manifest.dependencies.map((dependency) => Object.freeze({ ...dependency }))),
    extends: Object.freeze([...manifest.extends]),
    definitions: Object.freeze(definitions),
    migrations: Object.freeze(manifest.migrations.map((migration) => Object.freeze({ ...migration }))),
  });
}
