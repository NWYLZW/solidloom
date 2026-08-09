import { RotateCcw } from "lucide-react";
import "./PlaySettingField.css";
import "./PlayBindingField.css";

interface PlayBindingFieldProps {
  alternateLabel: string;
  description?: string;
  label: string;
  onCaptureAlternate: () => void;
  onCapturePrimary: () => void;
  onReset: () => void;
  primaryLabel: string;
  resetLabel: string;
  waitingAlternate: boolean;
  waitingLabel: string;
  waitingPrimary: boolean;
}

export function PlayBindingField({
  alternateLabel,
  description,
  label,
  onCaptureAlternate,
  onCapturePrimary,
  onReset,
  primaryLabel,
  resetLabel,
  waitingAlternate,
  waitingLabel,
  waitingPrimary,
}: PlayBindingFieldProps) {
  return (
    <div className="play-setting-field play-binding-field">
      <span className="play-setting-field-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className="play-setting-field-control play-binding-controls">
        <button
          className="play-binding-slot"
          data-waiting={waitingPrimary || undefined}
          type="button"
          onClick={onCapturePrimary}
        >
          <span>{waitingPrimary ? waitingLabel : primaryLabel}</span>
        </button>
        <button
          className="play-binding-slot"
          data-waiting={waitingAlternate || undefined}
          type="button"
          onClick={onCaptureAlternate}
        >
          <span>{waitingAlternate ? waitingLabel : alternateLabel}</span>
        </button>
        <button
          aria-label={`${resetLabel}：${label}`}
          className="play-binding-reset"
          title={resetLabel}
          type="button"
          onClick={onReset}
        >
          <RotateCcw aria-hidden="true" size={14} />
        </button>
      </span>
    </div>
  );
}
