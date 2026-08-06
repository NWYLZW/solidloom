import { describe, expect, it } from "vitest";
import {
  getCoffeeBrewAnimationFrame,
  getCoffeeBrewDuration,
} from "./brew-animation.js";
import { defaultCoffeeRecipes } from "./operations.js";

function recipe(id: string) {
  const result = defaultCoffeeRecipes.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`缺少默认咖啡配方：${id}`);
  return result;
}

describe("coffee machine brew animation", () => {
  it("derives bounded duration from the configured serving size", () => {
    expect(getCoffeeBrewDuration(recipe("espresso"))).toBe(3_200);
    expect(getCoffeeBrewDuration(recipe("latte"))).toBe(3_590);
    expect(getCoffeeBrewDuration(recipe("americano"))).toBe(3_680);
  });

  it("moves through heating, extraction, finishing and completion", () => {
    const americano = recipe("americano");
    const duration = getCoffeeBrewDuration(americano);

    expect(getCoffeeBrewAnimationFrame(0, americano)).toMatchObject({
      stage: "heating",
      progress: 0,
      completed: false,
    });
    expect(getCoffeeBrewAnimationFrame(duration * 0.5, americano)).toMatchObject({
      stage: "extracting",
      completed: false,
    });
    expect(getCoffeeBrewAnimationFrame(duration * 0.9, americano)).toMatchObject({
      stage: "finishing",
      completed: false,
    });
    expect(getCoffeeBrewAnimationFrame(duration, americano)).toMatchObject({
      stage: "complete",
      progress: 1,
      liquidLevel: 1,
      completed: true,
    });
  });

  it("only emits milk steam for recipes that consume milk", () => {
    const americano = recipe("americano");
    const cappuccino = recipe("cappuccino");

    expect(getCoffeeBrewAnimationFrame(getCoffeeBrewDuration(americano) * 0.6, americano).steamOpacity).toBe(0);
    expect(getCoffeeBrewAnimationFrame(getCoffeeBrewDuration(cappuccino) * 0.6, cappuccino).steamOpacity).toBeGreaterThan(0);
  });

  it("clamps elapsed time before the start and after completion", () => {
    const latte = recipe("latte");

    expect(getCoffeeBrewAnimationFrame(-500, latte).progress).toBe(0);
    expect(getCoffeeBrewAnimationFrame(99_000, latte)).toMatchObject({
      progress: 1,
      completed: true,
      streamOpacity: 0,
      steamOpacity: 0,
    });
  });
});
