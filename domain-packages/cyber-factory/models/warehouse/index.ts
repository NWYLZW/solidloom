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
export const warehouseStackerCraneModule = defineAssetModelModule("planned", warehouseStackerCraneDefinition);
export const warehouseAssetModules = warehouseAssetDefinitions.map((definition) => defineAssetModelModule(
  definition.manifest.id === warehouseStackerCraneDefinition.manifest.id ? "planned" : "available",
  definition,
));
