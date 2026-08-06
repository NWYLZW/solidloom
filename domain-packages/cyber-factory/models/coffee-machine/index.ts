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
export {
  brewCoffee,
  coffeeBeanKinds,
  coffeeBeanLabels,
  configureCoffeeRecipe,
  configureCoffeeMachineSupplies,
  defaultCoffeeMachineSupplyConfiguration,
  defaultCoffeeRecipes,
  getCoffeeStockShortages,
  refillCoffeeMachineSupplies,
  type CoffeeBeanAmounts,
  type CoffeeBeanKind,
  type CoffeeBrewResult,
  type CoffeeMachineStock,
  type CoffeeMachineSupplyConfiguration,
  type CoffeeMachineSupplyConfigurationInput,
  type CoffeeRecipe,
  type CoffeeRecipeIngredients,
  type CoffeeStockShortage,
} from "./operations.js";
export { coffeeMachineDefinition, coffeeMachineManifest };

export const coffeeMachineModule = defineAssetModelModule("available", coffeeMachineDefinition);
