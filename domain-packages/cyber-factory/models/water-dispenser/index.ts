import { defineAssetModelModule } from "@solidloom/shared";
import { waterDispenserAssetDefinition } from "./asset.js";

export * from "./asset.js";
export * from "./manifest.js";
export * from "./model.js";
export * from "./types.js";

export const waterDispenserModule = defineAssetModelModule("available", waterDispenserAssetDefinition);
