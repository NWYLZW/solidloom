import { defineAssetModelModule } from "@solidloom/shared";
import {
  warehouseAssetDefinitions,
  warehouseCartDefinition,
  warehousePalletDefinition,
  warehouseRackDefinition,
  warehouseStackerCraneDefinition,
  warehouseToteDefinition,
} from "./manifest.js";

export * from "./manifest.js";
export * from "./model.js";

export const warehouseRackModule = defineAssetModelModule("available", warehouseRackDefinition);
export const warehousePalletModule = defineAssetModelModule("available", warehousePalletDefinition);
export const warehouseToteModule = defineAssetModelModule("available", warehouseToteDefinition);
export const warehouseCartModule = defineAssetModelModule("available", warehouseCartDefinition);
// 堆垛机只保留为货架内部生成器和兼容预览，不再作为业务侧独立资产注册。
// 这样场景不会分别摆放货架与堆垛机，也就不会重复计算二者的朝向和偏移。
export const warehouseStackerCraneModule = defineAssetModelModule("planned", warehouseStackerCraneDefinition);
export const warehouseAssetModules = warehouseAssetDefinitions.map((definition) => defineAssetModelModule(
  definition.manifest.id === warehouseStackerCraneDefinition.manifest.id ? "planned" : "available",
  definition,
));
