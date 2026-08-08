import "./PlaySettingField.css";
import "./PlayChoiceField.css";

export interface PlayChoiceOption<Value extends string = string> {
  description?: string;
  label: string;
  value: Value;
}

interface PlayChoiceFieldProps<Value extends string> {
  description?: string;
  legend: string;
  name: string;
  onChange: (value: Value) => void;
  options: readonly PlayChoiceOption<Value>[];
  value: Value;
}

export function PlayChoiceField<Value extends string>({
  description,
  legend,
  name,
  onChange,
  options,
  value,
}: PlayChoiceFieldProps<Value>) {
  return (
    <fieldset className="play-choice-field">
      <legend className="play-choice-accessible-legend">{legend}</legend>
      <div className="play-setting-field play-choice-field-row">
        <div className="play-setting-field-copy" aria-hidden="true">
          <strong>{legend}</strong>
          {description && <small>{description}</small>}
        </div>
        <div className="play-setting-field-control play-choice-options">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <label data-selected={selected ? "true" : "false"} key={option.value}>
                <input
                  checked={selected}
                  name={name}
                  type="radio"
                  value={option.value}
                  onChange={() => onChange(option.value)}
                />
                <span aria-hidden="true" className="play-choice-indicator" />
                <span className="play-choice-copy">
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
