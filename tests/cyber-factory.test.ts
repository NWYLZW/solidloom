import { describe, expect, it } from "vitest";
import {
  applyFeatureGraphExpressions,
  createCyberOfficeSpaceModel,
  createInteractionPlaygroundModel,
  cyberFactoryModels,
  regenerateProceduralMeshFeature,
  synchronizeRoomAssemblyFeatures,
} from "@solidloom/shared";

describe("cyber factory examples", () => {
  it("builds a system-native interaction playground from live references", () => {
    const playground = createInteractionPlaygroundModel({
      roomId: "room-model",
      deskId: "desk-model",
      coffeeMachineId: "coffee-machine-model",
      loungeId: "lounge-model",
      monitorId: "monitor-model",
      chairId: "chair-model",
      snackCabinetId: "container-model",
      waterDispenserId: "water-dispenser-model",
      warehouseCartId: "warehouse-cart-model",
      warehousePalletId: "warehouse-pallet-model",
      warehouseRackId: "warehouse-rack-model",
      warehouseAutomation: {
        controlAnchor: [-1_534.4, 640, 1_514],
        forkAxis: [0, 0, -1],
        forkBaseLength: 820,
        forkExtension: 951,
        homePose: { liftY: 320, travelX: -1_140 },
        motionFeatureIds: {
          travel: ["warehouse-stacker-travel-base"],
          carriage: ["warehouse-stacker-carriage-deck"],
          forks: ["warehouse-stacker-left-fork", "warehouse-stacker-right-fork"],
        },
        slots: [
          { id: "warehouse-rack-slot-b01-l01", bayIndex: 0, levelIndex: 0, bayX: -1_100, shelfY: 220 },
          { id: "warehouse-rack-slot-b02-l02", bayIndex: 1, levelIndex: 1, bayX: 0, shelfY: 953.333 },
          { id: "warehouse-rack-slot-b03-l03", bayIndex: 2, levelIndex: 2, bayX: 1_100, shelfY: 1_686.667 },
        ],
      },
      warehouseToteId: "warehouse-tote-model",
    });
    expect(playground.kind).toBe("scene");
    expect(playground.name).toBe("交互试验场");
    expect(playground.featureGraph.features).toEqual([]);
    expect(playground.featureGraph.references).toHaveLength(16);
    expect(playground.featureGraph.references?.map((reference) => reference.modelId)).toEqual(
      expect.arrayContaining([
        "warehouse-cart-model",
        "warehouse-pallet-model",
        "warehouse-rack-model",
        "warehouse-tote-model",
      ]),
    );
    expect(playground.featureGraph.references?.flatMap((reference) => reference.interactions ?? []))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "door",
          anchorPosition: [-4740, 1210, -650],
        }),
        expect.objectContaining({
          activateLabel: "使用咖啡机",
          kind: "device",
          label: "咖啡机",
          operationExecuteLabel: "开始制作",
          operationGroups: [expect.objectContaining({
            id: "recipe",
            options: expect.arrayContaining([
              expect.objectContaining({ id: "espresso", label: "浓缩咖啡" }),
              expect.objectContaining({ id: "latte", label: "拿铁咖啡" }),
            ]),
          })],
        }),
        expect.objectContaining({
          activateLabel: "使用饮水机",
          kind: "device",
          label: "饮水机",
          operationExecuteLabel: "开始接水",
          operationGroups: expect.arrayContaining([
            expect.objectContaining({
              id: "temperature",
              options: expect.arrayContaining([
                expect.objectContaining({ id: "hot", label: "热水" }),
                expect.objectContaining({ id: "cold", label: "冷水" }),
              ]),
            }),
            expect.objectContaining({
              id: "volume",
              options: expect.arrayContaining([
                expect.objectContaining({ id: "small", label: "小杯" }),
                expect.objectContaining({ id: "large", label: "大杯" }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({
          activateLabel: "打开落地灯",
          deactivateLabel: "关闭落地灯",
          kind: "power",
        }),
        expect.objectContaining({ kind: "seat" }),
        expect.objectContaining({
          kind: "container",
          label: "办公补给柜",
          containerCapacity: 64,
          containerCanConfigure: true,
          containerCurrency: "CNY",
          containerProducts: expect.arrayContaining([
            expect.objectContaining({ name: "气泡水", unitPrice: 6 }),
            expect.objectContaining({ name: "能量棒", unitPrice: 12 }),
          ]),
          containerItems: expect.arrayContaining([
            expect.objectContaining({ name: "气泡水", productId: "sparkling-water" }),
            expect.objectContaining({ name: "能量棒", productId: "energy-bar" }),
          ]),
        }),
      ]));
    expect(playground.featureGraph.navigation).toMatchObject({
      enabled: true,
      floorY: 0,
      agentHeight: 1720,
    });
  });

  it("builds the office space from live model references instead of copied geometry", () => {
    const space = createCyberOfficeSpaceModel({
      roomId: "room-model",
      deskId: "desk-model",
      monitorId: "monitor-model",
      laptopId: "laptop-model",
      chairId: "chair-model",
    });
    expect(space.kind).toBe("scene");
    expect(space.name).toBe("赛博办公空间");
    expect(space.featureGraph?.features).toEqual([]);
    expect(space.featureGraph?.references).toEqual(expect.arrayContaining([
      expect.objectContaining({ modelId: "room-model", name: "房间 · 引用", position: [0, -160, 0], roomSurfaceMode: "interior" }),
      expect.objectContaining({ modelId: "desk-model", name: "第 1 排 · 工位 1 · 办公桌" }),
      expect.objectContaining({ modelId: "monitor-model", name: "第 1 排 · 工位 1 · 显示器 1" }),
      expect.objectContaining({ modelId: "laptop-model", name: "第 1 排 · 工位 1 · 笔记本" }),
      expect.objectContaining({ modelId: "chair-model", name: "第 1 排 · 工位 1 · 人体工学椅" }),
    ]));
    expect(space.featureGraph?.references).toHaveLength(37);
    const desks = space.featureGraph?.references?.filter((reference) => reference.modelId === "desk-model") ?? [];
    expect(desks.map((reference) => reference.position)).toEqual([
      [-3000, 0, 418],
      [-1000, 0, 418],
      [1000, 0, 418],
      [3000, 0, 418],
      [-3000, 0, -418],
      [-1000, 0, -418],
      [1000, 0, -418],
      [3000, 0, -418],
    ]);
    expect(desks.every((reference) => reference.scale?.[0] === 1.25)).toBe(true);
    expect(desks.slice(0, 4).every((reference) => reference.rotation[1] === 180)).toBe(true);
    expect(desks.slice(4).every((reference) => reference.rotation[1] === 0)).toBe(true);
    expect(space.featureGraph?.references?.filter((reference) => reference.modelId === "chair-model").every((reference) => reference.position[1] === 0)).toBe(true);
    expect(space.featureGraph?.references?.filter((reference) => reference.modelId === "chair-model").every((reference) => (
      reference.physics?.bodyType === "dynamic"
      && reference.physics.mass === 16
      && reference.physics.friction === 0.42
      && reference.interactions?.[0]?.kind === "seat"
    ))).toBe(true);
    expect(space.featureGraph?.references?.filter((reference) => reference.modelId === "laptop-model").every((reference) => reference.position[1] === 770)).toBe(true);
    const laptops = space.featureGraph?.references?.filter((reference) => reference.modelId === "laptop-model") ?? [];
    expect(new Set(laptops.map((reference) => reference.position[0])).size).toBe(8);
    expect(new Set(laptops.map((reference) => reference.rotation[1])).size).toBe(8);
    expect(laptops.slice(0, 4).every((reference) => Math.abs(reference.rotation[1]) <= 12)).toBe(true);
    expect(laptops.slice(4).every((reference) => Math.abs(reference.rotation[1] - 180) <= 12)).toBe(true);
    const laptopAngles = laptops.map((reference) => reference.jointValues?.["cyber-laptop-screen-hinge"]);
    expect(laptopAngles.filter((angle) => angle === 0)).toHaveLength(2);
    expect(new Set(laptopAngles).size).toBeGreaterThanOrEqual(6);
    const monitors = space.featureGraph?.references?.filter((reference) => reference.modelId === "monitor-model") ?? [];
    expect(monitors).toHaveLength(12);
    expect(monitors.every((reference) => reference.position[1] === 760)).toBe(true);
    expect(monitors.every((reference) => (
      reference.interactions?.[0]?.kind === "power" && reference.interactions[0].range === 1350
    ))).toBe(true);
    expect(laptops.every((reference) => (
      reference.interactions?.[0]?.kind === "articulation"
      && reference.interactions[0].range === 1050
      && reference.interactions[0].jointId === "cyber-laptop-screen-hinge"
      && reference.interactions[0].closedValue === 0
      && reference.interactions[0].openValue === 102
    ))).toBe(true);
    const chairs = space.featureGraph?.references?.filter((reference) => reference.modelId === "chair-model") ?? [];
    expect(new Set(chairs.map((reference) => reference.position[0])).size).toBe(8);
    expect(new Set(chairs.map((reference) => reference.rotation[1])).size).toBe(8);
    expect(space.featureGraph?.references?.find((reference) => reference.modelId === "room-model")?.interactions)
      .toEqual([expect.objectContaining({ kind: "door", openAngle: 88 })]);
    expect(space.featureGraph?.navigation).toMatchObject({
      enabled: true,
      floorY: 0,
      agentRadius: 260,
      agentHeight: 1720,
    });
  });

  it("defines the factory models with stable grouped features", () => {
    expect(cyberFactoryModels.map((model) => model.name)).toEqual([
      "办公桌",
      "电脑显示器",
      "主机箱",
      "笔记本",
      "房间",
      "简易人体工学椅",
      "极简风小人",
      "原创方块角色",
      "参数化零食售货机",
      "参数化咖啡机",
      "参数化下置桶饮水机",
      "现代休息区资产套件",
    ]);
    expect(cyberFactoryModels.reduce((total, model) => total + (model.featureGraph?.features.length ?? 0), 0)).toBeGreaterThan(137);

    for (const model of cyberFactoryModels) {
      const graph = model.featureGraph;
      expect(model.unit).toBe("mm");
      expect(model.description?.length).toBeGreaterThan(10);
      expect(graph).toBeDefined();
      if (!graph) continue;
      if (model.name === "房间") {
        expect(graph.features).toHaveLength(6);
        expect(graph.groups).toHaveLength(3);
      } else if (model.name === "极简风小人") {
        expect(graph.features).toHaveLength(14);
        expect(graph.groups).toHaveLength(9);
        expect(graph.joints).toHaveLength(8);
        expect(graph.joints?.filter((joint) => joint.parentJointId)).toHaveLength(4);
        expect(graph.joints?.find((joint) => joint.id === "cyber-figure-left-elbow")?.parentJointId).toBe("cyber-figure-left-shoulder");
        expect(graph.joints?.find((joint) => joint.id === "cyber-figure-right-knee")?.parentJointId).toBe("cyber-figure-right-hip");
        expect(graph.poses?.map((pose) => pose.name)).toEqual(["站立", "招手", "屈膝"]);
        expect(graph.animations?.map((animation) => animation.name)).toEqual(["走路", "奔跑"]);
        expect(graph.locomotion).toMatchObject({
          name: "移动速度",
          walkReferenceSpeed: 1.4,
          runReferenceSpeed: 3.6,
          transitionStartSpeed: 1.7,
          transitionEndSpeed: 2.7,
        });
        expect(graph.animations?.every((animation) => (
          animation.loop
          && animation.keyframes.length === 5
          && animation.keyframes[0]?.offset === 0
          && animation.keyframes.at(-1)?.offset === 1
          && animation.keyframes.every((keyframe) => Object.keys(keyframe.jointValues).length === 8)
        ))).toBe(true);
        expect(graph.features.some((feature) => feature.id === "cyber-figure-base")).toBe(false);
        const head = graph.features.find((feature) => feature.id === "cyber-figure-head");
        expect(head?.type).toBe("mesh");
        if (head?.type === "mesh") {
          expect(head.parameters.positions.length).toBeGreaterThan(1_000);
          expect(head.parameters.indices.length).toBeGreaterThan(1_000);
        }
        expect(graph.features.filter((feature) => feature.id.includes("hand") && feature.type === "mesh")).toHaveLength(2);
        expect(graph.features.filter((feature) => feature.id.includes("foot") && feature.type === "mesh")).toHaveLength(2);
      } else if (model.name === "主机箱") {
        const removedFeatureIds = [
          "cyber-tower-carry-rail",
          "cyber-tower-top-vent",
          "cyber-tower-io",
          "cyber-tower-foot-left",
          "cyber-tower-foot-right",
          "cyber-tower-light-strip",
        ];
        expect(graph.features.map((feature) => feature.id)).not.toEqual(expect.arrayContaining(removedFeatureIds));
        expect(graph.features.some((feature) => (
          feature.type === "box"
          && feature.parameters.width === 260
          && feature.parameters.height === 520
          && feature.parameters.depth === 470
        ))).toBe(false);
        const glassPanel = graph.features.find((feature) => feature.id === "cyber-tower-side-panel");
        expect(glassPanel).toMatchObject({
          type: "box",
          position: [126, 270, 0],
          appearance: { material: "glass" },
          parameters: { width: 8, height: 496, depth: 438 },
        });
      } else if (model.name === "原创方块角色") {
        expect(graph.features).toHaveLength(8);
        expect(graph.groups).toHaveLength(8);
        expect(graph.joints).toHaveLength(8);
        expect(graph.poses?.map((pose) => pose.name)).toEqual(["站立", "招手", "潜行", "坐下"]);
        expect(graph.animations?.map((animation) => animation.name)).toEqual(["走路", "奔跑", "潜行移动"]);
        expect(graph.joints.find((joint) => joint.id === "block-avatar-head-joint")?.parentJointId).toBe("block-avatar-torso-joint");
        expect(graph.joints.find((joint) => joint.id === "block-avatar-left-arm-joint")?.parentJointId).toBe("block-avatar-torso-joint");
        expect(graph.joints.find((joint) => joint.id === "block-avatar-left-knee-joint")?.parentJointId).toBe("block-avatar-left-leg-joint");
        expect(graph.poses?.find((pose) => pose.id === "block-avatar-pose-sit")?.jointValues).toMatchObject({
          "block-avatar-left-leg-joint": -90,
          "block-avatar-left-knee-joint": 90,
          "block-avatar-right-leg-joint": -90,
          "block-avatar-right-knee-joint": 90,
        });
        expect(graph.features.every((feature) => (
          feature.type === "box"
          && feature.appearance?.voxelSkin?.url === "builtin:solidloom-block-avatar"
          && feature.appearance.voxelSkin.model === "classic"
        ))).toBe(true);
        expect(graph.features.map((feature) => feature.appearance?.voxelSkin?.part)).toEqual([
          "head",
          "torso",
          "leftArm",
          "rightArm",
          "leftLeg",
          "leftLeg",
          "rightLeg",
          "rightLeg",
        ]);
        expect(graph.features.map((feature) => feature.appearance?.voxelSkin?.segment)).toEqual([
          undefined,
          undefined,
          undefined,
          undefined,
          "upper",
          "lower",
          "upper",
          "lower",
        ]);
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

  it("assigns editable materials and colors to every factory model feature", () => {
    for (const model of cyberFactoryModels) {
      const features = model.featureGraph?.features ?? [];
      expect(features.length).toBeGreaterThan(0);
      expect(features.every((feature) => Boolean(feature.appearance?.material))).toBe(true);
      expect(features.every((feature) => /^#[0-9A-F]{6}$/.test(feature.appearance?.color ?? ""))).toBe(true);
      expect(new Set(features.map((feature) => feature.appearance?.material)).size).toBeGreaterThanOrEqual(2);
      expect(new Set(features.map((feature) => feature.appearance?.color)).size).toBeGreaterThanOrEqual(2);
    }
  });

  it("builds a closed room shell with adjustable size and view-aware surfaces", () => {
    const room = cyberFactoryModels.find((model) => model.name === "房间")!;
    const shell = room.featureGraph!.features.find((feature) => feature.id === "cyber-room-shell");
    expect(shell?.type).toBe("mesh");
    expect(shell?.type === "mesh" ? shell.parameters.indices.length : 0).toBe(252);
    expect(shell?.type === "mesh" ? shell.parameters.source : null).toMatchObject({
      kind: "room-shell",
      size: [9600, 2800, 6000],
      wallThickness: 120,
      floorThickness: 160,
      autoHideSurfaces: false,
      door: { width: 920, height: 2100, offsetZ: -650 },
      window: { fullWall: true, width: 9360, height: 2480, sillHeight: 0, offsetX: 0 },
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
    expect(rightFrame?.position).toEqual([4740, 1400, -2940]);
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
      size: [380, 260, 7],
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
    expect(graph.joints).toEqual([
      expect.objectContaining({
        id: "cyber-laptop-screen-hinge",
        groupId: "cyber-laptop-screen-group",
        type: "revolute",
        value: 102,
        restValue: 102,
        min: 0,
        max: 135,
      }),
    ]);
  });
});
