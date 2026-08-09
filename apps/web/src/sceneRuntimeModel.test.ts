import type { ModelRecord } from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import { resolveSceneRuntimeModel } from "./sceneRuntimeModel";

function sceneWithMovementPolicy(policy: "lock" | "close-on-move" | "allow"): ModelRecord {
  return {
    createdAt: "2026-08-09T00:00:00.000Z",
    description: "",
    featureGraph: {
      features: [],
      references: [{
        id: "terminal",
        interactions: [{ id: "screen", kind: "device", movementPolicy: policy }],
        modelId: "missing-test-fixture",
        name: "Terminal",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      }],
      version: 1,
    },
    id: "scene",
    kind: "scene",
    name: "Scene",
    revision: 1,
    unit: "mm",
    updatedAt: "2026-08-09T00:00:00.000Z",
  } as unknown as ModelRecord;
}

describe("resolveSceneRuntimeModel", () => {
  it.each(["lock", "close-on-move", "allow"] as const)(
    "projects the %s movement policy from the interaction description",
    (policy) => {
      const runtime = resolveSceneRuntimeModel(sceneWithMovementPolicy(policy), []);
      expect(runtime.interactions[0]?.movementPolicy).toBe(policy);
    },
  );
});
