import {
  assertModelAssetDefinition,
  type ModelAssetDefinition,
} from "@solidloom/shared";
import {
  restroomAccessibleDoorDefinition,
  restroomAccessibleVanityDefinition,
  restroomAccessibilitySupportDefinition,
} from "./accessible.js";
import {
  createRestroomMirrorManifest,
  createRestroomPartitionManifest,
  createRestroomStallDoorManifest,
  createRestroomToiletManifest,
  createRestroomUrinalBankManifest,
  createRestroomVanityManifest,
} from "./manifest.js";
import {
  createRestroomMirrorModel,
  createRestroomPartitionModel,
  createRestroomStallDoorModel,
  createRestroomToiletModel,
  createRestroomUrinalBankModel,
  createRestroomVanityModel,
  normalizeRestroomMirrorParameters,
  normalizeRestroomPartitionParameters,
  normalizeRestroomStallDoorParameters,
  normalizeRestroomToiletParameters,
  normalizeRestroomUrinalBankParameters,
  normalizeRestroomVanityParameters,
} from "./model.js";
import type {
  RestroomMirrorParameters,
  RestroomPartitionParameters,
  RestroomStallDoorParameters,
  RestroomToiletParameters,
  RestroomUrinalBankParameters,
  RestroomVanityParameters,
} from "./types.js";

export function createRestroomPartitionDefinition(
  input: Partial<RestroomPartitionParameters> = {},
): ModelAssetDefinition {
  const parameters = normalizeRestroomPartitionParameters(input);
  return assertModelAssetDefinition({
    manifest: createRestroomPartitionManifest(parameters),
    createModel: () => createRestroomPartitionModel(parameters),
  });
}

export function createRestroomStallDoorDefinition(
  input: Partial<RestroomStallDoorParameters> = {},
): ModelAssetDefinition {
  const parameters = normalizeRestroomStallDoorParameters(input);
  return assertModelAssetDefinition({
    manifest: createRestroomStallDoorManifest(parameters),
    createModel: () => createRestroomStallDoorModel(parameters),
  });
}

export function createRestroomToiletDefinition(
  input: Partial<RestroomToiletParameters> = {},
): ModelAssetDefinition {
  const parameters = normalizeRestroomToiletParameters(input);
  return assertModelAssetDefinition({
    manifest: createRestroomToiletManifest(parameters),
    createModel: () => createRestroomToiletModel(parameters),
  });
}

export function createRestroomUrinalBankDefinition(
  input: Partial<RestroomUrinalBankParameters> = {},
): ModelAssetDefinition {
  const parameters = normalizeRestroomUrinalBankParameters(input);
  return assertModelAssetDefinition({
    manifest: createRestroomUrinalBankManifest(parameters),
    createModel: () => createRestroomUrinalBankModel(parameters),
  });
}

export function createRestroomVanityDefinition(
  input: Partial<RestroomVanityParameters> = {},
): ModelAssetDefinition {
  const parameters = normalizeRestroomVanityParameters(input);
  return assertModelAssetDefinition({
    manifest: createRestroomVanityManifest(parameters),
    createModel: () => createRestroomVanityModel(parameters),
  });
}

export function createRestroomMirrorDefinition(
  input: Partial<RestroomMirrorParameters> = {},
): ModelAssetDefinition {
  const parameters = normalizeRestroomMirrorParameters(input);
  return assertModelAssetDefinition({
    manifest: createRestroomMirrorManifest(parameters),
    createModel: () => createRestroomMirrorModel(parameters),
  });
}

export const restroomPartitionDefinition = createRestroomPartitionDefinition();
export const restroomStallDoorDefinition = createRestroomStallDoorDefinition();
export const restroomToiletDefinition = createRestroomToiletDefinition();
export const restroomUrinalBankDefinition = createRestroomUrinalBankDefinition();
export const restroomVanityDefinition = createRestroomVanityDefinition();
export const restroomMirrorDefinition = createRestroomMirrorDefinition();

export const restroomAssetDefinitions = [
  restroomPartitionDefinition,
  restroomStallDoorDefinition,
  restroomToiletDefinition,
  restroomUrinalBankDefinition,
  restroomVanityDefinition,
  restroomMirrorDefinition,
  restroomAccessibleDoorDefinition,
  restroomAccessibleVanityDefinition,
  restroomAccessibilitySupportDefinition,
] as const;
