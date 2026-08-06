import { defineAssetModelModule } from "@solidloom/shared";
import { loungeDefinition, loungeManifest } from "./manifest.js";

export {
  createLoungeKit,
  defaultLoungeParameters,
  getLoungeLayoutTransforms,
  getLoungeSofaSeatX,
  loungeDimensions,
  loungeFeatureIds,
  loungeGroupIds,
  normalizeLoungeParameters,
  transformLoungePoint,
  type LoungeComponentTransform,
  type LoungeLayout,
  type LoungeLayoutTransforms,
  type LoungePalette,
  type LoungeParameters,
} from "./model.js";
export { loungeDefinition, loungeManifest };

export const loungeModule = defineAssetModelModule("planned", loungeDefinition);
