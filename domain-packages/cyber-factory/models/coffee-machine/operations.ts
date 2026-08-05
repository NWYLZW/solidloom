export const coffeeBeanKinds = ["arabica", "robusta", "decaf"] as const;

export type CoffeeBeanKind = typeof coffeeBeanKinds[number];

export interface CoffeeBeanAmounts {
  arabica: number;
  decaf: number;
  robusta: number;
}

export interface CoffeeRecipeIngredients {
  beansGrams: CoffeeBeanAmounts;
  milkMl: number;
  waterMl: number;
}

export interface CoffeeRecipe {
  description: string;
  id: string;
  ingredients: CoffeeRecipeIngredients;
  name: string;
}

export interface CoffeeMachineStock {
  beansGrams: CoffeeBeanAmounts;
  milkMl: number;
  waterMl: number;
}

export interface CoffeeMachineSupplyConfiguration {
  capacities: CoffeeMachineStock;
  initialStock: CoffeeMachineStock;
}

export interface CoffeeBeanAmountsInput {
  arabica?: number;
  decaf?: number;
  robusta?: number;
}

export interface CoffeeMachineStockInput {
  beansGrams?: CoffeeBeanAmountsInput;
  milkMl?: number;
  waterMl?: number;
}

export interface CoffeeMachineSupplyConfigurationInput {
  capacities?: CoffeeMachineStockInput;
  initialStock?: CoffeeMachineStockInput;
}

export type CoffeeStockResource = "water" | "milk" | `beans:${CoffeeBeanKind}`;

export interface CoffeeStockShortage {
  available: number;
  label: string;
  required: number;
  resource: CoffeeStockResource;
  unit: "g" | "ml";
}

export type CoffeeBrewResult = {
  consumed: CoffeeRecipeIngredients;
  ok: true;
  recipe: CoffeeRecipe;
  stock: CoffeeMachineStock;
} | {
  ok: false;
  recipe: CoffeeRecipe;
  shortages: CoffeeStockShortage[];
  stock: CoffeeMachineStock;
};

export const coffeeBeanLabels: Record<CoffeeBeanKind, string> = {
  arabica: "阿拉比卡豆",
  robusta: "罗布斯塔豆",
  decaf: "低因豆",
};

export const defaultCoffeeMachineSupplyConfiguration: CoffeeMachineSupplyConfiguration = {
  capacities: {
    waterMl: 2_000,
    milkMl: 1_200,
    beansGrams: { arabica: 500, robusta: 350, decaf: 250 },
  },
  initialStock: {
    waterMl: 1_450,
    milkMl: 720,
    beansGrams: { arabica: 260, robusta: 180, decaf: 110 },
  },
};

function beanAmounts(
  arabica = 0,
  robusta = 0,
  decaf = 0,
): CoffeeBeanAmounts {
  return { arabica, robusta, decaf };
}

export const defaultCoffeeRecipes: readonly CoffeeRecipe[] = [
  {
    id: "espresso",
    name: "浓缩咖啡",
    description: "短杯浓郁拼配",
    ingredients: { waterMl: 40, milkMl: 0, beansGrams: beanAmounts(8, 4) },
  },
  {
    id: "americano",
    name: "美式咖啡",
    description: "清爽阿拉比卡长杯",
    ingredients: { waterMl: 180, milkMl: 0, beansGrams: beanAmounts(11) },
  },
  {
    id: "latte",
    name: "拿铁",
    description: "柔和奶咖",
    ingredients: { waterMl: 45, milkMl: 180, beansGrams: beanAmounts(10) },
  },
  {
    id: "cappuccino",
    name: "卡布奇诺",
    description: "双豆拼配与绵密奶泡",
    ingredients: { waterMl: 45, milkMl: 120, beansGrams: beanAmounts(8, 3) },
  },
  {
    id: "decaf-americano",
    name: "低因美式",
    description: "低因豆长杯",
    ingredients: { waterMl: 180, milkMl: 0, beansGrams: beanAmounts(0, 0, 12) },
  },
] as const;

function nonNegative(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, value ?? fallback) : fallback;
}

function normalizeBeans(
  input: CoffeeBeanAmountsInput | undefined,
  fallback: CoffeeBeanAmounts,
): CoffeeBeanAmounts {
  return {
    arabica: nonNegative(input?.arabica, fallback.arabica),
    robusta: nonNegative(input?.robusta, fallback.robusta),
    decaf: nonNegative(input?.decaf, fallback.decaf),
  };
}

