import { Combine, Move3D, Rotate3D, Scaling, Slice } from "lucide-react";
import type { BooleanOperation } from "../../../meshOperations";
import type { Unit, Vector3Tuple } from "@solidloom/shared";
import type { ViewportObjectTool } from "./EditorViewportToolbar";

interface TransformTarget {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale?: Vector3Tuple | undefined;
}

interface ObjectToolPopoverProps {
  activeObjectTool: ViewportObjectTool | null;
  booleanOperation: BooleanOperation;
  cutOffset: number;
  cutRotation: Vector3Tuple;
  keepPositive: boolean;
  labels: Record<string, string>;
  onBooleanOperationChange: (operation: BooleanOperation) => void;
  onCutOffsetChange: (offset: number) => void;
  onCutRotationChange: (rotation: Vector3Tuple) => void;
  onExecuteBoolean: () => void;
  onExecutePlaneCut: () => void;
  onKeepPositiveChange: (keep: boolean) => void;
  onPreserveSourcesChange: (preserve: boolean) => void;
  onTransformVectorChange: (key: "position" | "rotation" | "scale", axis: 0 | 1 | 2, value: number) => void;
  onUniformScaleChange: (uniform: boolean) => void;
  operationError: string;
  preserveSources: boolean;
  selectedOperationCount: number;
  selectedViewportCount: number;
  transformTarget: TransformTarget | null;
  uniformScale: boolean;
  unit?: Unit | undefined;
}

export function ObjectToolPopover({ activeObjectTool, booleanOperation, cutOffset, cutRotation, keepPositive, labels, onBooleanOperationChange, onCutOffsetChange, onCutRotationChange, onExecuteBoolean, onExecutePlaneCut, onKeepPositiveChange, onPreserveSourcesChange, onTransformVectorChange, onUniformScaleChange, operationError, preserveSources, selectedOperationCount, selectedViewportCount, transformTarget, uniformScale, unit }: ObjectToolPopoverProps) {
  if (!activeObjectTool || selectedViewportCount === 0) return null;
  const toolLabel = activeObjectTool === "translate" ? labels.moveTool
    : activeObjectTool === "rotate" ? labels.rotateTool
      : activeObjectTool === "scale" ? labels.scaleTool
        : activeObjectTool === "plane-cut" ? labels.planeCutTool : labels.booleanTool;

  return (
    <section className="object-tool-popover" aria-label={toolLabel}>
      <div className="object-tool-heading">
        {activeObjectTool === "translate" ? <Move3D size={16} />
          : activeObjectTool === "rotate" ? <Rotate3D size={16} />
            : activeObjectTool === "scale" ? <Scaling size={16} />
              : activeObjectTool === "plane-cut" ? <Slice size={16} /> : <Combine size={16} />}
        <strong>{toolLabel}</strong>
      </div>

      {(activeObjectTool === "translate" || activeObjectTool === "rotate" || activeObjectTool === "scale") && (
        transformTarget ? (
          <div className="tool-vector-grid">
            <span />
            {(["X", "Y", "Z"] as const).map((axis) => <b className={`axis-${axis.toLowerCase()}`} key={axis}>{axis}</b>)}
            <span />
            <span>{activeObjectTool === "translate" ? labels.position : activeObjectTool === "rotate" ? labels.rotationLabel : labels.scaleTool}</span>
            {([0, 1, 2] as const).map((axis) => {
              const vector = activeObjectTool === "translate" ? transformTarget.position
                : activeObjectTool === "rotate" ? transformTarget.rotation
                  : transformTarget.scale ?? [1, 1, 1];
              const value = activeObjectTool === "scale" ? vector[axis] * 100 : vector[axis];
              return <input key={axis} type="number" step={activeObjectTool === "scale" ? 1 : 0.1} min={activeObjectTool === "scale" ? 1 : undefined} value={Number(value.toFixed(3))} onChange={(event) => onTransformVectorChange(activeObjectTool === "translate" ? "position" : activeObjectTool === "rotate" ? "rotation" : "scale", axis, activeObjectTool === "scale" ? Number(event.target.value) / 100 : Number(event.target.value))} />;
            })}
            <span className="tool-unit">{activeObjectTool === "translate" ? unit : activeObjectTool === "rotate" ? "°" : "%"}</span>
          </div>
        ) : <p className="object-tool-hint">{labels.multiTransformHint}</p>
      )}

      {activeObjectTool === "scale" && <label className="tool-checkbox"><input type="checkbox" checked={uniformScale} onChange={(event) => onUniformScaleChange(event.target.checked)} /> {labels.scaleTool} XYZ</label>}

      {activeObjectTool === "plane-cut" && <>
        <div className="tool-vector-grid">
          <span />
          {(["X", "Y", "Z"] as const).map((axis) => <b className={`axis-${axis.toLowerCase()}`} key={axis}>{axis}</b>)}
          <span />
          <span>{labels.rotationLabel}</span>
          {([0, 1, 2] as const).map((axis) => <input key={axis} type="number" step="1" value={cutRotation[axis]} onChange={(event) => {
            const next = [...cutRotation] as Vector3Tuple;
            next[axis] = Number(event.target.value);
            onCutRotationChange(next);
          }} />)}
          <span className="tool-unit">°</span>
        </div>
        <label className="tool-scalar-row"><span>{labels.offset}</span><input type="number" step="0.1" value={cutOffset} onChange={(event) => onCutOffsetChange(Number(event.target.value))} /><small>{unit}</small></label>
        <label className="tool-checkbox"><input type="checkbox" checked={keepPositive} onChange={(event) => onKeepPositiveChange(event.target.checked)} /> {labels.keepPositive}</label>
        <label className="tool-checkbox"><input type="checkbox" checked={preserveSources} onChange={(event) => onPreserveSourcesChange(event.target.checked)} /> {labels.preserveSources}</label>
        <p className="object-tool-notice">{labels.meshResultNotice}</p>
        <div className="object-tool-actions">
          <button type="button" onClick={() => { onCutRotationChange([0, 0, 0]); onCutOffsetChange(0); }}>{labels.reset}</button>
          <button className="primary-button" type="button" onClick={onExecutePlaneCut}>{labels.execute}</button>
        </div>
      </>}

      {activeObjectTool === "boolean" && <>
        <div className="boolean-mode" aria-label={labels.booleanTool}>
          {(["union", "intersection", "difference"] as const).map((operation) => <button type="button" className={booleanOperation === operation ? "active" : ""} key={operation} onClick={() => onBooleanOperationChange(operation)}>{labels[operation]}</button>)}
        </div>
        <p className="object-tool-hint">{labels.selectedCount} · {selectedOperationCount}</p>
        <label className="tool-checkbox"><input type="checkbox" checked={preserveSources} onChange={(event) => onPreserveSourcesChange(event.target.checked)} /> {labels.preserveSources}</label>
        <p className="object-tool-notice">{labels.meshResultNotice}</p>
        <div className="object-tool-actions">
          <button type="button" onClick={() => onBooleanOperationChange("union")}>{labels.reset}</button>
          <button className="primary-button" type="button" disabled={selectedOperationCount < 2} onClick={onExecuteBoolean}>{labels.execute}</button>
        </div>
      </>}

      {operationError && <p className="object-tool-error" role="alert">{operationError}</p>}
    </section>
  );
}
