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
export {
  attemptSnackCabinetHack,
  createSnackCabinetOperationsState,
  depositSnackCabinetEntity,
  exchangeSnackCabinetEntities,
  hasSnackCabinetManagementAccess,
  snackCabinetOperationIds,
  withdrawSnackCabinetEntity,
  type CreateSnackCabinetOperationsInput,
  type SnackCabinetHackInput,
  type SnackCabinetHackResult,
  type SnackCabinetOperationsState,
} from "./operations.js";
export { snackCabinetDefinition, snackCabinetManifest };

export const snackCabinetModule = defineAssetModelModule("available", snackCabinetDefinition);
