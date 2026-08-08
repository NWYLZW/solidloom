import "./PlaySettingField.css";
import "./PlayToggleField.css";

interface PlayToggleFieldProps {
  checked: boolean;
  description?: string;
  label: string;
  onChange: (checked: boolean) => void;
}

export function PlayToggleField({
  checked,
  description,
  label,
  onChange,
}: PlayToggleFieldProps) {
  return (
    <label className="play-setting-field play-toggle-field">
      <span className="play-setting-field-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className="play-setting-field-control play-toggle-control-column">
        <input
          checked={checked}
          type="checkbox"
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span aria-hidden="true" className="play-toggle-control" />
      </span>
    </label>
  );
}
