import { useEffect, useState, type KeyboardEvent } from "react";
import type { ModelVariable, Unit } from "@solidloom/shared";

interface ModelVariableEditorProps {
  fallbackUnit: Unit;
  hint: string;
  title: string;
  variables: ModelVariable[];
  onChange: (variableId: string, value: number | string) => void;
}

interface ColorVariableInputProps {
  variable: Extract<ModelVariable, { type: "color" }>;
  onChange: (variableId: string, value: string) => void;
}

function ColorVariableInput({ variable, onChange }: ColorVariableInputProps) {
  const [draftValue, setDraftValue] = useState(variable.value);

  useEffect(() => setDraftValue(variable.value), [variable.value]);

  const updateDraft = (nextValue: string) => {
    const normalized = nextValue.toUpperCase();
    setDraftValue(normalized);
    if (/^#[0-9A-F]{6}$/.test(normalized)) onChange(variable.id, normalized);
  };

  const restoreInvalidDraft = () => {
    if (!/^#[0-9A-F]{6}$/.test(draftValue)) setDraftValue(variable.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.currentTarget.blur();
  };

  return (
    <span className="model-variable-color-control">
      <input
        aria-label={`${variable.label} ${variable.id}`}
        type="color"
        value={variable.value}
        onChange={(event) => updateDraft(event.target.value)}
      />
      <input
        aria-label={`${variable.label} #RRGGBB`}
        className="model-variable-color-code"
        inputMode="text"
        maxLength={7}
        spellCheck={false}
        value={draftValue}
        onBlur={restoreInvalidDraft}
        onChange={(event) => updateDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </span>
  );
}

export function ModelVariableEditor({ fallbackUnit, hint, onChange, title, variables }: ModelVariableEditorProps) {
  return (
    <div className="model-variable-editor">
      <strong>{title}</strong>
      <p>{hint}</p>
      {variables.map((variable) => (
        <label key={variable.id}>
          <span className="model-variable-name"><strong>{variable.label}</strong><code>{variable.id}</code></span>
          {variable.type === "color" ? (
            <ColorVariableInput variable={variable} onChange={onChange} />
          ) : (
            <span>
              <input
                aria-label={`${variable.label} ${variable.id}`}
                type="number"
                step="1"
                value={variable.value}
                onChange={(event) => onChange(variable.id, Number(event.target.value))}
              /> {variable.unit ?? fallbackUnit}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