function normalizeStock(
  input: CoffeeMachineStockInput | undefined,
  fallback: CoffeeMachineStock,
): CoffeeMachineStock {
  return {
    waterMl: nonNegative(input?.waterMl, fallback.waterMl),
    milkMl: nonNegative(input?.milkMl, fallback.milkMl),
    beansGrams: normalizeBeans(input?.beansGrams, fallback.beansGrams),
  };
}

function cloneStock(stock: CoffeeMachineStock): CoffeeMachineStock {
  return {
    waterMl: stock.waterMl,
    milkMl: stock.milkMl,
    beansGrams: { ...stock.beansGrams },
  };
}

export function configureCoffeeRecipe(recipe: CoffeeRecipe): CoffeeRecipe {
  const id = recipe.id.trim();
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`咖啡配方 ID 必须是稳定的短横线命名：${recipe.id}`);
  }
  return {
    id,
    name: recipe.name.trim() || id,
    description: recipe.description.trim(),
    ingredients: {
      waterMl: nonNegative(recipe.ingredients.waterMl, 0),
      milkMl: nonNegative(recipe.ingredients.milkMl, 0),
      beansGrams: normalizeBeans(recipe.ingredients.beansGrams, beanAmounts()),
    },
  };
}

export function configureCoffeeMachineSupplies(
  input: CoffeeMachineSupplyConfigurationInput = {},
): CoffeeMachineSupplyConfiguration {
  const capacities = normalizeStock(
    input.capacities,
    defaultCoffeeMachineSupplyConfiguration.capacities,
  );
  const requestedInitialStock = normalizeStock(
    input.initialStock,
    defaultCoffeeMachineSupplyConfiguration.initialStock,
  );
  return {
    capacities,
    initialStock: {
      waterMl: Math.min(requestedInitialStock.waterMl, capacities.waterMl),
      milkMl: Math.min(requestedInitialStock.milkMl, capacities.milkMl),
      beansGrams: {
        arabica: Math.min(requestedInitialStock.beansGrams.arabica, capacities.beansGrams.arabica),
        robusta: Math.min(requestedInitialStock.beansGrams.robusta, capacities.beansGrams.robusta),
        decaf: Math.min(requestedInitialStock.beansGrams.decaf, capacities.beansGrams.decaf),
      },
    },
  };
}

export function getCoffeeStockShortages(
  stock: CoffeeMachineStock,
  recipe: CoffeeRecipe,
): CoffeeStockShortage[] {
  const shortages: CoffeeStockShortage[] = [];
  const { ingredients } = configureCoffeeRecipe(recipe);
  if (stock.waterMl < ingredients.waterMl) {
    shortages.push({
      resource: "water",
      label: "水",
      required: ingredients.waterMl,
      available: stock.waterMl,
      unit: "ml",
    });
  }
  if (stock.milkMl < ingredients.milkMl) {
    shortages.push({
      resource: "milk",
      label: "牛奶",
      required: ingredients.milkMl,
      available: stock.milkMl,
      unit: "ml",
    });
  }
  coffeeBeanKinds.forEach((kind) => {
    const required = ingredients.beansGrams[kind];
    const available = stock.beansGrams[kind];
    if (available < required) {
      shortages.push({
        resource: `beans:${kind}`,
        label: coffeeBeanLabels[kind],
        required,
        available,
        unit: "g",
      });
    }
  });
  return shortages;
}

export function brewCoffee(
  stock: CoffeeMachineStock,
  recipe: CoffeeRecipe,
): CoffeeBrewResult {
  const configuredRecipe = configureCoffeeRecipe(recipe);
  const shortages = getCoffeeStockShortages(stock, configuredRecipe);
  if (shortages.length > 0) {
    return { ok: false, recipe: configuredRecipe, shortages, stock: cloneStock(stock) };
  }
  const { ingredients } = configuredRecipe;
  return {
    ok: true,
    recipe: configuredRecipe,
    consumed: {
      waterMl: ingredients.waterMl,
      milkMl: ingredients.milkMl,
      beansGrams: { ...ingredients.beansGrams },
    },
    stock: {
      waterMl: stock.waterMl - ingredients.waterMl,
      milkMl: stock.milkMl - ingredients.milkMl,
      beansGrams: {
        arabica: stock.beansGrams.arabica - ingredients.beansGrams.arabica,
        robusta: stock.beansGrams.robusta - ingredients.beansGrams.robusta,
        decaf: stock.beansGrams.decaf - ingredients.beansGrams.decaf,
      },
    },
  };
}

export function refillCoffeeMachineSupplies(
  configuration: CoffeeMachineSupplyConfiguration,
): CoffeeMachineStock {
  return cloneStock(configuration.capacities);
}
