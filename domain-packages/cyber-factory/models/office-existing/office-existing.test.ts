import {
  createCyberOfficeSpaceModel,
  validateModelAssetDefinition,
  type ModelAssetDefinition,
  type ModelFeature,
} from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
  blockAvatarFeatureIds,
  createBlockAvatarDefinition,
  createOfficeChairDefinition,
  createOfficeDeskDefinition,
  createOfficeLaptopDefinition,
  createOfficeMonitorDefinition,
  createOfficeTowerDefinition,
  defaultBlockAvatarParameters,
  defaultOfficeChairParameters,
  defaultOfficeDeskParameters,
  officeAssetDefinitionByKey,
  officeAssetDefinitions,
  officeAssetModules,
  officeAssetPerformanceBudgets,
  officeChairFeatureIds,
  officeChairWheelFeatureId,
  officeDeskFeatureIds,
  officeExistingAssetIds,
  officeLaptopFeatureIds,
  officeLaptopJointIds,
  officeMonitorFeatureIds,
  officeTowerFeatureIds,
} from "./index.js";

const stableIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function dimensions(feature: ModelFeature) {
  if (feature.type === "box") {
    return [feature.parameters.width, feature.parameters.height, feature.parameters.depth];
  }
  if (feature.type === "cylinder") {
    return [feature.parameters.radius * 2, feature.parameters.height, feature.parameters.radius * 2];
  }
  return feature.parameters.source?.size;
}

function expectStableShape(
  baseline: ModelAssetDefinition,
  variant: ModelAssetDefinition,
) {
  expect(variant.createModel().featureGraph!.features.map(({ id }) => id))
    .toEqual(baseline.createModel().featureGraph!.features.map(({ id }) => id));
  expect(variant.manifest.colliders.map(({ id }) => id))
    .toEqual(baseline.manifest.colliders.map(({ id }) => id));
  expect(variant.manifest.anchors.map(({ id }) => id))
    .toEqual(baseline.manifest.anchors.map(({ id }) => id));
  expect(variant.manifest.joints.map(({ id }) => id))
    .toEqual(baseline.manifest.joints.map(({ id }) => id));
}

