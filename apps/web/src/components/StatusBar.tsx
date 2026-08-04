import { ChevronDown, ChevronRight } from "lucide-react";
import type { Unit } from "@solidloom/shared";
import "./StatusBar.css";

export interface StatusPathSegment {
  id: string;
  label: string;
}

interface StatusBarProps {
  detail: string;
  editorStatusClass: string;
  labels: { currentPath: string; unit: string; units: string; workspaceStatus: string };
  path: StatusPathSegment[];
  saveLabel: string;
  serviceLabel: string;
  serviceState: "checking" | "online" | "offline";
  showEditorStatus: boolean;
  unit?: Unit | undefined;
  onUnitChange: (unit: Unit) => void;
}

export function StatusBar({ detail, editorStatusClass, labels, onUnitChange, path, saveLabel, serviceLabel, serviceState, showEditorStatus, unit }: StatusBarProps) {
  return (
    <footer className="statusbar" aria-label={labels.workspaceStatus}>
      <div className="status-main">
        <nav className="status-breadcrumb" aria-label={labels.currentPath}>
          <ol>
            {path.map((segment, index) => (
              <li key={segment.id}>
                {index > 0 && <ChevronRight size={10} aria-hidden="true" />}
                <span aria-current={index === path.length - 1 ? "page" : undefined} title={segment.label}>{segment.label}</span>
              </li>
            ))}
          </ol>
        </nav>
        {showEditorStatus && (
          <div className="status-feedback">
            <span className="status-divider" aria-hidden="true" />
            <span className={`status-primary ${editorStatusClass}`}><span className="status-ready-dot" />{saveLabel}</span>
            {detail && <><span className="status-divider" aria-hidden="true" /><span className="status-detail">{detail}</span></>}
          </div>
        )}
      </div>
      <div className="status-right">
        <label className={`status-unit-picker${unit ? "" : " disabled"}`} title={`${labels.unit}: ${unit ?? "mm"}`}>
          <span>{labels.units} {unit ?? "mm"}</span>
          <ChevronDown size={9} aria-hidden="true" />
          <select aria-label={labels.unit} disabled={!unit} value={unit ?? "mm"} onChange={(event) => onUnitChange(event.target.value as Unit)}>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </label>
        <span className="status-divider" aria-hidden="true" />
        <span className={`status-service ${serviceState}`}><span className="state-dot" />{serviceLabel}</span>
      </div>
    </footer>
  );
}
