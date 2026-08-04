import { FileBox, Layers3, PanelLeftClose, PanelLeftOpen, Redo2, Save, Undo2 } from "lucide-react";
import "./TopBar.css";

interface TopBarProps {
  canRedo: boolean;
  canSave: boolean;
  canUndo: boolean;
  collapsed: boolean;
  labels: {
    collapseLibrary: string;
    expandLibrary: string;
    noModel: string;
    redo: string;
    revision: string;
    save: string;
    undo: string;
  };
  modelName?: string | undefined;
  onCollapseChange: (collapsed: boolean) => void;
  onRedo: () => void;
  onSave: () => void;
  onUndo: () => void;
  revision?: number | undefined;
}

export function TopBar({ canRedo, canSave, canUndo, collapsed, labels, modelName, onCollapseChange, onRedo, onSave, onUndo, revision }: TopBarProps) {
  return (
    <header className="topbar">
      {!collapsed && (
        <div className="brand" aria-label="SolidLoom">
          <span className="brand-mark"><Layers3 size={18} /></span>
          <span className="brand-name">SolidLoom</span>
          <button className="collapse-button" type="button" aria-label={labels.collapseLibrary} title={labels.collapseLibrary} onClick={() => onCollapseChange(true)}>
            <PanelLeftClose size={16} />
          </button>
        </div>
      )}

      <div className="topbar-main">
        {collapsed && (
          <button className="expand-button" type="button" aria-label={labels.expandLibrary} title={labels.expandLibrary} onClick={() => onCollapseChange(false)}>
            <PanelLeftOpen size={16} />
          </button>
        )}
        <div className="document-title">
          <FileBox size={15} />
          <span>{modelName ?? labels.noModel}</span>
          {revision !== undefined && <small>{labels.revision} {revision}</small>}
        </div>
      </div>

      <div className="top-actions">
        <button className="icon-button" type="button" aria-label={labels.undo} title={labels.undo} disabled={!canUndo} onClick={onUndo}><Undo2 size={16} /></button>
        <button className="icon-button" type="button" aria-label={labels.redo} title={labels.redo} disabled={!canRedo} onClick={onRedo}><Redo2 size={16} /></button>
        <button className="icon-button save-button" type="button" aria-label={labels.save} title={labels.save} disabled={!canSave} onClick={onSave}><Save size={16} /></button>
      </div>
    </header>
  );
}
