import {
  ChevronDown,
  ChevronRight,
  Cuboid,
  Cylinder,
  FileBox,
  Folder,
  FolderOpen,
  FolderTree,
  Layers3,
  Link2,
  Play,
} from "lucide-react";
import type {
  FeatureGroup,
  ModelFeature,
  ModelRecord,
  ModelReferenceInstance,
} from "@solidloom/shared";
import "../styles/ProjectLibrary.css";

interface ProjectTreeProps {
  draftModel: ModelRecord | null;
  expandedGroupIds: string[];
  expandedModelIds: string[];
  featureGroups: FeatureGroup[];
  labels: {
    emptyModels: string;
    emptyScenes: string;
    models: string;
    projectTree: string;
    revision: string;
    runScene: string;
    scenes: string;
  };
  modelReferences: ModelReferenceInstance[];
  models: ModelRecord[];
  modelsExpanded: boolean;
  onExpandedGroupIdsChange: (ids: string[]) => void;
  onExpandedModelIdsChange: (ids: string[]) => void;
  onFeatureContextMenu: (featureId: string, x: number, y: number) => void;
  onFeatureSelect: (featureId: string, additive: boolean) => void;
  onGroupContextMenu: (group: FeatureGroup, x: number, y: number) => void;
  onGroupSelect: (group: FeatureGroup, additive: boolean) => void;
  onModelClick: (model: ModelRecord, isCurrentModel: boolean) => void;
  onModelContextMenu: (modelId: string, x: number, y: number) => void;
  onModelsExpandedChange: (expanded: boolean) => void;
  onProjectExpandedChange: (expanded: boolean) => void;
  onScenePlay: (sceneId: string) => void;
  onScenesExpandedChange: (expanded: boolean) => void;
  onReferenceContextMenu: (referenceId: string, x: number, y: number) => void;
  onReferenceSelect: (referenceId: string) => void;
  onTreeContextMenu: (x: number, y: number) => void;
  projectExpanded: boolean;
  projectName: string;
  scenesExpanded: boolean;
  selectedFeatureIds: string[];
  selectedGroupId: string | null;
  selectedReferenceId: string | null;
  ungroupedFeatures: ModelFeature[];
}

