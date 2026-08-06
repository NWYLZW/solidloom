import { useRef, useState, type ChangeEvent } from "react";
import type { VoxelSkinModel } from "@solidloom/shared";
import { BUILTIN_VOXEL_SKIN_URL } from "../voxelSkin";
import "./VoxelSkinPanel.css";

const MAX_SKIN_FILE_BYTES = 256 * 1024;

interface VoxelSkinPanelProps {
  labels: {
    builtIn: string;
    classic: string;
    hint: string;
    import: string;
    imported: string;
    invalid: string;
    model: string;
    reset: string;
    slim: string;
    source: string;
    title: string;
    tooLarge: string;
  };
  model: VoxelSkinModel;
  onModelChange: (model: VoxelSkinModel) => void;
  onSkinUrlChange: (url: string) => void;
  skinUrl: string;
}

function readSkinFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("read"));
        return;
      }
      const image = new Image();
      image.onerror = () => reject(new Error("dimensions"));
      image.onload = () => image.naturalWidth === 64 && image.naturalHeight === 64
        ? resolve(reader.result as string)
        : reject(new Error("dimensions"));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function VoxelSkinPanel({ labels, model, onModelChange, onSkinUrlChange, skinUrl }: VoxelSkinPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "image/png") {
      setError(labels.invalid);
      return;
    }
    if (file.size > MAX_SKIN_FILE_BYTES) {
      setError(labels.tooLarge);
      return;
    }
    try {
      const url = await readSkinFile(file);
      setError("");
      onSkinUrlChange(url);
    } catch {
      setError(labels.invalid);
    }
  };
  const isBuiltIn = skinUrl === BUILTIN_VOXEL_SKIN_URL;
  return (
    <div className="voxel-skin-panel">
      <strong>{labels.title}</strong>
      <label className="voxel-skin-field">
        <span>{labels.model}</span>
        <select value={model} onChange={(event) => onModelChange(event.target.value as VoxelSkinModel)}>
          <option value="classic">{labels.classic}</option>
          <option value="slim">{labels.slim}</option>
        </select>
      </label>
      <div className="voxel-skin-source">
        <span>{labels.source}</span>
        <strong>{isBuiltIn ? labels.builtIn : labels.imported}</strong>
      </div>
      <input
        accept="image/png,.png"
        className="voxel-skin-file-input"
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <div className="voxel-skin-actions">
        <button type="button" onClick={() => inputRef.current?.click()}>{labels.import}</button>
        <button
          disabled={isBuiltIn}
          type="button"
          onClick={() => {
            setError("");
            onSkinUrlChange(BUILTIN_VOXEL_SKIN_URL);
          }}
        >
          {labels.reset}
        </button>
      </div>
      <small>{labels.hint}</small>
      {error && <p className="voxel-skin-error" role="alert">{error}</p>}
    </div>
  );
}
