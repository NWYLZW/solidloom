import { Combine, FileBox, Folder, FolderMinus, Layers3, MessageSquareText, Move3D, Plus, Rotate3D, Route, Scaling, Settings2, Slice } from "lucide-react";
import type { TransformMode } from "../../../Viewport3D";
import "../styles/EditorViewportToolbar.css";

export type ViewportObjectTool = Exclude<TransformMode, null> | "plane-cut" | "boolean";

interface EditorViewportToolbarProps {
  activeInspectorTab: "features" | "properties";
  activeObjectTool: ViewportObjectTool | null;
  annotationMode: boolean;
  hasModel: boolean;
  labels: {
    annotationAssist: string;
    booleanTool: string;
    contextTools: string;
    createGroup: string;
    createModel: string;
    dissolveGroup: string;
    metadata: string;
    moveTool: string;
    navigationMode: string;
    parameters: string;
    planeCutTool: string;
    removeFromGroup: string;
    rotateTool: string;
    scaleTool: string;
  };
  modelNavigationEnabled: boolean;
  navigationMode: boolean;
  onAnnotationModeToggle: () => void;
  onCreateGroup: (featureIds?: string[]) => void;
  onCreateModel: () => void;
  onDissolveGroup: (groupId: string) => void;
  onInspectorTabChange: (tab: "features" | "properties") => void;
  onNavigationModeToggle: () => void;
  onRemoveFromGroup: (featureIds: string[]) => void;
  onToggleObjectTool: (tool: ViewportObjectTool) => void;
  selectedFeatureGroup: boolean;
  selectedFeatureId: string | null;
  selectedFeatureIds: string[];
  selectedFeatureCount: number;
  selectedGroupId: string | null;
  selectedReference: boolean;
  selectedViewportCount: number;
}

export function EditorViewportToolbar({ activeInspectorTab, activeObjectTool, annotationMode, hasModel, labels, modelNavigationEnabled, navigationMode, onAnnotationModeToggle, onCreateGroup, onCreateModel, onDissolveGroup, onInspectorTabChange, onNavigationModeToggle, onRemoveFromGroup, onToggleObjectTool, selectedFeatureCount, selectedFeatureGroup, selectedFeatureId, selectedFeatureIds, selectedGroupId, selectedReference, selectedViewportCount }: EditorViewportToolbarProps) {
  const hasNoObjectSelection = selectedFeatureCount === 0 && !selectedGroupId && !selectedReference;
  return (
    <div className="viewport-toolbar" role="toolbar" aria-label={labels.contextTools}>
      <div className="viewport-tool-group" aria-label={labels.contextTools}>
        {!hasModel && <button type="button" aria-label={labels.createModel} title={labels.createModel} onClick={onCreateModel}><Plus size={16} /></button>}
        {hasModel && hasNoObjectSelection && <>
          <button type="button" aria-label={labels.metadata} title={labels.metadata} className={activeInspectorTab === "properties" ? "tool-active" : ""} onClick={() => onInspectorTabChange("properties")}><FileBox size={16} /></button>
          <button type="button" aria-label={labels.createGroup} title={labels.createGroup} onClick={() => onCreateGroup()}><Folder size={16} /></button>
        </>}
        {selectedViewportCount > 0 && <>
          <button type="button" className={activeObjectTool === "translate" ? "tool-active" : ""} aria-label={labels.moveTool} title={`${labels.moveTool} [M]`} onClick={() => onToggleObjectTool("translate")}><Move3D size={16} /></button>
          <button type="button" className={activeObjectTool === "rotate" ? "tool-active" : ""} aria-label={labels.rotateTool} title={`${labels.rotateTool} [R]`} onClick={() => onToggleObjectTool("rotate")}><Rotate3D size={16} /></button>
          <button type="button" className={activeObjectTool === "scale" ? "tool-active" : ""} aria-label={labels.scaleTool} title={`${labels.scaleTool} [Shift+S]`} onClick={() => onToggleObjectTool("scale")}><Scaling size={16} /></button>
          {!selectedReference && <span className="viewport-tool-divider" aria-hidden="true" />}
          {!selectedReference && <button type="button" className={activeObjectTool === "plane-cut" ? "tool-active" : ""} aria-label={labels.planeCutTool} title={labels.planeCutTool} onClick={() => onToggleObjectTool("plane-cut")}><Slice size={16} /></button>}
          {!selectedReference && selectedViewportCount > 1 && <button type="button" className={activeObjectTool === "boolean" ? "tool-active" : ""} aria-label={labels.booleanTool} title={labels.booleanTool} onClick={() => onToggleObjectTool("boolean")}><Combine size={16} /></button>}
          <span className="viewport-tool-divider" aria-hidden="true" />
        </>}
        {selectedFeatureId && <>
          <button type="button" aria-label={labels.parameters} title={labels.parameters} className={activeInspectorTab === "features" ? "tool-active" : ""} onClick={() => onInspectorTabChange("features")}><Settings2 size={16} /></button>
          {selectedFeatureGroup
            ? <button type="button" aria-label={labels.removeFromGroup} title={labels.removeFromGroup} onClick={() => onRemoveFromGroup([selectedFeatureId])}><FolderMinus size={16} /></button>
            : <button type="button" aria-label={labels.createGroup} title={labels.createGroup} onClick={() => onCreateGroup([selectedFeatureId])}><Folder size={16} /></button>}
        </>}
        {selectedFeatureCount > 1 && <button type="button" aria-label={labels.createGroup} title={labels.createGroup} onClick={() => onCreateGroup(selectedFeatureIds)}><Folder size={16} /></button>}
        {selectedGroupId && <button type="button" aria-label={labels.dissolveGroup} title={labels.dissolveGroup} onClick={() => onDissolveGroup(selectedGroupId)}><Layers3 size={16} /></button>}
        {hasModel && <>
          <span className="viewport-tool-divider" aria-hidden="true" />
          {modelNavigationEnabled && <button type="button" className={navigationMode ? "tool-active" : ""} aria-label={labels.navigationMode} aria-pressed={navigationMode} title={labels.navigationMode} onClick={onNavigationModeToggle}><Route size={16} /></button>}
          <button type="button" className={annotationMode ? "tool-active" : ""} aria-label={labels.annotationAssist} aria-pressed={annotationMode} title={labels.annotationAssist} onClick={onAnnotationModeToggle}><MessageSquareText size={16} /></button>
        </>}
      </div>
    </div>
  );
}
