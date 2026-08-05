import { defineAssetModelModule } from "@solidloom/shared";
import { coffeeMachineDefinition, coffeeMachineManifest } from "./manifest.js";

export {
  coffeeMachineFeatureIds,
  coffeeMachineGroupIds,
  coffeeMachineJointIds,
  createCoffeeMachine,
  defaultCoffeeMachineParameters,
  normalizeCoffeeMachineParameters,
  type CoffeeMachineFinish,
  type CoffeeMachineParameters,
} from "./model.js";
export { coffeeMachineDefinition, coffeeMachineManifest };

export const coffeeMachineModule = defineAssetModelModule("planned", coffeeMachineDefinition);
