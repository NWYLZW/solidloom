export interface TreeUrlState {
  modelId: string | null;
  selectedFeatureIds: string[];
  selectedGroupId: string | null;
  projectExpanded: boolean;
  modelsExpanded: boolean;
  expandedModelIds: string[];
  expandedGroupIds: string[];
}

const treeParameterNames = [
  "tree",
  "model",
  "group",
  "feature",
  "project",
  "models",
  "openModel",
  "openGroup",
] as const;

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function readTreeUrlState(href: string): TreeUrlState | null {
  const url = new URL(href, "http://localhost");
  if (url.searchParams.get("tree") !== "1") return null;
  return {
    modelId: url.searchParams.get("model"),
    selectedFeatureIds: uniqueValues(url.searchParams.getAll("feature")),
    selectedGroupId: url.searchParams.get("group"),
    projectExpanded: url.searchParams.get("project") !== "closed",
    modelsExpanded: url.searchParams.get("models") !== "closed",
    expandedModelIds: uniqueValues(url.searchParams.getAll("openModel")),
    expandedGroupIds: uniqueValues(url.searchParams.getAll("openGroup")),
  };
}

export function writeTreeUrlState(href: string, state: TreeUrlState) {
  const url = new URL(href, "http://localhost");
  for (const name of treeParameterNames) url.searchParams.delete(name);
  url.searchParams.set("tree", "1");
  if (state.modelId) url.searchParams.set("model", state.modelId);
  if (state.selectedGroupId) {
    url.searchParams.set("group", state.selectedGroupId);
  } else {
    for (const featureId of uniqueValues(state.selectedFeatureIds)) {
      url.searchParams.append("feature", featureId);
    }
  }
  url.searchParams.set("project", state.projectExpanded ? "open" : "closed");
  url.searchParams.set("models", state.modelsExpanded ? "open" : "closed");
  for (const modelId of uniqueValues(state.expandedModelIds)) {
    url.searchParams.append("openModel", modelId);
  }
  for (const groupId of uniqueValues(state.expandedGroupIds)) {
    url.searchParams.append("openGroup", groupId);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
