import type { CSSProperties } from "react";
import "./PlaySettingField.css";
import "./PlayRangeField.css";

interface PlayRangeFieldProps {
  description?: string;
  label: string;
  maximum: number;
  minimum: number;
  onChange: (value: number) => void;
  suffix?: string;
  value: number;
}

export function PlayRangeField({
  description,
  label,
  maximum,
  minimum,
  onChange,
  suffix,
  value,
}: PlayRangeFieldProps) {
  const progress = maximum === minimum
    ? 0
    : ((value - minimum) / (maximum - minimum)) * 100;

  return (
    <label className="play-setting-field play-range-field">
      <span className="play-setting-field-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className="play-setting-field-control play-range-control">
        <input
          max={maximum}
          min={minimum}
          type="range"
          value={value}
          style={{ "--play-range-progress": `${progress}%` } as CSSProperties}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
        <output>{value}{suffix}</output>
      </span>
    </label>
  );
}
