import { defineAssetModelModule } from "@solidloom/shared";
import {
  warehouseAssetDefinitions,
  warehouseCartDefinition,
  warehousePalletDefinition,
  warehouseRackDefinition,
  warehouseToteDefinition,
} from "./manifest.js";

export * from "./manifest.js";
export * from "./model.js";

export const warehouseRackModule = defineAssetModelModule("planned", warehouseRackDefinition);
export const warehousePalletModule = defineAssetModelModule("planned", warehousePalletDefinition);
export const warehouseToteModule = defineAssetModelModule("planned", warehouseToteDefinition);
export const warehouseCartModule = defineAssetModelModule("planned", warehouseCartDefinition);
export const warehouseAssetModules = warehouseAssetDefinitions.map((definition) => (
  defineAssetModelModule("planned", definition)
));
