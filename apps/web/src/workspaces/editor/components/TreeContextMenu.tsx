import { ChevronDown, ChevronRight, Folder, FolderMinus, FolderOpen, Layers3, Link2, Pencil, Plus } from "lucide-react";
import type { FeatureGroup, ModelRecord } from "@solidloom/shared";
import type { RefObject } from "react";

export type TreeMenuTarget =
  | { kind: "tree" }
  | { kind: "model"; modelId: string }
  | { kind: "reference"; referenceId: string }
  | { kind: "feature"; featureId: string }
  | { kind: "selection"; featureIds: string[] }
  | { kind: "group"; groupId: string };

export interface TreeContextMenuState {
  target: TreeMenuTarget;
  x: number;
  y: number;
}

interface TreeContextMenuProps {
  collapsed: boolean;
  contextFeatureIds: string[];
  contextGroupId: string | null;
  currentModel: ModelRecord | null;
  featureGroups: FeatureGroup[];
  labels: {
    addModelReference: string;
    collapseTree: string;
    createGroup: string;
    createModel: string;
    dissolveGroup: string;
    expandTree: string;
    moveToGroup: string;
    removeFromGroup: string;
    removeModelReference: string;
    renameProject: string;
  };
  menu: TreeContextMenuState | null;
  menuRef: RefObject<HTMLDivElement | null>;
  modelsExpanded: boolean;
  onAddModelReference: (modelId: string) => void;
  onClose: () => void;
  onCreateGroup: (featureIds: string[]) => void;
  onCreateModel: () => void;
  onDissolveGroup: (groupId: string) => void;
  onMoveToGroup: (featureIds: string[], groupId: string) => void;
  onRemoveFromGroups: (featureIds: string[]) => void;
  onRemoveModelReference: (referenceId: string) => void;
  onRenameProject: () => void;
  onToggleTree: (expanded: boolean) => void;
  projectExpanded: boolean;
}

export function TreeContextMenu({
  collapsed,
  contextFeatureIds,
  contextGroupId,
  currentModel,
  featureGroups,
  labels,
  menu,
  menuRef,
  modelsExpanded,
  onAddModelReference,
  onClose,
  onCreateGroup,
  onCreateModel,
  onDissolveGroup,
  onMoveToGroup,
  onRemoveFromGroups,
  onRemoveModelReference,
  onRenameProject,
  onToggleTree,
  projectExpanded,
}: TreeContextMenuProps) {
  if (!menu) return null;

  const act = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="tree-context-menu" ref={menuRef} role="menu" style={{ left: menu.x, top: menu.y }}>
      {!collapsed && menu.target.kind === "tree" && (
        <button type="button" role="menuitem" onClick={() => act(onRenameProject)}>
          <Pencil size={15} />
          <span>{labels.renameProject}</span>
        </button>
      )}

      {!collapsed && (menu.target.kind === "tree" || menu.target.kind === "model") && (
        <button type="button" role="menuitem" onClick={() => act(onCreateModel)}>
          <Plus size={15} />
          <span>{labels.createModel}</span>
        </button>
      )}

      {!collapsed && currentModel && menu.target.kind === "model" && menu.target.modelId !== currentModel.id && (
        <button type="button" role="menuitem" onClick={() => act(() => onAddModelReference(menu.target.kind === "model" ? menu.target.modelId : ""))}>
          <Link2 size={15} />
          <span>{labels.addModelReference}</span>
        </button>
      )}

      {menu.target.kind === "reference" && (
        <button type="button" role="menuitem" onClick={() => act(() => onRemoveModelReference(menu.target.kind === "reference" ? menu.target.referenceId : ""))}>
          <FolderMinus size={15} />
          <span>{labels.removeModelReference}</span>
        </button>
      )}

      {currentModel && menu.target.kind !== "group" && menu.target.kind !== "reference"
        && (collapsed || menu.target.kind !== "model" || menu.target.modelId === currentModel.id) && (
        <button type="button" role="menuitem" onClick={() => act(() => onCreateGroup(contextFeatureIds))}>
          <Folder size={15} />
          <span>{labels.createGroup}</span>
        </button>
      )}

      {contextFeatureIds.length > 0 && featureGroups.some((group) => group.featureIds.some((id) => contextFeatureIds.includes(id))) && (
        <button type="button" role="menuitem" onClick={() => act(() => onRemoveFromGroups(contextFeatureIds))}>
          <ChevronRight size={15} />
          <span>{labels.removeFromGroup}</span>
        </button>
      )}

      {contextFeatureIds.length > 0 && featureGroups
        .filter((group) => !contextFeatureIds.every((id) => group.featureIds.includes(id)))
        .map((group) => (
          <button type="button" role="menuitem" key={group.id} onClick={() => act(() => onMoveToGroup(contextFeatureIds, group.id))}>
            <FolderOpen size={15} />
            <span>{labels.moveToGroup} · {group.name}</span>
          </button>
        ))}

      {contextGroupId && (
        <button type="button" role="menuitem" onClick={() => act(() => onDissolveGroup(contextGroupId))}>
          <Layers3 size={15} />
          <span>{labels.dissolveGroup}</span>
        </button>
      )}

      {!collapsed && (
        <>
          <div className="context-divider" />
          <button type="button" role="menuitem" onClick={() => act(() => onToggleTree(!projectExpanded || !modelsExpanded))}>
            {projectExpanded && modelsExpanded ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            <span>{projectExpanded && modelsExpanded ? labels.collapseTree : labels.expandTree}</span>
          </button>
        </>
      )}
    </div>
  );
}
