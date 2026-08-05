import type { CapabilityDefinition } from "../types.js";
import type { ModelModule } from "../models/registry.js";

export type UiExtensionSlot = "hud" | "manage";

export interface UiExtensionDescriptor {
  id: string;
  slot: UiExtensionSlot;
  status: "available" | "planned";
  moduleId: string;
  order?: number;
}

export interface DomainPackageManifest {
  id: string;
  displayName: string;
  description: string;
  version: string;
  status: "available" | "planned";
}

export interface DomainPackageDefinition {
  id: string;
  manifest: DomainPackageManifest;
  models: ModelModule[];
  capabilities: CapabilityDefinition[];
  uiExtensions: UiExtensionDescriptor[];
}
