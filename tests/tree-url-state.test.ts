import { describe, expect, it } from "vitest";
import { readTreeUrlState, writeTreeUrlState } from "../apps/web/src/treeUrlState";

describe("tree URL state", () => {
  it("round-trips selection and expansion state with stable ids", () => {
    const href = writeTreeUrlState("http://127.0.0.1:4311/?theme=light#viewport", {
      modelId: "model-1",
      selectedFeatureIds: ["feature-1", "feature-2"],
      selectedGroupId: null,
      projectExpanded: true,
      modelsExpanded: true,
      expandedModelIds: ["model-1"],
      expandedGroupIds: ["group-1", "group-2"],
    });
    expect(href).toContain("theme=light");
    expect(href).toContain("#viewport");
    expect(readTreeUrlState(href)).toEqual({
      modelId: "model-1",
      selectedFeatureIds: ["feature-1", "feature-2"],
      selectedGroupId: null,
      projectExpanded: true,
      modelsExpanded: true,
      expandedModelIds: ["model-1"],
      expandedGroupIds: ["group-1", "group-2"],
    });
  });

  it("stores an explicit collapsed tree and a selected group", () => {
    const href = writeTreeUrlState("http://127.0.0.1:4311/", {
      modelId: "model-1",
      selectedFeatureIds: ["ignored-while-a-group-is-selected"],
      selectedGroupId: "group-1",
      projectExpanded: false,
      modelsExpanded: false,
      expandedModelIds: [],
      expandedGroupIds: [],
    });
    expect(readTreeUrlState(href)).toEqual({
      modelId: "model-1",
      selectedFeatureIds: [],
      selectedGroupId: "group-1",
      projectExpanded: false,
      modelsExpanded: false,
      expandedModelIds: [],
      expandedGroupIds: [],
    });
  });

  it("keeps the existing default behavior when no tree marker is present", () => {
    expect(readTreeUrlState("http://127.0.0.1:4311/?model=legacy")).toBeNull();
  });
});
