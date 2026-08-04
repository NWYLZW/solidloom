import { describe, expect, it } from "vitest";
import type { ModelRecord } from "@solidloom/shared";
import {
  mergeLatestModelsPreservingIdentity,
  referenceViewportGroupId,
  resolveModelReferences,
} from "../apps/web/src/modelReferences";

function model(overrides: Partial<ModelRecord> & Pick<ModelRecord, "id" | "name">): ModelRecord {
  return {
    description: "",
    unit: "mm",
    revision: 1,
    featureGraph: { version: 1, features: [], groups: [] },
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

describe("model references", () => {
  it("does not replace model identities when a polling response is unchanged", () => {
    const desk = model({ id: "desk", name: "办公桌", revision: 3 });
    const unchangedResponse = structuredClone(desk);
    const current = [desk];
    const unchanged = mergeLatestModelsPreservingIdentity(current, [unchangedResponse]);
    expect(unchanged).toBe(current);
    expect(unchanged[0]).toBe(desk);

    const revisedDesk = { ...unchangedResponse, revision: 4, updatedAt: "2026-08-04T01:00:00.000Z" };
    const changed = mergeLatestModelsPreservingIdentity(unchanged, [revisedDesk]);
    expect(changed).not.toBe(unchanged);
    expect(changed[0]).toBe(revisedDesk);
  });

  it("resolves source geometry under an editable instance transform", () => {
    const source = model({
      id: "desk",
      name: "办公桌",
      revision: 3,
      featureGraph: {
        version: 1,
        features: [{
          id: "top",
          name: "桌面",
          type: "box",
          operation: "add",
          position: [20, 0, 0],
          rotation: [0, 0, 0],
          parameters: { width: 1600, depth: 760, height: 34 },
        }],
        groups: [{
          id: "surface",
          name: "桌面组件",
          featureIds: ["top"],
          position: [10, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        }],
      },
    });
    const resolution = resolveModelReferences({
      version: 1,
      features: [],
      references: [{
        id: "desk-instance",
        name: "办公桌 · 引用",
        modelId: "desk",
        position: [100, 0, 200],
        rotation: [0, 45, 0],
        scale: [1, 1, 1],
        physics: { bodyType: "dynamic", mass: 18, friction: 0.4, linearDamping: 3 },
      }],
    }, [source], "workspace");

    expect(resolution.issues).toEqual([]);
    expect(resolution.features).toHaveLength(1);
    expect(resolution.features[0]).toMatchObject({
      id: `${referenceViewportGroupId("desk-instance")}:top`,
      position: [30, 0, 0],
      parameters: { width: 1600 },
    });
    expect(resolution.groups[0]).toMatchObject({
      id: referenceViewportGroupId("desk-instance"),
      featureIds: [`${referenceViewportGroupId("desk-instance")}:top`],
      position: [100, 0, 200],
      rotation: [0, 45, 0],
    });
    expect(resolution.referenceIdByFeatureId.get(resolution.features[0]!.id)).toBe("desk-instance");
    expect(resolution.sourceRevisionByReferenceId.get("desk-instance")).toBe(3);
  });

  it("applies a source model joint before placing its live reference", () => {
    const source = model({
      id: "laptop",
      name: "笔记本",
      featureGraph: {
        version: 1,
        features: [{
          id: "screen",
          name: "屏幕",
          type: "box",
          operation: "add",
          position: [100, 0, 0],
          rotation: [0, 0, 0],
          parameters: { width: 100, depth: 10, height: 60 },
        }],
        groups: [{
          id: "screen-group",
          name: "屏幕组件",
          featureIds: ["screen"],
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        }],
        joints: [{
          id: "hinge",
          name: "屏幕转轴",
          type: "revolute",
          groupId: "screen-group",
          pivot: [0, 0, 0],
          axis: [0, 0, 1],
          value: 90,
          restValue: 0,
          min: 0,
          max: 135,
        }],
      },
    });
    const resolution = resolveModelReferences({
      version: 1,
      features: [],
      references: [{
        id: "laptop-instance",
        name: "笔记本",
        modelId: source.id,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        jointValues: { hinge: 45 },
      }],
    }, [source]);

    expect(resolution.features[0]?.position[0]).toBeCloseTo(Math.SQRT1_2 * 100);
    expect(resolution.features[0]?.position[1]).toBeCloseTo(Math.SQRT1_2 * 100);
    expect(resolution.features[0]?.rotation[2]).toBeCloseTo(45);
  });

  it("can override a referenced room for an interior workspace view", () => {
    const source = model({
      id: "room",
      name: "房间",
      featureGraph: {
        version: 1,
        features: [{
          id: "shell",
          name: "房间壳体",
          type: "mesh",
          operation: "add",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          parameters: {
            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
            normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
            indices: [0, 1, 2],
            source: {
              kind: "room-shell",
              size: [4200, 2800, 3600],
              wallThickness: 120,
              floorThickness: 160,
              autoHideSurfaces: false,
              door: { width: 920, height: 2100, offsetZ: -650 },
              window: { fullWall: true, width: 3960, height: 2480, sillHeight: 0, offsetX: 0 },
            },
          },
        }],
      },
    });
    const resolution = resolveModelReferences({
      version: 1,
      features: [],
      references: [{ id: "room-instance", name: "房间", modelId: "room", position: [0, 0, 0], rotation: [0, 0, 0], roomSurfaceMode: "interior" }],
    }, [source], "workspace");
    const resolved = resolution.features[0];
    expect(resolved?.type === "mesh" && resolved.parameters.source?.kind === "room-shell"
      ? resolved.parameters.source.autoHideSurfaces
      : null).toBe(true);
    expect(source.featureGraph.features[0]?.type === "mesh" && source.featureGraph.features[0].parameters.source?.kind === "room-shell"
      ? source.featureGraph.features[0].parameters.source.autoHideSurfaces
      : null).toBe(false);
  });

  it("uses the latest source revision without changing the workspace graph", () => {
    const workspaceGraph = {
      version: 1 as const,
      features: [],
      references: [{
        id: "laptop-instance",
        name: "笔记本 · 引用",
        modelId: "laptop",
        position: [0, 760, 0] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
      }],
    };
    const revision1 = model({
      id: "laptop",
      name: "笔记本",
      revision: 1,
      featureGraph: {
        version: 1,
        features: [{ id: "base", name: "机身", type: "box", operation: "add", position: [0, 0, 0], rotation: [0, 0, 0], parameters: { width: 360, depth: 240, height: 10 } }],
      },
    });
    const revision2 = model({
      ...revision1,
      revision: 2,
      featureGraph: {
        ...revision1.featureGraph,
        features: [{ ...revision1.featureGraph.features[0]!, parameters: { width: 380, depth: 240, height: 10 } }],
      },
    });

    const first = resolveModelReferences(workspaceGraph, [revision1], "workspace");
    const second = resolveModelReferences(workspaceGraph, [revision2], "workspace");
    expect(first.features[0]?.type === "box" ? first.features[0].parameters.width : 0).toBe(360);
    expect(second.features[0]?.type === "box" ? second.features[0].parameters.width : 0).toBe(380);
    expect(second.sourceRevisionByReferenceId.get("laptop-instance")).toBe(2);
    expect(workspaceGraph.references[0]?.modelId).toBe("laptop");
  });

  it("reports missing and circular reference sources", () => {
    const circular = model({
      id: "circular",
      name: "循环模型",
      featureGraph: {
        version: 1,
        features: [],
        references: [{ id: "self", name: "自身", modelId: "circular", position: [0, 0, 0], rotation: [0, 0, 0] }],
      },
    });
    const resolution = resolveModelReferences({
      version: 1,
      features: [],
      references: [
        { id: "missing", name: "缺失", modelId: "missing-model", position: [0, 0, 0], rotation: [0, 0, 0] },
        { id: "circle", name: "循环", modelId: "circular", position: [0, 0, 0], rotation: [0, 0, 0] },
      ],
    }, [circular], "workspace");
    expect(resolution.issues.map((issue) => issue.kind)).toEqual(["missing-model", "circular-reference"]);
  });
});