describe("existing office asset metadata", () => {
  it("formalizes all six assets while keeping unconnected runtime modules planned", () => {
    expect(officeAssetDefinitions.map(({ manifest }) => manifest.id)).toEqual([
      officeExistingAssetIds.desk,
      officeExistingAssetIds.chair,
      officeExistingAssetIds.laptop,
      officeExistingAssetIds.monitor,
      officeExistingAssetIds.tower,
      officeExistingAssetIds.avatar,
    ]);
    expect(officeAssetDefinitions.map(validateModelAssetDefinition)).toEqual(
      Array.from({ length: 6 }, () => ({ valid: true, issues: [] })),
    );
    expect(officeAssetModules.every(({ status }) => status === "planned")).toBe(true);
    expect(officeAssetDefinitions.every(({ manifest }) => manifest.tags?.includes("planned"))).toBe(true);
  });

  it("keeps feature, collider, anchor and joint ids stable across parameter variants", () => {
    expectStableShape(officeAssetDefinitionByKey.desk, createOfficeDeskDefinition({ width: 2_000, height: 800 }));
    expectStableShape(officeAssetDefinitionByKey.chair, createOfficeChairDefinition({ seatWidth: 600, seatHeight: 500 }));
    expectStableShape(officeAssetDefinitionByKey.laptop, createOfficeLaptopDefinition({ width: 440, openAngle: 118 }));
    expectStableShape(officeAssetDefinitionByKey.monitor, createOfficeMonitorDefinition({ width: 780, overallHeight: 820 }));
    expectStableShape(officeAssetDefinitionByKey.tower, createOfficeTowerDefinition({ width: 320, height: 640 }));
    expectStableShape(officeAssetDefinitionByKey.avatar, createBlockAvatarDefinition({ height: 1_900, skinModel: "slim" }));
  });

  it("drives the actual geometry from declared real-millimetre parameters", () => {
    const wideDesk = createOfficeDeskDefinition({ width: 2_000, depth: 900, height: 800 });
    const deskTop = wideDesk.createModel().featureGraph!.features.find(({ id }) => id === officeDeskFeatureIds.top)!;
    expect(dimensions(deskTop)).toEqual([2_000, 34, 900]);
    expect(wideDesk.manifest.anchors.find(({ id }) => id === "desk-work-surface")?.position[1]).toBe(800);

    const adjustedChair = createOfficeChairDefinition({ seatWidth: 600, seatDepth: 520, seatHeight: 500 });
    const seat = adjustedChair.createModel().featureGraph!.features.find(({ id }) => id === officeChairFeatureIds.seat)!;
    expect(dimensions(seat)).toEqual([600, 72, 520]);
    expect(adjustedChair.manifest.anchors.find(({ id }) => id === "chair-seat")?.position[1]).toBe(500);

    const laptop = createOfficeLaptopDefinition({ width: 440, depth: 300, openAngle: 118 });
    const laptopBase = laptop.createModel().featureGraph!.features.find(({ id }) => id === officeLaptopFeatureIds.base)!;
    expect(dimensions(laptopBase)).toEqual([440, 9, 300]);
    expect(laptop.createModel().featureGraph!.joints?.[0]).toMatchObject({ value: 118, restValue: 118 });

    const monitor = createOfficeMonitorDefinition({ width: 780, panelHeight: 460, overallHeight: 820 });
    const monitorShell = monitor.createModel().featureGraph!.features.find(({ id }) => id === officeMonitorFeatureIds.shell)!;
    expect(dimensions(monitorShell)).toEqual([780, 460, 34]);

    const tower = createOfficeTowerDefinition({ width: 320, depth: 600, height: 640 });
    const chassis = tower.createModel().featureGraph!.features.find(({ id }) => id === officeTowerFeatureIds.chassis)!;
    expect(dimensions(chassis)).toEqual([320, 604, 14]);

    const avatar = createBlockAvatarDefinition({ height: 1_900, skinModel: "slim" });
    const head = avatar.createModel().featureGraph!.features.find(({ id }) => id === blockAvatarFeatureIds.head)!;
    expect(head.position[1] + dimensions(head)![1]! / 2).toBe(1_900);
    expect(head.appearance?.voxelSkin?.model).toBe("slim");
  });

  it("uses Y=0 as the support plane without desk, chair, device or avatar penetration", () => {
    expect(defaultOfficeDeskParameters.height).toBe(760);
    expect(defaultOfficeChairParameters.seatHeight).toBe(460);
    expect(defaultBlockAvatarParameters.height).toBe(1_720);
    expect(officeAssetDefinitions.every(({ manifest }) => manifest.placement.groundY === 0)).toBe(true);

    const deskLeg = officeAssetDefinitionByKey.desk.createModel().featureGraph!.features
      .find(({ id }) => id === officeDeskFeatureIds.legFrontLeft)!;
    expect(deskLeg.position[1] - dimensions(deskLeg)![1]! / 2).toBe(0);

    const wheel = officeAssetDefinitionByKey.chair.createModel().featureGraph!.features
      .find(({ id }) => id === officeChairWheelFeatureId(0))!;
    expect(wheel.type).toBe("cylinder");
    if (wheel.type === "cylinder") expect(wheel.position[1] - wheel.parameters.radius).toBe(0);

    const laptopBase = officeAssetDefinitionByKey.laptop.createModel().featureGraph!.features
      .find(({ id }) => id === officeLaptopFeatureIds.base)!;
    expect(laptopBase.position[1] - dimensions(laptopBase)![1]! / 2).toBe(0);

    const monitorBase = officeAssetDefinitionByKey.monitor.createModel().featureGraph!.features
      .find(({ id }) => id === officeMonitorFeatureIds.base)!;
    expect(monitorBase.position[1] - dimensions(monitorBase)![1]! / 2).toBe(0);

    const towerBase = officeAssetDefinitionByKey.tower.createModel().featureGraph!.features
      .find(({ id }) => id === officeTowerFeatureIds.bottomFrame)!;
    expect(towerBase.position[1] - dimensions(towerBase)![1]! / 2).toBe(0);

    const avatarFoot = officeAssetDefinitionByKey.avatar.createModel().featureGraph!.features
      .find(({ id }) => id === blockAvatarFeatureIds.leftLowerLeg)!;
    expect(avatarFoot.position[1] - dimensions(avatarFoot)![1]! / 2).toBe(0);
  });

  it("publishes collision, placement, seat, interaction, action and joint bindings", () => {
    expect(officeAssetDefinitions.every(({ manifest }) => manifest.colliders.length > 0)).toBe(true);
    expect(officeAssetDefinitions.every(({ manifest }) => (
      manifest.anchors.some(({ kind }) => kind === "placement")
    ))).toBe(true);
    expect(officeAssetDefinitionByKey.chair.manifest.anchors.find(({ id }) => id === "chair-seat"))
      .toMatchObject({ kind: "seat", featureId: officeChairFeatureIds.seat });
    expect(officeAssetDefinitionByKey.laptop.manifest.anchors.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["laptop-open-control", "laptop-work-action"]),
    );
    expect(officeAssetDefinitionByKey.avatar.manifest.anchors.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["avatar-left-hand-action", "avatar-right-hand-action", "avatar-seat-pose-origin"]),
    );
    expect(officeAssetDefinitionByKey.laptop.manifest.joints).toEqual([
      expect.objectContaining({ jointId: officeLaptopJointIds.screenHinge }),
    ]);
    expect(officeAssetDefinitionByKey.avatar.manifest.joints).toHaveLength(8);
  });

  it("keeps office references on exported stable contracts instead of local special-case ids", () => {
    const office = createCyberOfficeSpaceModel({
      roomId: "room-model",
      deskId: officeExistingAssetIds.desk,
      monitorId: officeExistingAssetIds.monitor,
      laptopId: officeExistingAssetIds.laptop,
      chairId: officeExistingAssetIds.chair,
    });
    const references = office.featureGraph!.references!;
    const monitorPower = references.find(({ modelId }) => modelId === officeExistingAssetIds.monitor)?.interactions?.[0];
    const laptopOpen = references.find(({ modelId }) => modelId === officeExistingAssetIds.laptop)?.interactions?.[0];
    const chairSeat = references.find(({ modelId }) => modelId === officeExistingAssetIds.chair)?.interactions?.[0];
    expect(monitorPower?.targetFeatureIds).toEqual([
      officeMonitorFeatureIds.panel,
      officeMonitorFeatureIds.lightLeft,
      officeMonitorFeatureIds.lightRight,
    ]);
    expect(laptopOpen).toMatchObject({
      targetFeatureIds: [
        officeLaptopFeatureIds.screenShell,
        officeLaptopFeatureIds.screenPanel,
        officeLaptopFeatureIds.camera,
      ],
      jointId: officeLaptopJointIds.screenHinge,
    });
    expect(chairSeat?.targetFeatureIds).toEqual([officeChairFeatureIds.seat]);
  });

  it("provides bounded desktop and mobile LODs, draw calls and independent previews", () => {
    for (const [key, definition] of Object.entries(officeAssetDefinitionByKey)) {
      const budget = officeAssetPerformanceBudgets[key as keyof typeof officeAssetPerformanceBudgets];
      for (const device of ["desktop", "mobile"] as const) {
        const profile = definition.manifest.lod.find((candidate) => candidate.device === device)!;
        const preview = definition.manifest.previews.find((candidate) => candidate.device === device);
        expect(preview).toBeDefined();
        expect(profile.levels).toHaveLength(budget[device].length);
        profile.levels.forEach((level, index) => {
          const levelBudget = budget[device][index]!;
          expect(level.id).toBe(levelBudget.levelId);
          expect(level.featureIds!.length).toBeLessThanOrEqual(levelBudget.maximumDrawCalls);
          expect(level.triangleBudget).toBe(levelBudget.triangleBudget);
        });
      }
      const desktop = definition.manifest.lod.find(({ device }) => device === "desktop")!.levels[0]!;
      const mobile = definition.manifest.lod.find(({ device }) => device === "mobile")!.levels[0]!;
      expect(mobile.featureIds!.length).toBeLessThanOrEqual(desktop.featureIds!.length);
      expect(mobile.triangleBudget!).toBeLessThanOrEqual(desktop.triangleBudget!);
    }
  });

  it("keeps every new contract id stable, kebab-case and unique in its namespace", () => {
    for (const definition of officeAssetDefinitions) {
      const graph = definition.createModel().featureGraph!;
      const namespaces = [
        graph.features.map(({ id }) => id),
        (graph.groups ?? []).map(({ id }) => id),
        (graph.joints ?? []).map(({ id }) => id),
        definition.manifest.parameters.map(({ id }) => id),
        definition.manifest.materials.map(({ id }) => id),
        definition.manifest.colliders.map(({ id }) => id),
        definition.manifest.anchors.map(({ id }) => id),
        definition.manifest.joints.map(({ id }) => id),
      ];
      for (const ids of namespaces) {
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.every((id) => stableIdPattern.test(id))).toBe(true);
      }
    }
  });
});
