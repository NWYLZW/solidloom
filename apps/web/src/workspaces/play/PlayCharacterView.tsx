import { RotateCcw, Upload, UserRound } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import type { NavigationAvatarSkin } from "../../navigationAvatar";
import { MAX_SKIN_FILE_BYTES, readVoxelSkinFile } from "../../skinFile";
import { BUILTIN_VOXEL_SKIN_URL } from "../../voxelSkin";
import type { EditorLocale } from "../editor/editorCopy";
import { playCopyByLocale } from "./playCopy";
import { PlayCharacterPreview3D } from "./PlayCharacterPreview3D";
import { PlayCharacterSkinThumbnail } from "./PlayCharacterSkinThumbnail";
import { PlaySubpageHeader } from "./PlaySubpageHeader";
import "./PlayCharacterView.css";

interface PlayCharacterViewProps {
  locale: EditorLocale;
  onBack: () => void;
  onSkinChange: (skin: NavigationAvatarSkin) => void;
  onSkinReset: () => void;
  sceneSkin: NavigationAvatarSkin | null;
  skin: NavigationAvatarSkin | null;
}

function skinKey(skin: NavigationAvatarSkin) {
  return `${skin.model}:${skin.url}`;
}

export function PlayCharacterView({ locale, onBack, onSkinChange, onSkinReset, sceneSkin, skin }: PlayCharacterViewProps) {
  const copy = playCopyByLocale[locale];
  const effectiveSkin = skin ?? { model: "classic", url: BUILTIN_VOXEL_SKIN_URL };
  const effectiveSceneSkin = sceneSkin ?? { model: "classic", url: BUILTIN_VOXEL_SKIN_URL };
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const importSkin = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "image/png" || file.size > MAX_SKIN_FILE_BYTES) {
      setError(copy.characterSkinInvalid);
      return;
    }
    try {
      const url = await readVoxelSkinFile(file);
      setError("");
      onSkinChange({ ...effectiveSkin, url });
    } catch {
      setError(copy.characterSkinInvalid);
    }
  };

  const candidateOptions = [
    { id: "scene", label: copy.characterSceneSkin, skin: effectiveSceneSkin },
    { id: "classic", label: copy.characterClassicSkin, skin: { model: "classic", url: BUILTIN_VOXEL_SKIN_URL } as const },
    { id: "slim", label: copy.characterSlimSkin, skin: { model: "slim", url: BUILTIN_VOXEL_SKIN_URL } as const },
  ];
  const baseOptions = candidateOptions.filter((option, index) => (
    candidateOptions.findIndex((candidate) => skinKey(candidate.skin) === skinKey(option.skin)) === index
  ));
  const knownKeys = new Set(baseOptions.map((option) => skinKey(option.skin)));
  const skinOptions = knownKeys.has(skinKey(effectiveSkin))
    ? baseOptions
    : [...baseOptions, { id: "imported", label: copy.characterImportedSkin, skin: effectiveSkin }];

  return (
    <div className="play-character-view">
      <PlaySubpageHeader backLabel={copy.backToMenu} onBack={onBack} title={copy.character} />
      <main className="play-character-content">
        <section className="play-character-preview-panel">
          <PlayCharacterPreview3D label={copy.characterPreview} skin={effectiveSkin} />
        </section>

        <section className="play-character-form" aria-labelledby="play-character-heading">
          <div className="play-character-heading">
            <UserRound aria-hidden="true" size={22} />
            <div>
              <h2 id="play-character-heading">{copy.characterSkin}</h2>
              <p>{copy.characterDescription}</p>
            </div>
          </div>

          <input accept="image/png,.png" ref={inputRef} type="file" onChange={importSkin} />
          <div className="play-character-actions">
            <button className="primary" type="button" onClick={() => inputRef.current?.click()}>
              <Upload aria-hidden="true" size={18} />
              <span>{copy.characterImport}</span>
            </button>
            <button type="button" onClick={() => { setError(""); onSkinReset(); }}>
              <RotateCcw aria-hidden="true" size={18} />
              <span>{copy.characterReset}</span>
            </button>
          </div>
          {error && <p className="play-character-error" role="alert">{error}</p>}
          <div className="play-character-skin-heading">
            <strong>{copy.characterSkinList}</strong>
            <small>{copy.characterSessionHint}</small>
          </div>
          <div className="play-character-skin-grid" role="listbox" aria-label={copy.characterSkinList}>
            {skinOptions.map((option) => {
              const selected = skinKey(option.skin) === skinKey(effectiveSkin);
              return (
                <button
                  aria-selected={selected}
                  className={selected ? "active" : ""}
                  key={option.id}
                  role="option"
                  type="button"
                  onClick={() => onSkinChange(option.skin)}
                >
                  <PlayCharacterSkinThumbnail label={option.label} skin={option.skin} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
