import { describe, expect, it } from "vitest";
import type { ModelRecord } from "@solidloom/shared";
import { upsertModelInStableOrder } from "../apps/web/src/modelCollection";

function model(id: string, revision = 1): ModelRecord {
  return {
    id,
    name: `模型 ${id}`,
    description: "",
    unit: "mm",
    revision,
    featureGraph: { version: 1, features: [], groups: [] },
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

describe("stable model collection updates", () => {
  it("replaces a selected model without moving it", () => {
    const models = [model("desk"), model("monitor"), model("tower")];
    const updatedTower = model("tower", 2);

    const result = upsertModelInStableOrder(models, updatedTower);

    expect(result.map((item) => item.id)).toEqual(["desk", "monitor", "tower"]);
    expect(result[2]).toBe(updatedTower);
  });

  it("appends a newly created model", () => {
    const result = upsertModelInStableOrder([model("desk")], model("chair"));
    expect(result.map((item) => item.id)).toEqual(["desk", "chair"]);
  });
});
