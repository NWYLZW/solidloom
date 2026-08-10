import {
  validateModelAssetDefinition,
  type BoxFeature,
} from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
  createRestroomAccessibleDoorDefinition,
  createRestroomAccessibleVanityDefinition,
  createRestroomAccessibilitySupportDefinition,
  createRestroomMirrorDefinition,
  createRestroomPartitionDefinition,
  createRestroomStallDoorDefinition,
  createRestroomToiletDefinition,
  createRestroomUrinalBankDefinition,
  createRestroomVanityDefinition,
  defaultRestroomStallDoorParameters,
  defaultRestroomUrinalBankParameters,
  restroomAssetDefinitions,
  restroomAssetModules,
  restroomAccessibleDoorLeafBounds,
  restroomDoorLeafBounds,
  restroomJointIds,
  restroomUrinalCenterX,
  restroomUrinalDividerX,
  restroomVanityBasinX,
} from "./index.js";
import {
  createRestroomPreviewAccessibleLayout,
  createRestroomPreviewComposition,
  createRestroomPreviewFixtureLayout,
  createRestroomPreviewStallLayout,
  restroomPreviewWallColor,
} from "./preview-layout.js";

function ids(values: ReadonlyArray<{ id: string }>) {
  return values.map(({ id }) => id);
}

function boxFeature(definition: ReturnType<typeof createRestroomPartitionDefinition>, id: string) {
  return definition.createModel().featureGraph!.features.find((feature): feature is BoxFeature => (
    feature.id === id && feature.type === "box"
  ));
}

