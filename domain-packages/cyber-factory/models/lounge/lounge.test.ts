import { validateModelAssetDefinition } from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
  createLoungeKit,
  defaultLoungeParameters,
  getLoungeLayoutTransforms,
  loungeDimensions,
  loungeDefinition,
  loungeFeatureIds,
  loungeGroupIds,
  loungeManifest,
  loungeModule,
  normalizeLoungeParameters,
} from "./index.js";

describe("parameterized lounge asset kit", () => {
  it("satisfies the shared scene contract after system registration", () => {
    expect(validateModelAssetDefinition(loungeDefinition)).toEqual({ valid: true, issues: [] });
    expect(loungeModule.status).toBe("available");
    expect(loungeManifest.kind).toBe("scene");
    expect(loungeManifest.id).toBe("cyber-factory-lounge-kit");
  });

  it("keeps stable unique ids and assigns every feature to one component group", () => {
    const graph = createLoungeKit().featureGraph!;
    const featureIds = graph.features.map((feature) => feature.id);
    const groupFeatureIds = graph.groups!.flatMap((group) => group.featureIds);
    const allIds = [
      ...featureIds,
      ...graph.groups!.map((group) => group.id),
      ...loungeManifest.anchors.map((anchor) => anchor.id),
      ...loungeManifest.colliders.map((collider) => collider.id),
    ];

    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.every((id) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id))).toBe(true);
    expect(groupFeatureIds).toHaveLength(featureIds.length);
    expect(new Set(groupFeatureIds)).toEqual(new Set(featureIds));
    expect(graph.groups).toHaveLength(7);
  });

  it("clamps dimensions and rebuilds layout-dependent geometry", () => {
    const compact = normalizeLoungeParameters({
      sofaWidth: 1_000,
      seatHeight: 200,
      tableWidth: 2_000,
      rugWidth: 8_000,
      layout: "compact",
    });
    expect(compact).toMatchObject({
      sofaWidth: 2_400,
      seatHeight: 380,
      tableWidth: 1_600,
      rugWidth: 6_200,
      layout: "compact",
    });

    const linear = createLoungeKit({ layout: "linear", sofaWidth: 2_600 }).featureGraph!;
    const conversation = createLoungeKit({ layout: "conversation", sofaWidth: 2_000 }).featureGraph!;
    const linearSofa = linear.features.find((feature) => feature.id === loungeFeatureIds.sofaBase);
    const conversationSofa = conversation.features.find((feature) => feature.id === loungeFeatureIds.sofaBase);
    const linearChair = linear.features.find((feature) => feature.id === loungeFeatureIds.leftChairBase);
    const conversationChair = conversation.features.find((feature) => feature.id === loungeFeatureIds.leftChairBase);

    expect(linearSofa?.type).toBe("box");
    if (linearSofa?.type !== "box") return;
    expect(linearSofa.parameters.width).toBe(2_600);
    expect(linearChair?.rotation[1]).toBe(0);
    expect(conversationChair?.rotation[1]).toBe(38);
    expect(linearSofa?.position).not.toEqual(conversationSofa?.position);
  });

  it("keeps furniture proportions tied to the runtime avatar envelope", () => {
    const graph = createLoungeKit().featureGraph!;
    const sofaBase = graph.features.find((feature) => feature.id === loungeFeatureIds.sofaBase);
    const sofaBack = graph.features.find((feature) => feature.id === loungeFeatureIds.sofaBack);
    const seat = graph.features.find((feature) => feature.id === "lounge-sofa-seat-cushion-2");
    const tableTop = graph.features.find((feature) => feature.id === loungeFeatureIds.tableTop);
    const rug = graph.features.find((feature) => feature.id === loungeFeatureIds.rug);

    expect(loungeDimensions.referenceFigureHeight).toBe(1_720);
    expect(loungeDimensions.referenceFigureWidth).toBe(860);
    expect(defaultLoungeParameters.sofaWidth).toBeGreaterThanOrEqual(loungeDimensions.referenceFigureWidth * 3.2);
    expect(loungeDimensions.armchair.width).toBeGreaterThan(loungeDimensions.referenceFigureWidth);
    expect(loungeDimensions.sofa.overallHeight).toBeLessThan(loungeDimensions.referenceFigureHeight / 2);
    expect(loungeDimensions.coffeeTable.height).toBeLessThan(defaultLoungeParameters.seatHeight);
    expect(loungeDimensions.floorLamp.height).toBeLessThan(loungeDimensions.referenceFigureHeight);
    expect(sofaBase?.type).toBe("box");
    expect(sofaBack?.type).toBe("box");
    expect(seat?.type).toBe("box");
    expect(tableTop?.type).toBe("box");
    expect(rug?.type).toBe("box");
    if (sofaBase?.type !== "box" || sofaBack?.type !== "box" || seat?.type !== "box" || tableTop?.type !== "box" || rug?.type !== "box") return;

    expect(sofaBase.position[1] + sofaBase.parameters.height / 2)
      .toBe(seat.position[1] - seat.parameters.height / 2);
    expect(sofaBack.position[1] + sofaBack.parameters.height / 2)
      .toBe(loungeDimensions.sofa.overallHeight);
    expect(tableTop.position[1] + tableTop.parameters.height / 2)
      .toBe(loungeDimensions.coffeeTable.height);
    expect(rug.parameters.height).toBe(loungeDimensions.rug.thickness);
  });

  it("keeps default furniture inside the rug envelope in every layout", () => {
    const rugHalfWidth = defaultLoungeParameters.rugWidth / 2;
    const allowedHalfWidth = rugHalfWidth - loungeDimensions.rug.edgeInset;
    const chairHalfWidth = loungeDimensions.armchair.width / 2;
    const chairHalfDepth = loungeDimensions.armchair.depth / 2;

    for (const layout of ["conversation", "linear", "compact"] as const) {
      const transforms = getLoungeLayoutTransforms({ layout });
      const radians = transforms.rightChair.rotationY * Math.PI / 180;
      const rotatedHalfWidth = Math.abs(Math.cos(radians)) * chairHalfWidth
        + Math.abs(Math.sin(radians)) * chairHalfDepth;
      expect(Math.abs(transforms.rightChair.position[0]) + rotatedHalfWidth)
        .toBeLessThanOrEqual(allowedHalfWidth);
      expect(Math.abs(transforms.leftChair.position[0]) + rotatedHalfWidth)
        .toBeLessThanOrEqual(allowedHalfWidth);
    }
  });

  it("keeps the rug, furniture feet, lamp and planter on the zero ground baseline", () => {
    const graph = createLoungeKit().featureGraph!;
    const grounded = graph.features.filter((feature) => (
      feature.id === loungeFeatureIds.rug
      || feature.id === loungeFeatureIds.lampBase
      || feature.id === loungeFeatureIds.plantPot
      || feature.id.includes("-leg-")
    ));

    expect(loungeManifest.placement.groundY).toBe(0);
    expect(grounded.length).toBeGreaterThan(12);
    expect(grounded.every((feature) => {
      if (feature.type === "box") return feature.position[1] - feature.parameters.height / 2 === 0;
      if (feature.type === "cylinder") return feature.position[1] - feature.parameters.height / 2 === 0;
      return false;
    })).toBe(true);
  });

  it("provides five independent seat anchors with matching orientation", () => {
    const seatAnchors = loungeManifest.anchors.filter((anchor) => anchor.kind === "seat");
    const sofaSeatXs = seatAnchors
      .filter((anchor) => anchor.id.startsWith("lounge-sofa-seat-"))
      .map((anchor) => anchor.position[0])
      .sort((left, right) => left - right);
    const transforms = getLoungeLayoutTransforms();

    expect(seatAnchors).toHaveLength(5);
    expect(new Set(seatAnchors.map((anchor) => anchor.position.join(","))).size).toBe(5);
    expect(seatAnchors.every((anchor) => anchor.position[1] === defaultLoungeParameters.seatHeight)).toBe(true);
    expect(sofaSeatXs[1]! - sofaSeatXs[0]!).toBeGreaterThanOrEqual(loungeDimensions.referenceFigureWidth * 0.98);
    expect(sofaSeatXs[2]! - sofaSeatXs[1]!).toBeGreaterThanOrEqual(loungeDimensions.referenceFigureWidth * 0.98);
    expect(seatAnchors.find((anchor) => anchor.id === "lounge-left-chair-seat")?.rotation[1])
      .toBe(transforms.leftChair.rotationY);
    expect(seatAnchors.find((anchor) => anchor.id === "lounge-right-chair-seat")?.rotation[1])
      .toBe(transforms.rightChair.rotationY);
  });

  it("binds colliders and interaction anchors to independent components", () => {
    expect(loungeManifest.colliders.map((collider) => collider.groupId)).toEqual([
      loungeGroupIds.sofa,
      loungeGroupIds.leftChair,
      loungeGroupIds.rightChair,
      loungeGroupIds.coffeeTable,
      loungeGroupIds.floorLamp,
      loungeGroupIds.plant,
    ]);
    expect(loungeManifest.anchors.find((anchor) => anchor.id === "lounge-floor-lamp-toggle"))
      .toMatchObject({
        kind: "interaction",
        featureId: loungeFeatureIds.lampLight,
        groupId: loungeGroupIds.floorLamp,
        tags: ["power", "light", "toggle"],
      });
    expect(loungeManifest.colliders.find((collider) => collider.id === "lounge-sofa-collider")?.size)
      .toEqual([
        defaultLoungeParameters.sofaWidth,
        loungeDimensions.sofa.overallHeight,
        loungeDimensions.sofa.depth,
      ]);
    expect(loungeManifest.colliders.find((collider) => collider.id === "lounge-coffee-table-collider")?.size[1])
      .toBe(loungeDimensions.coffeeTable.height);
  });

  it("changes the lamp appearance without changing its stable id", () => {
    const enabled = createLoungeKit({ lampOn: true }).featureGraph!.features
      .find((feature) => feature.id === loungeFeatureIds.lampLight);
    const disabled = createLoungeKit({ lampOn: false }).featureGraph!.features
      .find((feature) => feature.id === loungeFeatureIds.lampLight);

    expect(enabled?.id).toBe(disabled?.id);
    expect(enabled?.appearance?.color).not.toBe(disabled?.appearance?.color);
  });

  it("uses smaller mobile lod while preserving every primary silhouette", () => {
    const desktop = loungeManifest.lod.find((profile) => profile.device === "desktop")!;
    const mobile = loungeManifest.lod.find((profile) => profile.device === "mobile")!;
    const mobileNear = mobile.levels[0]!;
    const mobileSilhouette = mobile.levels[1]!;

    expect(mobileNear.featureIds!.length).toBeLessThan(desktop.levels[0]!.featureIds!.length);
    expect(mobileNear.triangleBudget!).toBeLessThan(desktop.levels[0]!.triangleBudget!);
    expect(mobileSilhouette.featureIds).toEqual(expect.arrayContaining([
      loungeFeatureIds.sofaBase,
      loungeFeatureIds.leftChairBase,
      loungeFeatureIds.rightChairBase,
      loungeFeatureIds.tableTop,
      loungeFeatureIds.rug,
      loungeFeatureIds.lampPole,
      loungeFeatureIds.plantPot,
    ]));
  });
});
