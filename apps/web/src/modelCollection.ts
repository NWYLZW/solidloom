import type { ModelRecord } from "@solidloom/shared";

export function upsertModelInStableOrder(models: ModelRecord[], model: ModelRecord): ModelRecord[] {
  const existingIndex = models.findIndex((item) => item.id === model.id);
  if (existingIndex === -1) return [...models, model];
  return models.map((item, index) => index === existingIndex ? model : item);
}
