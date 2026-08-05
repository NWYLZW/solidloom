import { validateModelAssetDefinition } from "@solidloom/shared";
import { describe, expect, it } from "vitest";
import {
  createSnackCabinet,
  defaultSnackCabinetParameters,
  snackCabinetDefinition,
  snackCabinetFeatureIds,
  snackCabinetManifest,
  snackCabinetModule,
  snackCabinetProductFeaturePrefix,
} from "./index.js";

describe("parameterized snack cabinet asset", () => {
  it("satisfies the shared asset contract as an available model", () => {
    expect(validateModelAssetDefinition(snackCabinetDefinition)).toEqual({ valid: true, issues: [] });
    expect(snackCabinetModule.status).toBe("available");
    expect(snackCabinetModule.id).toBe("cyber-factory-snack-cabinet");
  });

  it("keeps stable unique IDs and a zero ground baseline", () => {
    const graph = snackCabinetDefinition.createModel().featureGraph!;
    const ids = [
      ...graph.features.map((feature) => feature.id),
      ...(graph.groups ?? []).map((group) => group.id),
      ...(graph.joints ?? []).map((joint) => joint.id),
      ...snackCabinetManifest.anchors.map((anchor) => anchor.id),
      ...snackCabinetManifest.colliders.map((collider) => collider.id),
    ];

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id))).toBe(true);
    expect(snackCabinetManifest.placement.groundY).toBe(0);

    const base = graph.features.find((feature) => feature.id === snackCabinetFeatureIds.base);
    expect(base?.type).toBe("box");
    if (base?.type !== "box") return;
    expect(base.position[1] - base.parameters.height / 2).toBe(0);
  });

  it("clamps dimensions and rebuilds the cabinet from parameters", () => {
    const compact = createSnackCabinet({ width: 500, height: 1200, depth: 300, finish: "porcelain" });
    const large = createSnackCabinet({ width: 1180, height: 2240, depth: 700, finish: "sage" });
    const compactBase = compact.featureGraph!.features.find((feature) => feature.id === snackCabinetFeatureIds.base);
    const largeBase = large.featureGraph!.features.find((feature) => feature.id === snackCabinetFeatureIds.base);
    const compactTop = compact.featureGraph!.features.find((feature) => feature.id === snackCabinetFeatureIds.top);
    const largeTop = large.featureGraph!.features.find((feature) => feature.id === snackCabinetFeatureIds.top);

    expect(compactBase?.type).toBe("box");
    expect(largeBase?.type).toBe("box");
    expect(compactTop?.type).toBe("box");
    expect(largeTop?.type).toBe("box");
    if (compactBase?.type !== "box" || largeBase?.type !== "box"
      || compactTop?.type !== "box" || largeTop?.type !== "box") return;

    expect(compactBase.parameters.width).toBe(720);
    expect(compactTop.position[1] + compactTop.parameters.height / 2).toBe(1600);
    expect(compactBase.parameters.depth).toBe(440);
    expect(largeBase.parameters.width).toBe(1180);
    expect(largeTop.position[1] + largeTop.parameters.height / 2).toBe(2240);
    expect(largeBase.parameters.depth).toBe(700);
    expect(compactBase.appearance?.color).not.toBe(largeBase.appearance?.color);

    const compactProducts = compact.featureGraph!.features.filter((feature) => feature.id.startsWith(snackCabinetProductFeaturePrefix));
    const largeProducts = large.featureGraph!.features.filter((feature) => feature.id.startsWith(snackCabinetProductFeaturePrefix));
    expect(largeProducts.length).toBeGreaterThan(compactProducts.length);
    expect(new Set([...compactProducts, ...largeProducts].map((feature) => (
      feature.type === "box" ? feature.parameters.width : undefined
    )))).toEqual(new Set([76]));
  });

  it("accepts externally supplied shelf contents without repeating exact stock", () => {
    const model = createSnackCabinet({
      inventory: [{
        id: "custom-drinks",
        fillMode: "exact",
        products: [
          { id: "apple-juice", label: "苹果汁", color: "#B8D45A", height: 160 },
          { id: "black-coffee", label: "黑咖啡", color: "#49352E", height: 172, material: "metal" },
        ],
      }],
    });
    const products = model.featureGraph!.features.filter((feature) => feature.id.startsWith(snackCabinetProductFeaturePrefix));

    expect(products).toHaveLength(2);
    expect(products.map((feature) => feature.name)).toEqual(["第 1 层 · 苹果汁", "第 1 层 · 黑咖啡"]);
    expect(products.map((feature) => feature.appearance?.color)).toEqual(["#B8D45A", "#49352E"]);
  });

  it("exposes distinct selection, pickup, stock and refill semantics", () => {
    const requiredAnchors = [
      "snack-cabinet-select-item",
      "snack-cabinet-pickup-item",
      "snack-cabinet-stock-socket",
      "snack-cabinet-refill-stock",
    ];
    expect(snackCabinetManifest.anchors.map((anchor) => anchor.id)).toEqual(
      expect.arrayContaining(requiredAnchors),
    );

    const frontAnchors = snackCabinetManifest.anchors.filter((anchor) => (
      anchor.id === "snack-cabinet-select-item" || anchor.id === "snack-cabinet-pickup-item"
    ));
    expect(frontAnchors.every((anchor) => (
      anchor.position[2] > defaultSnackCabinetParameters.depth / 2
    ))).toBe(true);

    const refillAnchor = snackCabinetManifest.anchors.find((anchor) => anchor.id === "snack-cabinet-refill-stock")!;
    expect(refillAnchor.position[2]).toBeLessThan(-defaultSnackCabinetParameters.depth / 2);
  });

  it("preserves glass and inventory layers while reducing the mobile draw budget", () => {
    const graph = snackCabinetDefinition.createModel().featureGraph!;
    const glassDoor = graph.features.find((feature) => feature.id === snackCabinetFeatureIds.glassDoor);
    const stockRows = graph.features.filter((feature) => feature.id.startsWith(snackCabinetProductFeaturePrefix));
    expect(glassDoor?.appearance?.material).toBe("glass");
    expect(stockRows).toHaveLength(32);
    expect(new Set(stockRows.map((feature) => feature.name.split(" · ")[0]))).toEqual(new Set([
      "第 1 层",
      "第 2 层",
      "第 3 层",
      "第 4 层",
    ]));

    const desktopFull = snackCabinetManifest.lod.find((profile) => profile.device === "desktop")!.levels[0]!;
    const mobileNear = snackCabinetManifest.lod.find((profile) => profile.device === "mobile")!.levels[0]!;
    const mobileSilhouette = snackCabinetManifest.lod.find((profile) => profile.device === "mobile")!.levels[1]!;

    expect(mobileNear.featureIds!.length).toBeLessThan(desktopFull.featureIds!.length);
    expect(mobileNear.triangleBudget!).toBeLessThan(desktopFull.triangleBudget!);
    expect(mobileSilhouette.featureIds).toEqual(expect.arrayContaining([
      snackCabinetFeatureIds.base,
      snackCabinetFeatureIds.glassDoor,
      snackCabinetFeatureIds.pickupRecess,
    ]));
  });
});
