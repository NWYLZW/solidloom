import type { CoffeeRecipe } from "./operations.js";

export type CoffeeBrewAnimationStage = "heating" | "extracting" | "finishing" | "complete";

export interface CoffeeBrewAnimationFrame {
  completed: boolean;
  displayPulse: number;
  indicatorIntensity: number;
  label: string;
  liquidLevel: number;
  machineVibration: number;
  progress: number;
  stage: CoffeeBrewAnimationStage;
  steamOpacity: number;
  streamOpacity: number;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function rangeProgress(progress: number, start: number, end: number) {
  return clamp01((progress - start) / (end - start));
}

function activeEnvelope(progress: number, start: number, end: number, fade = 0.08) {
  const fadeIn = rangeProgress(progress, start, start + fade);
  const fadeOut = 1 - rangeProgress(progress, end - fade, end);
  return Math.min(fadeIn, fadeOut);
}

export function getCoffeeBrewDuration(recipe: CoffeeRecipe) {
  const ingredientDuration = recipe.ingredients.waterMl * 6 + recipe.ingredients.milkMl * 4;
  return Math.round(Math.min(5_200, Math.max(3_200, 2_600 + ingredientDuration)));
}

export function getCoffeeBrewAnimationFrame(
  elapsedMs: number,
  recipe: CoffeeRecipe,
): CoffeeBrewAnimationFrame {
  const duration = getCoffeeBrewDuration(recipe);
  const progress = clamp01(elapsedMs / duration);
  const hasMilk = recipe.ingredients.milkMl > 0;
  const extracting = activeEnvelope(progress, 0.16, 0.82, 0.1);
  const steam = hasMilk ? activeEnvelope(progress, 0.38, 0.92, 0.12) : 0;
  const completed = progress >= 1;

  let stage: CoffeeBrewAnimationStage;
  let label: string;
  if (completed) {
    stage = "complete";
    label = "制作完成";
  } else if (progress < 0.16) {
    stage = "heating";
    label = "正在预热";
  } else if (progress < 0.82) {
    stage = "extracting";
    label = hasMilk && progress >= 0.46 ? "正在融合" : "正在萃取";
  } else {
    stage = "finishing";
    label = "即将完成";
  }

  return {
    completed,
    displayPulse: completed ? 0.45 : 0.72 + Math.sin(progress * Math.PI * 18) * 0.22,
    indicatorIntensity: completed ? 2.2 : 3.6 + Math.sin(progress * Math.PI * 20) * 1.25,
    label,
    liquidLevel: rangeProgress(progress, 0.18, 0.9),
    machineVibration: extracting * Math.sin(progress * Math.PI * 42) * 0.75,
    progress,
    stage,
    steamOpacity: steam,
    streamOpacity: extracting,
  };
}
