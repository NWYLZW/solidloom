import { describe, expect, it } from "vitest";
import {
  applyFeatureGraphExpressions,
  cyberFactoryModels,
  regenerateProceduralMeshFeature,
  synchronizeRoomAssemblyFeatures,
} from "@solidloom/shared";

describe("cyber factory examples", () => {
  it("defines the six requested models with stable grouped features", () => {
    expect(cyberFactoryModels.map((model) => model.name)).toEqual([
      "办公桌",
      "电脑显示器",
      "主机箱",
      "笔记本",
      "房间",
      "简易人体工学椅",
      "极简风小人",
    ]);
    expect(cyberFactoryModels.reduce((total, model) => total + (model.featureGraph?.features.length ?? 0), 0)).toBe(88);

    for (const model of cyberFactoryModels) {
      const graph = model.featureGraph;
      expect(model.unit).toBe("mm");
      expect(model.description?.length).toBeGreaterThan(10);
      expect(graph).toBeDefined();
      if (!graph) continue;
      if (model.name === "房间") {
        expect(graph.features).toHaveLength(6);
        expect(graph.groups).toHaveLength(3);
      } else {
        expect(graph.features.length).toBeGreaterThanOrEqual(6);
        expect(graph.groups?.length).toBeGreaterThanOrEqual(2);
      }

      const featureIds = graph.features.map((feature) => feature.id);
      expect(new Set(featureIds).size).toBe(featureIds.length);
      for (const feature of graph.features) {
        expect(feature.operation).toBe("add");
        expect(feature.position).toHaveLength(3);
        expect(feature.rotation).toHaveLength(3);
      }
      for (const group of graph.groups ?? []) {
        expect(group.featureIds.length).toBeGreaterThan(0);
        expect(group.featureIds.every((featureId) => featureIds.includes(featureId))).toBe(true);
      }
    }
  });

  it("builds a closed room shell with adjustable size and view-aware surfaces", () => {
    const room = cyberFactoryModels.find((model) => model.name === "房间")!;
    const shell = room.featureGraph!.features.find((feature) => feature.id === "cyber-room-shell");
    expect(shell?.type).toBe("mesh");
    expect(shell?.type === "mesh" ? shell.parameters.indices.length : 0).toBe(252);
    expect(shell?.type === "mesh" ? shell.parameters.source : null).toMatchObject({
      kind: "room-shell",
      size: [4200, 2800, 3600],
      wallThickness: 120,
      floorThickness: 160,
      autoHideSurfaces: false,
      door: { width: 920, height: 2100, offsetZ: -650 },
      window: { fullWall: true, width: 3960, height: 2480, sillHeight: 0, offsetX: 0 },
    });
    expect(room.featureGraph!.features.map((feature) => feature.id)).toEqual(expect.arrayContaining([
      "cyber-room-door",
      "cyber-room-door-handle",
      "cyber-room-window-glass",
      "cyber-room-window-frame-left",
      "cyber-room-window-frame-right",
    ]));
    expect(room.featureGraph!.features.map((feature) => feature.id)).not.toEqual(expect.arrayContaining([
      "cyber-room-window-frame-top",
      "cyber-room-window-frame-bottom",
    ]));
    expect(room.featureGraph!.variables).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "--room-height", value: 2800 }),
      expect.objectContaining({ id: "--wall-thickness", value: 120 }),
    ]));
    expect(room.featureGraph!.features.find((feature) => feature.id === "cyber-room-window-glass")?.parameterExpressions)
      .toMatchObject({
        "parameters.height": "var(--room-height) - 2 * var(--floor-thickness)",
      });
    const rightFrame = room.featureGraph!.features.find((feature) => feature.id === "cyber-room-window-frame-right");
    expect(rightFrame?.type === "box" ? rightFrame.parameters : null).toMatchObject({
      width: 120,
      depth: 120,
      height: 2480,
    });
    expect(rightFrame?.position).toEqual([2040, 1400, -1740]);
    expect(rightFrame?.parameterExpressions?.["parameters.width"]).toBe("var(--wall-thickness)");
    expect(rightFrame?.parameterExpressions?.["parameters.depth"]).toBe("var(--wall-thickness)");
    const resizedGraph = applyFeatureGraphExpressions({
      ...room.featureGraph!,
      variables: room.featureGraph!.variables!.map((variable) => {
        if (variable.id === "--room-width") return { ...variable, value: 5000 };
        if (variable.id === "--room-height") return { ...variable, value: 3000 };
        if (variable.id === "--room-depth") return { ...variable, value: 4200 };
        if (variable.id === "--wall-thickness") return { ...variable, value: 150 };
        return variable;
      }),
    }).featureGraph;
    const resizedRightFrame = resizedGraph.features.find((feature) => feature.id === "cyber-room-window-frame-right");
    expect(resizedRightFrame?.position).toEqual([2425, 1500, -2025]);
    expect(resizedRightFrame?.type === "box" ? resizedRightFrame.parameters : null).toMatchObject({
      width: 150,
      depth: 150,
      height: 2680,
    });
    if (shell?.type !== "mesh" || shell.parameters.source?.kind !== "room-shell") return;
    const regenerated = regenerateProceduralMeshFeature(shell, {
      ...shell.parameters.source,
      size: [5000, 3000, 4200],
      wallThickness: 150,
      autoHideSurfaces: false,
    });
    expect(regenerated.parameters.source).toMatchObject({
      size: [5000, 3000, 4200],
      wallThickness: 150,
      autoHideSurfaces: false,
      window: {
        fullWall: true,
        width: 4700,
        height: 2680,
        sillHeight: 0,
        offsetX: 0,
      },
    });
    expect(regenerated.parameters.positions).not.toEqual(shell.parameters.positions);
    expect(regenerated.appearance).toEqual(shell.appearance);
    if (regenerated.parameters.source?.kind === "room-shell") {
      const synchronized = synchronizeRoomAssemblyFeatures(room.featureGraph!.features, regenerated.parameters.source);
      expect(synchronized.find((feature) => feature.id === "cyber-room-door")?.position)
        .not.toEqual(room.featureGraph!.features.find((feature) => feature.id === "cyber-room-door")?.position);
      expect(synchronized.find((feature) => feature.id === "cyber-room-window-glass")?.position)
        .not.toEqual(room.featureGraph!.features.find((feature) => feature.id === "cyber-room-window-glass")?.position);
    }
  });

  it("keeps the laptop clean, rounded, and spaced for touchpad use", () => {
    const laptop = cyberFactoryModels.find((model) => model.name === "笔记本")!;
    const graph = laptop.featureGraph!;
    const featureIds = graph.features.map((feature) => feature.id);
    expect(featureIds).not.toContain("cyber-laptop-hinge-left");
    expect(featureIds).not.toContain("cyber-laptop-hinge-right");
    expect(featureIds).not.toContain("cyber-laptop-rear-light");
    expect(featureIds).not.toContain("cyber-laptop-key-row-1");
    expect(featureIds).not.toContain("cyber-laptop-key-row-2");
    expect(featureIds).not.toContain("cyber-laptop-key-row-3");
    expect(graph.groups?.map((group) => group.name)).not.toContain("转轴与灯带");

    const trackpad = graph.features.find((feature) => feature.id === "cyber-laptop-trackpad");
    const keyboard = graph.features.find((feature) => feature.id === "cyber-laptop-keyboard");
    const base = graph.features.find((feature) => feature.id === "cyber-laptop-base");
    const screenShell = graph.features.find((feature) => feature.id === "cyber-laptop-screen-shell");
    const appearances = Object.fromEntries(graph.features.map((feature) => [feature.id, feature.appearance]));
    expect(trackpad?.position[2]).toBeGreaterThan(80);
    expect(trackpad?.type === "box" ? trackpad.parameters.cornerRadius : 0).toBe(2);
    expect(keyboard?.type === "box" ? keyboard.position[1] + keyboard.parameters.height / 2 : Infinity).toBeLessThan(9);
    expect(trackpad?.type === "box" ? trackpad.position[1] + trackpad.parameters.height / 2 : Infinity).toBeLessThan(9);
    expect(base?.type).toBe("mesh");
    expect(base?.type === "mesh" ? base.parameters.source?.kind : null).toBe("recessed-deck");
    expect(graph.groups?.find((group) => group.id === "cyber-laptop-base-group")?.featureIds).toHaveLength(3);
    expect(featureIds.some((featureId) => featureId.includes("screen-bezel"))).toBe(false);
    expect(screenShell?.type).toBe("mesh");
    expect(screenShell?.type === "mesh" ? screenShell.parameters.indices.length / 3 : 0).toBeGreaterThan(200);
    expect(screenShell?.type === "mesh" ? screenShell.parameters.source : null).toMatchObject({
      kind: "recessed-panel",
      size: [380, 240, 7],
      edgeFilletRadius: 3,
    });
    if (screenShell?.type === "mesh" && screenShell.parameters.source) {
      const regenerated = regenerateProceduralMeshFeature(screenShell, {
        ...screenShell.parameters.source,
        edgeFilletRadius: 1.5,
      });
      expect(regenerated.parameters.source?.edgeFilletRadius).toBe(1.5);
      expect(regenerated.parameters.positions).not.toEqual(screenShell.parameters.positions);

      let reversedTriangles = 0;
      for (let index = 0; index < screenShell.parameters.indices.length; index += 3) {
        const vertexIds = screenShell.parameters.indices.slice(index, index + 3);
        const points = vertexIds.map((vertexId) => screenShell.parameters.positions.slice(vertexId * 3, vertexId * 3 + 3));
        const normals = vertexIds.map((vertexId) => screenShell.parameters.normals.slice(vertexId * 3, vertexId * 3 + 3));
        const ab = points[1]!.map((value, axis) => value - points[0]![axis]!);
        const ac = points[2]!.map((value, axis) => value - points[0]![axis]!);
        const faceNormal = [
          ab[1]! * ac[2]! - ab[2]! * ac[1]!,
          ab[2]! * ac[0]! - ab[0]! * ac[2]!,
          ab[0]! * ac[1]! - ab[1]! * ac[0]!,
        ];
        const averageNormal = [0, 1, 2].map((axis) => (
          normals[0]![axis]! + normals[1]![axis]! + normals[2]![axis]!
        ) / 3);
        if (faceNormal.reduce((dot, value, axis) => dot + value * averageNormal[axis]!, 0) < 0) reversedTriangles += 1;
      }
      expect(reversedTriangles).toBe(0);
    }
    expect(appearances).toMatchObject({
      "cyber-laptop-base": { material: "metal", color: "#97A2AA" },
      "cyber-laptop-keyboard": { material: "plastic", color: "#30383D" },
      "cyber-laptop-trackpad": { material: "glass", color: "#5F7380" },
      "cyber-laptop-screen-shell": { material: "metal", color: "#87949E" },
      "cyber-laptop-screen-panel": { material: "glass", color: "#102A38" },
      "cyber-laptop-camera": { material: "plastic", color: "#11171B" },
    });
    expect(graph.groups?.find((group) => group.id === "cyber-laptop-screen-group")?.featureIds).toHaveLength(3);
  });
});