describe("modular restroom asset kit", () => {
  it("uses a low-glare white wall palette in every restroom preview", () => {
    expect(restroomPreviewWallColor).toBe(0xe1e6e4);
  });

  it("publishes nine independently referenceable planned assets that pass the shared contract", () => {
    expect(restroomAssetDefinitions.map(({ manifest }) => manifest.id)).toEqual([
      "cyber-factory-restroom-partition",
      "cyber-factory-restroom-stall-door",
      "cyber-factory-restroom-toilet",
      "cyber-factory-restroom-urinal-bank",
      "cyber-factory-restroom-vanity",
      "cyber-factory-restroom-mirror",
      "cyber-factory-restroom-accessible-door",
      "cyber-factory-restroom-accessible-vanity",
      "cyber-factory-restroom-accessibility-support",
    ]);
    expect(restroomAssetDefinitions.map(validateModelAssetDefinition)).toEqual(
      Array.from({ length: 9 }, () => ({ valid: true, issues: [] })),
    );
    expect(restroomAssetModules.every(({ status }) => status === "planned")).toBe(true);
    expect(new Set(restroomAssetDefinitions.map(({ createModel }) => createModel))).toHaveLength(9);
  });

  it("keeps real millimetre scale and an explicit Y=0 placement baseline", () => {
    for (const definition of restroomAssetDefinitions) {
      expect(definition.manifest.modelUnit).toBe("mm");
      expect(definition.manifest.placement).toMatchObject({
        upAxis: "y",
        groundY: 0,
        origin: [0, 0, 0],
        defaultScale: [1, 1, 1],
      });
      const graph = definition.createModel().featureGraph!;
      for (const feature of graph.features) {
        if (feature.type === "box" || feature.type === "cylinder") {
          expect(feature.position[1] - feature.parameters.height / 2).toBeGreaterThanOrEqual(0);
        }
      }
      expect(definition.manifest.lod.map(({ device }) => device)).toEqual(["desktop", "mobile"]);
      expect(definition.manifest.previews.map(({ device }) => device)).toEqual(["desktop", "mobile"]);
    }
  });

  it("mounts the vanity and mirror in front of the preview side wall without intersection", () => {
    const layout = createRestroomPreviewFixtureLayout();
    const wallFrontX = layout.sideWall.position[0] + layout.sideWall.size[0] / 2;
    const vanityBackX = layout.vanity.position[0] - layout.vanity.depth / 2;

    expect(layout.sideWall.frontX).toBe(wallFrontX);
    expect(vanityBackX).toBe(wallFrontX + layout.vanity.wallClearance);
    expect(layout.mirror.position[0]).toBe(wallFrontX + layout.mirror.wallClearance);
    expect(vanityBackX).toBeGreaterThan(wallFrontX);
    expect(layout.mirror.position[0]).toBeGreaterThan(wallFrontX);

    const wallMinimumZ = layout.sideWall.position[2] - layout.sideWall.size[2] / 2;
    const wallMaximumZ = layout.sideWall.position[2] + layout.sideWall.size[2] / 2;
    const fixtureMinimumZ = layout.vanity.position[2] - layout.vanity.width / 2;
    const fixtureMaximumZ = layout.vanity.position[2] + layout.vanity.width / 2;
    expect(fixtureMinimumZ).toBeGreaterThanOrEqual(wallMinimumZ);
    expect(fixtureMaximumZ).toBeLessThanOrEqual(wallMaximumZ);
  });

  it("omits the urinal bank from the women room composition without creating a zero-count asset", () => {
    const men = createRestroomPreviewComposition("men");
    const women = createRestroomPreviewComposition("women");

    expect(men.assetIds).toContain("cyber-factory-restroom-urinal-bank");
    expect(men.urinalControlsEnabled).toBe(true);
    expect(women.assetIds).not.toContain("cyber-factory-restroom-urinal-bank");
    expect(women.urinalControlsEnabled).toBe(false);
    expect(women.assetIds).toEqual([
      "cyber-factory-restroom-partition",
      "cyber-factory-restroom-stall-door",
      "cyber-factory-restroom-toilet",
      "cyber-factory-restroom-vanity",
      "cyber-factory-restroom-mirror",
    ]);
    expect(women.stallControlsEnabled).toBe(true);
  });

  it("uses only independent accessible-room assets for the accessible composition", () => {
    const accessible = createRestroomPreviewComposition("accessible");

    expect(accessible.assetIds).toEqual([
      "cyber-factory-restroom-accessible-door",
      "cyber-factory-restroom-toilet",
      "cyber-factory-restroom-accessible-vanity",
      "cyber-factory-restroom-mirror",
      "cyber-factory-restroom-accessibility-support",
    ]);
    expect(accessible.assetIds).not.toContain("cyber-factory-restroom-partition");
    expect(accessible.assetIds).not.toContain("cyber-factory-restroom-stall-door");
    expect(accessible.assetIds).not.toContain("cyber-factory-restroom-urinal-bank");
    expect(accessible.stallControlsEnabled).toBe(false);
    expect(accessible.urinalControlsEnabled).toBe(false);
  });

  it("fills the women room continuously from the left boundary to the vanity wall", () => {
    const men = createRestroomPreviewStallLayout("men");
    const women = createRestroomPreviewStallLayout("women");
    const fixtures = createRestroomPreviewFixtureLayout();

    expect(men.stallCount).toBe(2);
    expect(men.partitionXs).toEqual([-2_320, -1_370, -420]);
    expect(men.stallCenterXs).toEqual([-1_845, -895]);
    expect(women.stallCount).toBe(5);
    expect(women.stallWidth).toBe(1_050);
    expect(women.partitionXs).toEqual([-2_320, -1_270, -220, 830, 1_880, 2_930]);
    expect(women.stallCenterXs).toEqual([-1_795, -745, 305, 1_355, 2_405]);
    expect(women.partitionXs.slice(1).map((x, index) => x - women.partitionXs[index]!)).toEqual([
      1_050,
      1_050,
      1_050,
      1_050,
      1_050,
    ]);
    women.stallCenterXs.forEach((centerX, index) => {
      expect(centerX).toBe((women.partitionXs[index]! + women.partitionXs[index + 1]!) / 2);
    });
    expect(women.partitionXs.at(-1)).toBe(fixtures.sideWall.position[0]);
    expect(women.labelPosition[0]).toBe(305);
  });

  it("keeps stable feature, collider and anchor IDs when dimensions change", () => {
    const variants = [
      [createRestroomPartitionDefinition(), createRestroomPartitionDefinition({ width: 2_050, panelHeight: 2_050 })],
      [createRestroomStallDoorDefinition(), createRestroomStallDoorDefinition({ openingWidth: 1_000, openAngle: 82 })],
      [createRestroomToiletDefinition(), createRestroomToiletDefinition({ bowlWidth: 420, seatHeight: 460, tankHeight: 820 })],
      [createRestroomUrinalBankDefinition(), createRestroomUrinalBankDefinition({ centerSpacing: 780, urinalWidth: 400, rimHeight: 680 })],
      [createRestroomVanityDefinition(), createRestroomVanityDefinition({ width: 1_750, depth: 620, counterHeight: 900 })],
      [createRestroomMirrorDefinition(), createRestroomMirrorDefinition({ width: 1_800, height: 900, bottomHeight: 1_100 })],
      [createRestroomAccessibleDoorDefinition(), createRestroomAccessibleDoorDefinition({ openingWidth: 1_150, doorHeight: 2_200 })],
      [createRestroomAccessibleVanityDefinition(), createRestroomAccessibleVanityDefinition({ width: 900, depth: 560, counterHeight: 820 })],
      [createRestroomAccessibilitySupportDefinition(), createRestroomAccessibilitySupportDefinition({ transferSide: "right", railHeight: 800, railLength: 780 })],
    ] as const;

    for (const [baseline, resized] of variants) {
      expect(ids(resized.createModel().featureGraph!.features)).toEqual(ids(baseline.createModel().featureGraph!.features));
      expect(ids(resized.manifest.colliders)).toEqual(ids(baseline.manifest.colliders));
      expect(ids(resized.manifest.anchors)).toEqual(ids(baseline.manifest.anchors));
    }
  });

  it("mirrors the complete accessible room without changing room dimensions", () => {
    const left = createRestroomPreviewAccessibleLayout("left");
    const right = createRestroomPreviewAccessibleLayout("right");

    expect(left.room.width).toBe(right.room.width);
    expect(left.room.depth).toBe(right.room.depth);
    expect(left.room.backWall).toEqual(right.room.backWall);
    expect(left.room.frontWalls).toEqual(right.room.frontWalls);
    expect(left.room.sideWalls.map(({ size }) => size[1])).toEqual([2_650, 1_000]);
    expect(right.room.sideWalls.map(({ size }) => size[1])).toEqual([1_000, 2_650]);
    expect(left.toilet.position).toEqual([850, 0, -1_050]);
    expect(right.toilet.position).toEqual([-850, 0, -1_050]);
    expect(left.support).toMatchObject({ position: [850, 0, -1_050], transferSide: "left" });
    expect(right.support).toMatchObject({ position: [-850, 0, -1_050], transferSide: "right" });
    expect(left.vanity.position[0]).toBe(-right.vanity.position[0]);
    expect(left.vanity.rotationY).toBe(-right.vanity.rotationY);
    expect(left.mirror.position[0]).toBe(-right.mirror.position[0]);
    expect(left.door).toEqual(right.door);
    expect(left.room.frontWalls.map(({ size }) => size[0])).toEqual([1_575, 1_575]);
  });

  it("mirrors grab rails and emergency call anchors with stable IDs", () => {
    const left = createRestroomAccessibilitySupportDefinition({ transferSide: "left" });
    const right = createRestroomAccessibilitySupportDefinition({ transferSide: "right" });
    const leftFeatures = left.createModel().featureGraph!.features;
    const rightFeatures = right.createModel().featureGraph!.features;

    expect(ids(leftFeatures)).toEqual(ids(rightFeatures));
    expect(ids(left.manifest.colliders)).toEqual(ids(right.manifest.colliders));
    expect(ids(left.manifest.anchors)).toEqual(ids(right.manifest.anchors));
    expect(leftFeatures.find(({ id }) => id === "restroom-accessibility-transfer-rail")?.position[0]).toBe(-420);
    expect(rightFeatures.find(({ id }) => id === "restroom-accessibility-transfer-rail")?.position[0]).toBe(420);
    expect(left.manifest.anchors.find(({ id }) => id === "restroom-accessibility-emergency-call")?.position[0]).toBe(-720);
    expect(right.manifest.anchors.find(({ id }) => id === "restroom-accessibility-emergency-call")?.position[0]).toBe(720);
    expect(left.manifest.anchors.find(({ id }) => id === "restroom-accessibility-transfer-support")?.tags).toContain("left");
    expect(right.manifest.anchors.find(({ id }) => id === "restroom-accessibility-transfer-support")?.tags).toContain("right");
  });

  it("keeps the accessible vanity wall-hung and leaves the front free of a cabinet collider", () => {
    const vanity = createRestroomAccessibleVanityDefinition({ kneeClearanceHeight: 700 });

    expect(ids(vanity.createModel().featureGraph!.features).some((id) => id.includes("cabinet"))).toBe(false);
    expect(ids(vanity.manifest.colliders).some((id) => id.includes("cabinet"))).toBe(false);
    expect(vanity.manifest.anchors.find(({ id }) => id === "restroom-accessible-vanity-knee-space")?.position[1]).toBe(700);
    expect(vanity.manifest.anchors.find(({ id }) => id === "restroom-accessible-vanity-wall-service")?.position[2]).toBe(0);
  });

  it("opens the full-height accessible entry door with a dynamic collider", () => {
    const door = createRestroomAccessibleDoorDefinition({ openingWidth: 1_050, openAngle: 92 });
    const joint = door.createModel().featureGraph!.joints?.find(({ id }) => id === restroomJointIds.accessibleDoor);
    const openBounds = restroomAccessibleDoorLeafBounds({ openingWidth: 1_050, openAngle: 92 }, -92);

    expect(joint).toMatchObject({ min: -92, max: 0, axis: [0, 1, 0] });
    expect(door.manifest.colliders.find(({ id }) => id === "restroom-accessible-door-leaf-collider")).toMatchObject({
      dynamic: true,
      groupId: "restroom-accessible-door-leaf-group",
      jointId: restroomJointIds.accessibleDoor,
    });
    expect(525 - openBounds.maximumX).toBeGreaterThan(980);
  });

  it("keeps the accessible entry door visually distinct from the restroom wall palette", () => {
    const door = createRestroomAccessibleDoorDefinition();
    const features = door.createModel().featureGraph!.features;

    expect(features.find(({ id }) => id === "restroom-accessible-door-leaf")?.appearance?.color).toBe("#213A57");
    expect(features.find(({ id }) => id === "restroom-accessible-door-symbol")?.appearance?.color).toBe("#55BCEB");
    expect(door.manifest.materials.find(({ id }) => id === "accessible-door-panel")?.color).toBe("#213A57");
    expect(door.manifest.materials.find(({ id }) => id === "accessible-door-symbol")?.color).toBe("#55BCEB");
  });

  it("regenerates partition geometry, colliders and installation anchors from one parameter set", () => {
    const definition = createRestroomPartitionDefinition({ width: 2_000, panelHeight: 2_050, bottomGap: 180, thickness: 50 });
    expect(boxFeature(definition, "restroom-partition-panel")).toMatchObject({
      position: [0, 1_205, 0],
      parameters: { width: 1_930, height: 2_050, depth: 50 },
    });
    expect(definition.manifest.colliders.find(({ id }) => id === "restroom-partition-panel-collider")).toMatchObject({
      position: [0, 1_205, 0],
      size: [1_930, 2_050, 50],
    });
    expect(definition.manifest.anchors.find(({ id }) => id === "restroom-partition-left-install")?.position).toEqual([-1_000, 0, 0]);
    expect(definition.manifest.anchors.find(({ id }) => id === "restroom-partition-right-install")?.position).toEqual([1_000, 0, 0]);
  });

  it("opens the stall door outward without crossing the opposite jamb or consuming the clear doorway", () => {
    const definition = createRestroomStallDoorDefinition({ openingWidth: 900, thickness: 38, openAngle: 88 });
    const graph = definition.createModel().featureGraph!;
    const joint = graph.joints?.find(({ id }) => id === restroomJointIds.stallDoor);
    const openPose = graph.poses?.find(({ id }) => id === "restroom-stall-door-open");
    expect(joint).toMatchObject({ min: -88, max: 0, axis: [0, 1, 0] });
    expect(openPose?.jointValues[restroomJointIds.stallDoor]).toBe(-88);
    expect(definition.manifest.colliders.find(({ id }) => id === "restroom-stall-door-leaf-collider")).toMatchObject({
      dynamic: true,
      groupId: "restroom-stall-door-leaf-group",
      jointId: restroomJointIds.stallDoor,
    });

    const rightJambInnerX = 450;
    for (let angle = 0; angle >= -88; angle -= 2) {
      expect(restroomDoorLeafBounds({ openingWidth: 900, thickness: 38, openAngle: 88 }, angle).maximumX).toBeLessThan(rightJambInnerX);
    }
    const openBounds = restroomDoorLeafBounds({ openingWidth: 900, thickness: 38, openAngle: 88 }, -88);
    expect(openBounds.minimumZ).toBeLessThanOrEqual(0);
    expect(openBounds.maximumZ).toBeGreaterThan(800);
    expect(rightJambInnerX - openBounds.maximumX).toBeGreaterThan(820);
  });

  it("maintains reasonable urinal centre spacing, divider clearance and deterministic numbering", () => {
    const parameters = { ...defaultRestroomUrinalBankParameters, count: 4, centerSpacing: 760, urinalWidth: 400 };
    const definition = createRestroomUrinalBankDefinition(parameters);
    const centres = Array.from({ length: parameters.count }, (_, index) => restroomUrinalCenterX(parameters, index));
    const dividers = Array.from({ length: parameters.count - 1 }, (_, index) => restroomUrinalDividerX(parameters, index));
    expect(centres).toEqual([-1_140, -380, 380, 1_140]);
    expect(centres.slice(1).map((value, index) => value - centres[index]!)).toEqual([760, 760, 760]);
    expect(dividers).toEqual([-760, 0, 760]);
    expect((parameters.centerSpacing - parameters.urinalWidth) / 2).toBeGreaterThanOrEqual(180);
    expect(ids(definition.manifest.colliders).filter((id) => id.includes("divider"))).toHaveLength(3);
    expect(ids(definition.manifest.anchors).filter((id) => id.endsWith("-use"))).toEqual([
      "restroom-urinal-01-use",
      "restroom-urinal-02-use",
      "restroom-urinal-03-use",
      "restroom-urinal-04-use",
    ]);
    expect(definition.manifest.anchors.filter(({ id }) => id.includes("wall-mount")).every(({ position }) => position[2] === 0)).toBe(true);
  });

  it("removes optional urinal dividers together with their geometry and colliders", () => {
    const withoutDividers = createRestroomUrinalBankDefinition({ count: 3, dividerEnabled: false });
    expect(ids(withoutDividers.createModel().featureGraph!.features).some((id) => id.includes("divider"))).toBe(false);
    expect(ids(withoutDividers.manifest.colliders).some((id) => id.includes("divider"))).toBe(false);
    expect(withoutDividers.manifest.materials.find(({ id }) => id === "urinal-dividers")?.featureIds).toEqual([]);
  });

  it("synchronizes urinal and vanity geometry, colliders and use/maintenance/approach anchors", () => {
    const urinals = createRestroomUrinalBankDefinition({ count: 2, centerSpacing: 820, rimHeight: 700, projection: 410, dividerDepth: 600 });
    expect(urinals.manifest.colliders.find(({ id }) => id === "restroom-urinal-02-bowl-collider")?.position).toEqual([410, 600, 257.5]);
    expect(urinals.manifest.anchors.find(({ id }) => id === "restroom-urinal-02-approach")?.position).toEqual([410, 0, 1_110]);
    expect(urinals.manifest.anchors.find(({ id }) => id === "restroom-urinal-02-maintenance")?.position).toEqual([410, 1_085, 160]);

    const vanity = createRestroomVanityDefinition({ width: 2_000, depth: 620, counterHeight: 910, basinCount: 3, basinSpacing: 680 });
    expect([0, 1, 2].map((index) => restroomVanityBasinX({ basinCount: 3, basinSpacing: 680 }, index))).toEqual([-680, 0, 680]);
    expect(vanity.manifest.colliders.find(({ id }) => id === "restroom-vanity-counter-collider")).toMatchObject({
      position: [0, 875, 0],
      size: [2_000, 70, 620],
    });
    expect(vanity.manifest.anchors.filter(({ id }) => id.endsWith("-use"))).toHaveLength(3);
    expect(vanity.manifest.anchors.filter(({ id }) => id.endsWith("-approach"))).toHaveLength(3);
    expect(vanity.manifest.anchors.find(({ id }) => id === "restroom-vanity-maintenance")?.tags).toContain("maintenance");
  });

  it("rejects parameter boundaries that would break fit, clearance or physical scale", () => {
    expect(() => createRestroomPartitionDefinition({ width: 899 })).toThrow(/partition.width/);
    expect(() => createRestroomStallDoorDefinition({ openAngle: 69 })).toThrow(/stallDoor.openAngle/);
    expect(() => createRestroomToiletDefinition({ seatHeight: 500 })).toThrow(/toilet.seatHeight/);
    expect(() => createRestroomUrinalBankDefinition({ count: 7 })).toThrow(/urinalBank.count/);
    expect(() => createRestroomUrinalBankDefinition({ centerSpacing: 640, urinalWidth: 420 })).toThrow(/至少 240 mm/);
    expect(() => createRestroomUrinalBankDefinition({ projection: 420, dividerDepth: 470 })).toThrow(/至少多 60 mm/);
    expect(() => createRestroomVanityDefinition({ width: 1_400, basinCount: 2, basinSpacing: 850 })).toThrow(/无法容纳/);
    expect(() => createRestroomMirrorDefinition({ bottomHeight: Number.NaN })).toThrow(/mirror.bottomHeight/);
    expect(() => createRestroomAccessibleDoorDefinition({ openingWidth: 899 })).toThrow(/accessibleDoor.openingWidth/);
    expect(() => createRestroomAccessibleVanityDefinition({ counterHeight: 760, kneeClearanceHeight: 720 })).toThrow(/结构厚度/);
    expect(() => createRestroomAccessibilitySupportDefinition({ transferSide: "center" as "left" })).toThrow(/transferSide/);
    expect(() => restroomUrinalCenterX({ count: 3, centerSpacing: 700 }, 3)).toThrow(/超出范围/);
  });

  it("keeps every collider and anchor target resolvable after parameter changes", () => {
    const definitions = [
      createRestroomPartitionDefinition({ width: 2_200 }),
      createRestroomStallDoorDefinition({ openingWidth: 1_050 }),
      createRestroomToiletDefinition({ depth: 780 }),
      createRestroomUrinalBankDefinition({ count: 6, centerSpacing: 900 }),
      createRestroomVanityDefinition({ width: 2_400, basinCount: 3, basinSpacing: 800 }),
      createRestroomMirrorDefinition({ width: 2_400 }),
      createRestroomAccessibleDoorDefinition({ openingWidth: 1_200 }),
      createRestroomAccessibleVanityDefinition({ width: 1_000 }),
      createRestroomAccessibilitySupportDefinition({ transferSide: "right", railLength: 850 }),
    ];
    expect(definitions.map(validateModelAssetDefinition)).toEqual(
      Array.from({ length: definitions.length }, () => ({ valid: true, issues: [] })),
    );
  });
});
