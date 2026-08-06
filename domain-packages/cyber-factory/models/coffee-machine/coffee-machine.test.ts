import { validateModelAssetDefinition } from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
  coffeeMachineDefinition,
  coffeeMachineFeatureIds,
  coffeeMachineManifest,
  coffeeMachineModule,
  createCoffeeMachine,
  defaultCoffeeMachineParameters,
} from "./index.js";

describe("parameterized coffee machine asset", () => {
  it("satisfies the shared asset contract after system registration", () => {
    expect(validateModelAssetDefinition(coffeeMachineDefinition)).toEqual({ valid: true, issues: [] });
    expect(coffeeMachineModule.status).toBe("available");
    expect(coffeeMachineModule.id).toBe("cyber-factory-coffee-machine");
  });

  it("keeps stable unique IDs and a zero ground baseline", () => {
    const graph = coffeeMachineDefinition.createModel().featureGraph!;
    const ids = [
      ...graph.features.map((feature) => feature.id),
      ...(graph.groups ?? []).map((group) => group.id),
      ...(graph.joints ?? []).map((joint) => joint.id),
      ...coffeeMachineManifest.anchors.map((anchor) => anchor.id),
      ...coffeeMachineManifest.colliders.map((collider) => collider.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id))).toBe(true);
    expect(coffeeMachineManifest.placement.groundY).toBe(0);

    const feet = graph.features.filter((feature) => (
      feature.id === coffeeMachineFeatureIds.leftFoot
      || feature.id === coffeeMachineFeatureIds.rightFoot
    ));
    expect(feet).toHaveLength(2);
    expect(feet.every((feature) => feature.type === "box"
      && feature.position[1] - feature.parameters.height / 2 === 0)).toBe(true);
  });

  it("clamps dimensions and rebuilds geometry from parameters", () => {
    const compact = createCoffeeMachine({ width: 200, height: 400, depth: 300, finish: "porcelain" });
    const large = createCoffeeMachine({ width: 500, height: 650, depth: 540, finish: "cobalt" });
    const compactBody = compact.featureGraph!.features.find((feature) => feature.id === coffeeMachineFeatureIds.body);
    const largeBody = large.featureGraph!.features.find((feature) => feature.id === coffeeMachineFeatureIds.body);

    expect(compactBody?.type).toBe("box");
    expect(largeBody?.type).toBe("box");
    if (compactBody?.type !== "box" || largeBody?.type !== "box") return;
    expect(compactBody.parameters.width).toBe(320);
    expect(compactBody.parameters.height + 24).toBe(460);
    expect(compactBody.parameters.depth).toBe(360);
    expect(largeBody.parameters.width).toBe(500);
    expect(largeBody.parameters.height + 24).toBe(650);
    expect(largeBody.parameters.depth).toBe(540);
    expect(compactBody.appearance?.color).not.toBe(largeBody.appearance?.color);
  });

  it("keeps the industrial silhouette angular with only small safety bevels", () => {
    const graph = coffeeMachineDefinition.createModel().featureGraph!;
    const roundedBoxes = graph.features.filter((feature) => (
      feature.type === "box" && feature.parameters.cornerRadius !== undefined
    ));
    const body = roundedBoxes.find((feature) => feature.id === coffeeMachineFeatureIds.body);
    const brewHead = roundedBoxes.find((feature) => feature.id === coffeeMachineFeatureIds.brewHead);

    expect(body?.type).toBe("box");
    expect(brewHead?.type).toBe("box");
    if (body?.type !== "box" || brewHead?.type !== "box") return;
    expect(body.parameters.cornerRadius).toBeLessThanOrEqual(8);
    expect(brewHead.parameters.cornerRadius).toBeLessThanOrEqual(4);
    expect(roundedBoxes.every((feature) => (
      feature.type === "box" && feature.parameters.cornerAlgorithm === "circular"
    ))).toBe(true);
  });

  it("provides a dedicated power switch, stateful indicator and semantic anchor", () => {
    const poweredOff = createCoffeeMachine({ powered: false }).featureGraph!;
    const poweredOn = createCoffeeMachine({ powered: true }).featureGraph!;
    const offSwitch = poweredOff.features.find((feature) => feature.id === coffeeMachineFeatureIds.powerSwitch);
    const onSwitch = poweredOn.features.find((feature) => feature.id === coffeeMachineFeatureIds.powerSwitch);
    const offIndicator = poweredOff.features.find((feature) => feature.id === coffeeMachineFeatureIds.statusLight);
    const onIndicator = poweredOn.features.find((feature) => feature.id === coffeeMachineFeatureIds.statusLight);
    const powerAnchor = coffeeMachineManifest.anchors.find((anchor) => anchor.id === "power-toggle");
    const powerParameter = coffeeMachineManifest.parameters.find((parameter) => parameter.id === "powered");

    expect(offSwitch).toBeDefined();
    expect(onSwitch?.appearance?.color).not.toBe(offSwitch?.appearance?.color);
    expect(onIndicator?.appearance?.color).not.toBe(offIndicator?.appearance?.color);
    expect(powerAnchor).toMatchObject({
      kind: "interaction",
      groupId: "coffee-machine-control-group",
      tags: ["power", "toggle"],
    });
    expect(powerParameter).toMatchObject({ type: "boolean", defaultValue: false });
  });

  it("places action anchors outside the body and the cup socket beneath the spout", () => {
    const bodyFront = defaultCoffeeMachineParameters.depth / 2;
    const actionAnchors = coffeeMachineManifest.anchors.filter((anchor) => (
      anchor.id === "brew-coffee" || anchor.id === "power-toggle" || anchor.id === "take-cup"
    ));
    expect(actionAnchors.every((anchor) => anchor.position[2] > bodyFront)).toBe(true);

    const graph = coffeeMachineDefinition.createModel().featureGraph!;
    const spout = graph.features.find((feature) => feature.id === coffeeMachineFeatureIds.spout);
    const cupSocket = coffeeMachineManifest.anchors.find((anchor) => anchor.id === "cup-socket")!;
    expect(spout).toBeDefined();
    expect(cupSocket.position[0]).toBe(spout!.position[0]);
    expect(cupSocket.position[1]).toBeLessThan(spout!.position[1]);
  });

  it("marks the front approach anchor as the planned proximity menu trigger", () => {
    const approachAnchor = coffeeMachineManifest.anchors.find((anchor) => anchor.id === "front-approach");

    expect(approachAnchor).toMatchObject({
      kind: "approach",
      tags: ["navigation", "front", "proximity", "menu-trigger"],
    });
    expect(coffeeMachineManifest.version).toBe("1.2.0");
  });

  it("uses a smaller mobile LOD while preserving the primary silhouette", () => {
    const desktopFull = coffeeMachineManifest.lod.find((profile) => profile.device === "desktop")!.levels[0]!;
    const mobileNear = coffeeMachineManifest.lod.find((profile) => profile.device === "mobile")!.levels[0]!;
    const silhouette = coffeeMachineManifest.lod.find((profile) => profile.device === "mobile")!.levels[1]!;

    expect(mobileNear.featureIds!.length).toBeLessThan(desktopFull.featureIds!.length);
    expect(mobileNear.triangleBudget!).toBeLessThan(desktopFull.triangleBudget!);
    expect(silhouette.featureIds).toEqual(expect.arrayContaining([
      coffeeMachineFeatureIds.body,
      coffeeMachineFeatureIds.brewHead,
      coffeeMachineFeatureIds.tray,
    ]));
    expect(mobileNear.featureIds).toEqual(expect.arrayContaining([
      coffeeMachineFeatureIds.powerSwitch,
      coffeeMachineFeatureIds.statusLight,
    ]));
  });
});
