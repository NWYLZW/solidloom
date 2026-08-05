import type { CreateModelInput } from "../types.js";
import { createRegistrationRegistry, type RegistrationRegistry } from "../registry/index.js";
import type { ModelAssetDefinition } from "./types.js";
import { assertModelAssetDefinition } from "./validation.js";

export interface FactoryModelModule {
  id: string;
  source: "factory";
  status: "available" | "planned";
  createModel: () => CreateModelInput;
}

export interface AssetModelModule {
  id: string;
  source: "asset";
  status: "available" | "planned";
  definition: ModelAssetDefinition;
  createModel: () => CreateModelInput;
}

export type ModelModule = AssetModelModule | FactoryModelModule;

export function defineFactoryModelModule(module: Omit<FactoryModelModule, "source">): FactoryModelModule {
  return Object.freeze({ ...module, source: "factory" });
}

export function defineAssetModelModule(
  status: AssetModelModule["status"],
  definition: ModelAssetDefinition,
): AssetModelModule {
  assertModelAssetDefinition(definition);
  if (definition.manifest.id.length === 0) throw new Error("模型资产 ID 不能为空。");
  return Object.freeze({
    id: definition.manifest.id,
    source: "asset",
    status,
    definition,
    createModel: definition.createModel,
  });
}

export function createModelModuleRegistry(
  modules: Iterable<ModelModule>,
): RegistrationRegistry<ModelModule> {
  return createRegistrationRegistry("模型注册表", modules);
}

export function instantiateModelModules(modules: Iterable<ModelModule>) {
  return [...modules].map((module) => module.createModel());
}
