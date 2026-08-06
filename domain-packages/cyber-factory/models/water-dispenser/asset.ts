import {
  assertModelAssetDefinition,
  type ModelAssetDefinition,
} from "@solidloom/shared";
import { createWaterDispenserManifest } from "./manifest.js";
import {
  createWaterDispenserModel,
  resolveWaterDispenserParameters,
} from "./model.js";
import type { WaterDispenserParameters } from "./types.js";

export function createWaterDispenserAssetDefinition(
  partialParameters: Partial<WaterDispenserParameters> = {},
): ModelAssetDefinition {
  const parameters = resolveWaterDispenserParameters(partialParameters);
  return assertModelAssetDefinition({
    manifest: createWaterDispenserManifest(parameters),
    createModel: () => createWaterDispenserModel(parameters),
  });
}

export const waterDispenserAssetDefinition = createWaterDispenserAssetDefinition();
