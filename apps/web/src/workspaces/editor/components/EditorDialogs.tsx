import { FileBox, FolderTree, Keyboard, X } from "lucide-react";
import type { FormEvent } from "react";
import "../styles/EditorDialogs.css";

export interface ShortcutSection {
  rows: string[][];
  title: string;
}

interface EditorDialogsProps {
  createDialogOpen: boolean;
  createName: string;
  creating: boolean;
  labels: {
    cancel: string;
    close: string;
    create: string;
    createModel: string;
    keyboardShortcuts: string;
    modelName: string;
    projectName: string;
    renameProject: string;
    save: string;
    shortcutViewportHint: string;
  };
  onCreateDialogOpenChange: (open: boolean) => void;
  onCreateModel: (event: FormEvent<HTMLFormElement>) => void;
  onCreateNameChange: (name: string) => void;
  onProjectNameChange: (name: string) => void;
  onProjectNameDraftChange: (name: string) => void;
  onRenameProjectOpenChange: (open: boolean) => void;
  onShortcutGuideOpenChange: (open: boolean) => void;
  projectNameDraft: string;
  renameProjectOpen: boolean;
  shortcutGuideOpen: boolean;
  shortcutSections: ShortcutSection[];
}

export function EditorDialogs({
  createDialogOpen,
  createName,
  creating,
  labels,
  onCreateDialogOpenChange,
  onCreateModel,
  onCreateNameChange,
  onProjectNameChange,
  onProjectNameDraftChange,
  onRenameProjectOpenChange,
  onShortcutGuideOpenChange,
  projectNameDraft,
  renameProjectOpen,
  shortcutGuideOpen,
  shortcutSections,
}: EditorDialogsProps) {
  return (
    <>
      {shortcutGuideOpen && (
        <div className="dialog-backdrop" role="presentation" onPointerDown={(event) => {
          if (event.currentTarget === event.target) onShortcutGuideOpenChange(false);
        }}>
          <section className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-guide-title">
            <header className="shortcut-dialog-heading">
              <div id="shortcut-guide-title"><Keyboard size={17} /><span>{labels.keyboardShortcuts}</span></div>
              <button type="button" aria-label={labels.close} title={labels.close} onClick={() => onShortcutGuideOpenChange(false)}>
                <X size={16} />
              </button>
            </header>
            <p>{labels.shortcutViewportHint}</p>
            <div className="shortcut-sections">
              {shortcutSections.map((section) => (
                <section className="shortcut-section" key={section.title}>
                  <h3>{section.title}</h3>
                  <dl>
                    {section.rows.map(([keys = "", description = ""]) => (
                      <div className="shortcut-row" key={keys}>
                        <dt><kbd>{keys}</kbd></dt>
                        <dd>{description}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </section>
        </div>
      )}

      {createDialogOpen && (
        <div className="dialog-backdrop" role="presentation" onPointerDown={(event) => {
          if (event.currentTarget === event.target) onCreateDialogOpenChange(false);
        }}>
          <form className="create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-model-title" onSubmit={onCreateModel}>
            <div className="dialog-heading" id="create-model-title"><FileBox size={17} /><span>{labels.createModel}</span></div>
            <label>
              <span>{labels.modelName}</span>
              <input autoFocus value={createName} maxLength={120} onChange={(event) => onCreateNameChange(event.target.value)} />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => onCreateDialogOpenChange(false)}>{labels.cancel}</button>
              <button className="primary-button" type="submit" disabled={!createName.trim() || creating}>{labels.create}</button>
            </div>
          </form>
        </div>
      )}

      {renameProjectOpen && (
        <div className="dialog-backdrop" role="presentation" onPointerDown={(event) => {
          if (event.currentTarget === event.target) onRenameProjectOpenChange(false);
        }}>
          <form
            className="create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-project-title"
            onSubmit={(event) => {
              event.preventDefault();
              const nextName = projectNameDraft.trim();
              if (!nextName) return;
              onProjectNameChange(nextName);
              onRenameProjectOpenChange(false);
            }}
          >
            <div className="dialog-heading" id="rename-project-title"><FolderTree size={17} /><span>{labels.renameProject}</span></div>
            <label>
              <span>{labels.projectName}</span>
              <input autoFocus value={projectNameDraft} maxLength={120} onChange={(event) => onProjectNameDraftChange(event.target.value)} />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => onRenameProjectOpenChange(false)}>{labels.cancel}</button>
              <button className="primary-button" type="submit" disabled={!projectNameDraft.trim()}>{labels.save}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
