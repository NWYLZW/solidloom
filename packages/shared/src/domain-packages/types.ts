import type { CapabilityDefinition } from "../types.js";
import type { ModelModule } from "../models/registry.js";
import type { DomainPackageManifest } from "./manifest.js";

export type {
  DomainPackageDefinitionCatalog,
  DomainPackageDefinitionKind,
  DomainPackageDependency,
  DomainPackageManifest,
  DomainPackageMigrationDeclaration,
  DomainPackageStatus,
} from "./manifest.js";

export type UiExtensionSlot = "hud" | "manage";

export interface UiExtensionDescriptor {
  id: string;
  slot: UiExtensionSlot;
  status: "available" | "planned";
  moduleId: string;
  order?: number;
}

export interface DomainPackageDefinition {
  readonly id: string;
  readonly manifest: DomainPackageManifest;
  readonly models: readonly ModelModule[];
  readonly capabilities: readonly CapabilityDefinition[];
  readonly uiExtensions: readonly UiExtensionDescriptor[];
}
