import { defineAssetModelModule } from "@solidloom/shared";
import {
  blockAvatarDefinition,
  officeChairDefinition,
  officeDeskDefinition,
  officeLaptopDefinition,
  officeMonitorDefinition,
  officeTowerDefinition,
} from "./manifest.js";

export * from "./manifest.js";
export * from "./model.js";
export * from "./performance.js";
export * from "./types.js";

export const officeDeskModule = defineAssetModelModule("planned", officeDeskDefinition);
export const officeChairModule = defineAssetModelModule("planned", officeChairDefinition);
export const officeLaptopModule = defineAssetModelModule("planned", officeLaptopDefinition);
export const officeMonitorModule = defineAssetModelModule("planned", officeMonitorDefinition);
export const officeTowerModule = defineAssetModelModule("planned", officeTowerDefinition);
export const blockAvatarModule = defineAssetModelModule("planned", blockAvatarDefinition);

export const officeAssetModules = [
  officeDeskModule,
  officeChairModule,
  officeLaptopModule,
  officeMonitorModule,
  officeTowerModule,
  blockAvatarModule,
] as const;