export function ProjectTree({
  draftModel,
  expandedGroupIds,
  expandedModelIds,
  featureGroups,
  labels,
  modelReferences,
  models,
  modelsExpanded,
  onExpandedGroupIdsChange,
  onExpandedModelIdsChange,
  onFeatureContextMenu,
  onFeatureSelect,
  onGroupContextMenu,
  onGroupSelect,
  onModelClick,
  onModelContextMenu,
  onModelsExpandedChange,
  onProjectExpandedChange,
  onScenePlay,
  onScenesExpandedChange,
  onReferenceContextMenu,
  onReferenceSelect,
  onTreeContextMenu,
  projectExpanded,
  projectName,
  scenesExpanded,
  selectedFeatureIds,
  selectedGroupId,
  selectedReferenceId,
  ungroupedFeatures,
}: ProjectTreeProps) {
  const assetModels = models.filter((model) => model.kind === "asset");
  const scenes = models.filter((model) => model.kind === "scene");

  return (
    <div
      className="project-tree"
      role="tree"
      aria-label={labels.projectTree}
      aria-multiselectable="true"
      onContextMenu={(event) => {
        event.preventDefault();
        onTreeContextMenu(event.clientX, event.clientY);
      }}
    >
      <button className="tree-row tree-root" data-depth="0" type="button" role="treeitem" aria-expanded={projectExpanded} onClick={() => onProjectExpandedChange(!projectExpanded)}>
        {projectExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <FolderTree size={16} />
        <span>{projectName}</span>
      </button>

      {projectExpanded && (
        <div className="tree-group" role="group">
          <button className="tree-row" data-depth="1" type="button" role="treeitem" aria-expanded={modelsExpanded} onClick={() => onModelsExpandedChange(!modelsExpanded)}>
            {modelsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {modelsExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
            <span>{labels.models}</span>
          </button>

          {modelsExpanded && (
            <div className="tree-group tree-models" role="group">
              {assetModels.length > 0 ? assetModels.map((model) => {
                const isCurrentModel = draftModel?.id === model.id;
                const isSelectedModel = isCurrentModel && selectedFeatureIds.length === 0 && !selectedGroupId && !selectedReferenceId;
                const isModelExpanded = isCurrentModel && expandedModelIds.includes(model.id);
                return (
                  <div className="tree-model-entry" role="none" key={model.id}>
                    <button
                      className={`tree-row tree-model${isSelectedModel ? " selected" : ""}`}
                      data-depth="2"
                      type="button"
                      role="treeitem"
                      aria-expanded={isModelExpanded}
                      aria-selected={isSelectedModel}
                      onClick={() => onModelClick(model, isCurrentModel)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onModelContextMenu(model.id, event.clientX, event.clientY);
                      }}
                    >
                      {isModelExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <FileBox size={15} />
                      <span>{model.name}</span>
                      <small>{labels.revision} {model.revision}</small>
                    </button>

                    {isModelExpanded && draftModel && (
                      <div className="tree-group tree-features" role="group">
                        {modelReferences.map((reference) => {
                          const source = models.find((item) => item.id === reference.modelId);
                          const isSelected = selectedReferenceId === reference.id;
                          return (
                            <button
                              className={`tree-row tree-feature tree-reference${isSelected ? " selected" : ""}`}
                              data-depth="3"
                              type="button"
                              role="treeitem"
                              aria-selected={isSelected}
                              key={reference.id}
                              onClick={() => onReferenceSelect(reference.id)}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onReferenceContextMenu(reference.id, event.clientX, event.clientY);
                              }}
                            >
                              <span className="tree-spacer" />
                              <Link2 size={15} />
                              <span>{reference.name}</span>
                              <small>{source ? `${labels.revision} ${source.revision}` : "!"}</small>
                            </button>
                          );
                        })}

                        {featureGroups.map((group) => {
                          const isGroupExpanded = expandedGroupIds.includes(group.id);
                          const isGroupSelected = selectedGroupId === group.id
                            || (group.featureIds.length > 0 && group.featureIds.every((id) => selectedFeatureIds.includes(id)));
                          return (
                            <div className="tree-group-entry" role="none" key={group.id}>
                              <button
                                className={`tree-row tree-feature-group${isGroupSelected ? " selected" : ""}`}
                                data-depth="3"
                                type="button"
                                role="treeitem"
                                aria-expanded={isGroupExpanded}
                                aria-selected={isGroupSelected}
                                onClick={(event) => {
                                  const additive = event.metaKey || event.ctrlKey;
                                  onGroupSelect(group, additive);
                                  if (!additive && isGroupSelected) {
                                    onExpandedGroupIdsChange(isGroupExpanded
                                      ? expandedGroupIds.filter((id) => id !== group.id)
                                      : [...expandedGroupIds, group.id]);
                                  } else if (!isGroupExpanded) {
                                    onExpandedGroupIdsChange([...expandedGroupIds, group.id]);
                                  }
                                }}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onGroupContextMenu(group, event.clientX, event.clientY);
                                }}
                              >
                                {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                {isGroupExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                                <span>{group.name}</span>
                                <small>{group.featureIds.length}</small>
                              </button>
                              {isGroupExpanded && (
                                <div className="tree-group" role="group">
                                  {group.featureIds.map((featureId) => {
                                    const feature = draftModel.featureGraph.features.find((item) => item.id === featureId);
                                    if (!feature) return null;
                                    return (
                                      <FeatureTreeRow
                                        depth={4}
                                        feature={feature}
                                        key={feature.id}
                                        onContextMenu={onFeatureContextMenu}
                                        onSelect={onFeatureSelect}
                                        selected={selectedFeatureIds.includes(feature.id)}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {ungroupedFeatures.map((feature) => (
                          <FeatureTreeRow
                            depth={3}
                            feature={feature}
                            key={feature.id}
                            onContextMenu={onFeatureContextMenu}
                            onSelect={onFeatureSelect}
                            selected={selectedFeatureIds.includes(feature.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="tree-empty" data-depth="2" role="treeitem">
                  <span className="tree-spacer" />
                  <span className="tree-empty-dot" />
                  <span>{labels.emptyModels}</span>
                </div>
              )}
            </div>
          )}

          <button className="tree-row" data-depth="1" type="button" role="treeitem" aria-expanded={scenesExpanded} onClick={() => onScenesExpandedChange(!scenesExpanded)}>
            {scenesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {scenesExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
            <span>{labels.scenes}</span>
          </button>

          {scenesExpanded && (
            <div className="tree-group tree-scenes" role="group">
              {scenes.length > 0 ? scenes.map((scene) => (
                <button
                  aria-label={`${labels.runScene}：${scene.name}`}
                  className="tree-row tree-scene"
                  data-depth="2"
                  key={scene.id}
                  role="treeitem"
                  type="button"
                  onClick={() => onScenePlay(scene.id)}
                >
                  <span className="tree-spacer" />
                  <Play size={15} />
                  <span>{scene.name}</span>
                  <small>{labels.runScene}</small>
                </button>
              )) : (
                <div className="tree-empty" data-depth="2" role="treeitem">
                  <span className="tree-spacer" />
                  <span className="tree-empty-dot" />
                  <span>{labels.emptyScenes}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FeatureTreeRowProps {
  depth: 3 | 4;
  feature: ModelFeature;
  onContextMenu: (featureId: string, x: number, y: number) => void;
  onSelect: (featureId: string, additive: boolean) => void;
  selected: boolean;
}

function FeatureTreeRow({ depth, feature, onContextMenu, onSelect, selected }: FeatureTreeRowProps) {
  return (
    <button
      className={`tree-row tree-feature${selected ? " selected" : ""}`}
      data-depth={depth}
      type="button"
      role="treeitem"
      aria-selected={selected}
      onClick={(event) => onSelect(feature.id, event.metaKey || event.ctrlKey)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu(feature.id, event.clientX, event.clientY);
      }}
    >
      <span className="tree-spacer" />
      {feature.type === "box" ? <Cuboid size={15} /> : feature.type === "cylinder" ? <Cylinder size={15} /> : <Layers3 size={15} />}
      <span>{feature.name}</span>
    </button>
  );
}
