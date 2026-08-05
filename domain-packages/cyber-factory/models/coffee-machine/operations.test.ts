import { describe, expect, it } from "vitest";
import {
  brewCoffee,
  configureCoffeeRecipe,
  configureCoffeeMachineSupplies,
  defaultCoffeeRecipes,
  getCoffeeStockShortages,
  type CoffeeMachineStock,
  type CoffeeRecipe,
} from "./operations.js";

function recipe(id: string) {
  const result = defaultCoffeeRecipes.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`缺少默认咖啡配方：${id}`);
  return result;
}

describe("coffee machine recipes and supplies", () => {
  it("configures capacities and clamps initial stock to each reservoir", () => {
    const configuration = configureCoffeeMachineSupplies({
      capacities: {
        waterMl: 900,
        milkMl: 450,
        beansGrams: { arabica: 120, robusta: 80, decaf: 60 },
      },
      initialStock: {
        waterMl: 1_200,
        milkMl: 220,
        beansGrams: { arabica: 150, robusta: 35, decaf: 20 },
      },
    });

    expect(configuration.capacities).toEqual({
      waterMl: 900,
      milkMl: 450,
      beansGrams: { arabica: 120, robusta: 80, decaf: 60 },
    });
    expect(configuration.initialStock).toEqual({
      waterMl: 900,
      milkMl: 220,
      beansGrams: { arabica: 120, robusta: 35, decaf: 20 },
    });
  });

  it("uses different bean kinds and amounts for different menu recipes", () => {
    expect(recipe("americano").ingredients.beansGrams).toEqual({
      arabica: 11,
      robusta: 0,
      decaf: 0,
    });
    expect(recipe("espresso").ingredients.beansGrams).toEqual({
      arabica: 8,
      robusta: 4,
      decaf: 0,
    });
    expect(recipe("decaf-americano").ingredients.beansGrams).toEqual({
      arabica: 0,
      robusta: 0,
      decaf: 12,
    });
  });

  it("deducts one configured serving without mutating the supplied stock", () => {
    const stock: CoffeeMachineStock = {
      waterMl: 500,
      milkMl: 300,
      beansGrams: { arabica: 100, robusta: 40, decaf: 30 },
    };
    const before = structuredClone(stock);
    const result = brewCoffee(stock, recipe("latte"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.consumed).toEqual({
      waterMl: 45,
      milkMl: 180,
      beansGrams: { arabica: 10, robusta: 0, decaf: 0 },
    });
    expect(result.stock).toEqual({
      waterMl: 455,
      milkMl: 120,
      beansGrams: { arabica: 90, robusta: 40, decaf: 30 },
    });
    expect(stock).toEqual(before);
  });

  it("rejects an unavailable recipe atomically and reports every shortage", () => {
    const stock: CoffeeMachineStock = {
      waterMl: 30,
      milkMl: 20,
      beansGrams: { arabica: 5, robusta: 2, decaf: 0 },
    };
    const before = structuredClone(stock);
    const result = brewCoffee(stock, recipe("cappuccino"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stock).toEqual(before);
    expect(result.shortages.map((shortage) => shortage.resource)).toEqual([
      "water",
      "milk",
      "beans:arabica",
      "beans:robusta",
    ]);
    expect(stock).toEqual(before);
  });

  it("accepts custom recipes so per-serving consumption is not hard-coded", () => {
    const customRecipe: CoffeeRecipe = {
      id: "factory-double",
      name: "工厂双份",
      description: "自定义双豆配方",
      ingredients: {
        waterMl: 70,
        milkMl: 25,
        beansGrams: { arabica: 14, robusta: 8, decaf: 0 },
      },
    };
    const stock: CoffeeMachineStock = {
      waterMl: 60,
      milkMl: 100,
      beansGrams: { arabica: 20, robusta: 10, decaf: 0 },
    };

    expect(getCoffeeStockShortages(stock, customRecipe)).toEqual([
      expect.objectContaining({ resource: "water", required: 70, available: 60 }),
    ]);
  });

  it("normalizes negative custom consumption instead of allowing stock creation", () => {
    const configured = configureCoffeeRecipe({
      id: "bad-input",
      name: "异常输入",
      description: "验证配置边界",
      ingredients: {
        waterMl: -30,
        milkMl: -20,
        beansGrams: { arabica: -4, robusta: 2, decaf: 0 },
      },
    });

    expect(configured.ingredients).toEqual({
      waterMl: 0,
      milkMl: 0,
      beansGrams: { arabica: 0, robusta: 2, decaf: 0 },
    });
  });
});
