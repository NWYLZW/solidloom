import { describe, expect, it } from "vitest";
import { createContainerProductState, reconcileContainerInventory } from "./containerInventory";

describe("container inventory", () => {
  it("derives product stock from owned entity instances", () => {
    expect(createContainerProductState([
      { id: "water", name: "气泡水", unitPrice: 6 },
      { id: "bar", name: "能量棒", unitPrice: 12 },
    ], [
      { id: "water-1", name: "气泡水", productId: "water" },
      { id: "water-2", name: "气泡水", productId: "water" },
    ])).toEqual([
      { id: "water", name: "气泡水", stock: 2, unitPrice: 6 },
      { id: "bar", name: "能量棒", stock: 0, unitPrice: 12 },
    ]);
  });

  it("reconciles admin catalog and stock edits into entity instances", () => {
    const result = reconcileContainerInventory({
      capacity: 8,
      currentItems: [{ id: "water-1", name: "旧名称", productId: "water" }],
      requestedProducts: [
        { id: "water", name: "气泡水", stock: 3, unitPrice: 6.5 },
        { id: "tea", name: "柑橘茶", stock: 2, unitPrice: 8 },
      ],
    });
    expect(result.products).toEqual([
      { id: "water", name: "气泡水", unitPrice: 6.5 },
      { id: "tea", name: "柑橘茶", unitPrice: 8 },
    ]);
    expect(result.items).toHaveLength(5);
    expect(result.items[0]).toEqual({ id: "water-1", name: "气泡水", productId: "water" });
    expect(result.items.filter((item) => item.productId === "tea")).toHaveLength(2);
  });
});
