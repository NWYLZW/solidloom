import { defineAssetModelModule } from "@solidloom/shared";
import { snackCabinetDefinition, snackCabinetManifest } from "./manifest.js";

export {
  createSnackCabinet,
  defaultSnackCabinetInventory,
  defaultSnackCabinetParameters,
  normalizeSnackCabinetParameters,
  snackCabinetFeatureIds,
  snackCabinetGroupIds,
  snackCabinetJointIds,
  snackCabinetProductFeaturePrefix,
  type SnackCabinetCreateInput,
  type SnackCabinetFinish,
  type SnackCabinetParameters,
  type SnackCabinetProductDefinition,
  type SnackCabinetShelfInventory,
} from "./model.js";
export { snackCabinetDefinition, snackCabinetManifest };

export const snackCabinetModule = defineAssetModelModule("available", snackCabinetDefinition);
