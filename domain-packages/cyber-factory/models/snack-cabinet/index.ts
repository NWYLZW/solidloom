import { defineAssetModelModule } from "@solidloom/shared";
import { snackCabinetDefinition, snackCabinetManifest } from "./manifest.js";

export {
  createSnackCabinet,
  defaultSnackCabinetParameters,
  normalizeSnackCabinetParameters,
  snackCabinetFeatureIds,
  snackCabinetGroupIds,
  snackCabinetJointIds,
  type SnackCabinetFinish,
  type SnackCabinetParameters,
} from "./model.js";
export { snackCabinetDefinition, snackCabinetManifest };

export const snackCabinetModule = defineAssetModelModule("planned", snackCabinetDefinition);
