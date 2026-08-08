import { ChevronDown } from "lucide-react";
import { useId } from "react";
import "./PlaySettingField.css";
import "./PlaySelectField.css";

export interface PlaySelectOption<Value extends string = string> {
  description?: string;
  label: string;
  value: Value;
}

interface PlaySelectFieldProps<Value extends string> {
  description?: string;
  label: string;
  onChange: (value: Value) => void;
  options: readonly PlaySelectOption<Value>[];
  value: Value;
}

export function PlaySelectField<Value extends string>({
  description,
  label,
  onChange,
  options,
  value,
}: PlaySelectFieldProps<Value>) {
  const controlId = useId();
  const activeOption = options.find((option) => option.value === value);

  return (
    <div className="play-setting-field play-select-field">
      <div className="play-setting-field-copy">
        <label htmlFor={controlId}><strong>{label}</strong></label>
        {description && <small>{description}</small>}
      </div>
      <div className="play-setting-field-control">
        <div className="play-select-control-shell">
          <select
            id={controlId}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value as Value)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={15} />
        </div>
        {activeOption?.description && (
          <small className="play-setting-control-help">{activeOption.description}</small>
        )}
      </div>
    </div>
  );
}
