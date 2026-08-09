import {
  validateModelAssetDefinition,
  type BoxFeature,
} from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
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
  restroomDoorLeafBounds,
  restroomJointIds,
  restroomUrinalCenterX,
  restroomUrinalDividerX,
  restroomVanityBasinX,
} from "./index.js";
import { createRestroomPreviewFixtureLayout } from "./preview-layout.js";

function ids(values: ReadonlyArray<{ id: string }>) {
  return values.map(({ id }) => id);
}

function boxFeature(definition: ReturnType<typeof createRestroomPartitionDefinition>, id: string) {
  return definition.createModel().featureGraph!.features.find((feature): feature is BoxFeature => (
    feature.id === id && feature.type === "box"
  ));
}

describe("modular restroom asset kit", () => {
  it("publishes six independently referenceable planned assets that pass the shared contract", () => {
    expect(restroomAssetDefinitions.map(({ manifest }) => manifest.id)).toEqual([
      "cyber-factory-restroom-partition",
      "cyber-factory-restroom-stall-door",
      "cyber-factory-restroom-toilet",
      "cyber-factory-restroom-urinal-bank",
      "cyber-factory-restroom-vanity",
      "cyber-factory-restroom-mirror",
    ]);
    expect(restroomAssetDefinitions.map(validateModelAssetDefinition)).toEqual(
      Array.from({ length: 6 }, () => ({ valid: true, issues: [] })),
    );
    expect(restroomAssetModules.every(({ status }) => status === "planned")).toBe(true);
    expect(new Set(restroomAssetDefinitions.map(({ createModel }) => createModel))).toHaveLength(6);
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

  it("keeps stable feature, collider and anchor IDs when dimensions change", () => {
    const variants = [
      [createRestroomPartitionDefinition(), createRestroomPartitionDefinition({ width: 2_050, panelHeight: 2_050 })],
      [createRestroomStallDoorDefinition(), createRestroomStallDoorDefinition({ openingWidth: 1_000, openAngle: 82 })],
      [createRestroomToiletDefinition(), createRestroomToiletDefinition({ bowlWidth: 420, seatHeight: 460, tankHeight: 820 })],
      [createRestroomUrinalBankDefinition(), createRestroomUrinalBankDefinition({ centerSpacing: 780, urinalWidth: 400, rimHeight: 680 })],
      [createRestroomVanityDefinition(), createRestroomVanityDefinition({ width: 1_750, depth: 620, counterHeight: 900 })],
      [createRestroomMirrorDefinition(), createRestroomMirrorDefinition({ width: 1_800, height: 900, bottomHeight: 1_100 })],
    ] as const;

    for (const [baseline, resized] of variants) {
      expect(ids(resized.createModel().featureGraph!.features)).toEqual(ids(baseline.createModel().featureGraph!.features));
      expect(ids(resized.manifest.colliders)).toEqual(ids(baseline.manifest.colliders));
      expect(ids(resized.manifest.anchors)).toEqual(ids(baseline.manifest.anchors));
    }
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
    ];
    expect(definitions.map(validateModelAssetDefinition)).toEqual(
      Array.from({ length: definitions.length }, () => ({ valid: true, issues: [] })),
    );
  });
});
