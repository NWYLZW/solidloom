import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createNavigationInteractionRuntimes } from "./navigationInteractionRuntime";
import { createNavigationOperationProgramRuntime } from "./navigationOperationProgramRuntime";

describe("navigation operation program runtime", () => {
  it("moves mechanism and cargo in steps, then collects the delivered cargo", () => {
    const mechanismGroup = new THREE.Group();
    const mechanism = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mechanismGroup.add(mechanism);
    const cargo = new THREE.Group();
    const featureGroupById = new Map([
      ["mechanism-group", mechanismGroup],
      ["cargo-group", cargo],
    ]);
    const runtimes = createNavigationInteractionRuntimes({
      featureGroupById,
      featureMeshById: new Map([["mechanism", mechanism]]),
      interactions: [{
        entityLabel: "自动取货机",
        groupId: "mechanism-group",
        id: "retrieve",
        kind: "device",
        label: "自动取货机",
        operationCompleteLabel: "{selection} 已送达。",
        operationExecuteLabel: "开始取货",
        operationGroups: [{
          id: "slot",
          label: "货位",
          options: [{
            id: "slot-a",
            label: "标准组件 A",
            program: {
              collect: { label: "领取货物", status: "领取完成。", targetGroupId: "cargo-group" },
              steps: [{
                durationMs: 100,
                id: "deliver",
                label: "送达",
                motions: [
                  { positionOffset: [10, 0, 0], targetFeatureIds: ["mechanism"] },
                  { positionOffset: [10, 2, 0], targetGroupId: "cargo-group" },
                ],
              }],
            },
          }],
        }],
        targetFeatureIds: ["mechanism"],
      }],
      savedContainerConfigurations: undefined,
      savedContainerItems: undefined,
      savedDeviceSelections: undefined,
      savedDeviceStatuses: undefined,
      savedStates: undefined,
    });
    const runtime = runtimes[0]!;
    const operationRuntime = createNavigationOperationProgramRuntime({
      featureGroupById,
      featureMeshById: new Map([["mechanism", mechanism]]),
      interactions: runtimes,
      onChange: () => {},
    });

    expect(operationRuntime.execute(runtime)).toBe(true);
    expect(runtime.deviceProgramPhase).toBe("running");
    expect(operationRuntime.update(0.1)).toBe(true);
    expect(runtime.deviceProgramPhase).toBe("ready");
    expect(mechanism.position.x).toBe(10);
    expect(cargo.position.toArray()).toEqual([10, 2, 0]);
    expect(operationRuntime.executeLabel(runtime)).toBe("领取货物");

    expect(operationRuntime.execute(runtime)).toBe(true);
    expect(runtime.deviceStatus).toBe("领取完成。");
    expect(runtime.deviceCollectedOptionIds.has("slot-a")).toBe(true);
    expect(cargo.visible).toBe(false);
  });
});
