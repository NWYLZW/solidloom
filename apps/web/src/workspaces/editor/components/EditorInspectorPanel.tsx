import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import "../styles/InspectorPanel.css";

interface EditorInspectorPanelProps {
  activeTab: "features" | "properties";
  children: ReactNode;
  labels: {
    parameters: string;
    properties: string;
    resizeInspectorWidth: string;
  };
  onResizeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onTabChange: (tab: "features" | "properties") => void;
  width: number;
}

export function EditorInspectorPanel({ activeTab, children, labels, onResizeKeyDown, onResizePointerDown, onTabChange, width }: EditorInspectorPanelProps) {
  return (
    <aside className="inspector-panel">
      <div
        className="panel-resizer inspector-width-resizer"
        role="separator"
        tabIndex={0}
        aria-label={labels.resizeInspectorWidth}
        aria-orientation="vertical"
        aria-valuemin={240}
        aria-valuemax={480}
        aria-valuenow={width}
        onPointerDown={onResizePointerDown}
        onKeyDown={onResizeKeyDown}
      />
      <div className="inspector-tabs">
        <button className={activeTab === "features" ? "active" : ""} type="button" onClick={() => onTabChange("features")}>{labels.parameters}</button>
        <button className={activeTab === "properties" ? "active" : ""} type="button" onClick={() => onTabChange("properties")}>{labels.properties}</button>
      </div>
      <div className="inspector-body">{children}</div>
    </aside>
  );
}
