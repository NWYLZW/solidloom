import { defineAssetModelModule } from "@solidloom/shared";
import { restroomAssetDefinitions } from "./asset.js";

export * from "./asset.js";
export * from "./manifest.js";
export * from "./model.js";
export * from "./types.js";

// 独立资产与预览已经完成；正式语义运行时注册由公共集成任务负责。
export const restroomAssetModules = restroomAssetDefinitions.map((definition) => (
  defineAssetModelModule("planned", definition)
));
