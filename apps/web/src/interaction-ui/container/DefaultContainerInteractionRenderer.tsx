import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Boxes,
  Save,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";
import type { ContainerInteractionRendererProps } from "../types";
import "./DefaultContainerInteractionRenderer.css";

export function DefaultContainerInteractionRenderer({
  controller,
  presentation,
  slots,
}: ContainerInteractionRendererProps) {
  const titleId = useId();
  const { close, configure, empty, full, labels, state, store, take } = controller;
  const { EmptySlot, Item } = slots;
  const slotCount = Math.max(state.capacity, state.items.length);
  const [view, setView] = useState<"items" | "settings">("items");
  const [draftTitle, setDraftTitle] = useState(state.title);
  const [draftCapacity, setDraftCapacity] = useState(state.capacity);

  useEffect(() => {
    setDraftTitle(state.title);
    setDraftCapacity(state.capacity);
  }, [state.capacity, state.title]);

  const submitConfiguration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    configure({
      capacity: Math.max(state.items.length, Math.min(128, draftCapacity)),
      title: draftTitle,
    });
  };

  return (
    <>
      <div className="interaction-container-backdrop" aria-hidden="true" />
      <section
        aria-labelledby={titleId}
        aria-modal={presentation === "modal" || presentation === "sheet" ? true : undefined}
        className="interaction-container-panel"
        data-container-view={view}
        role="dialog"
      >
        <header className="interaction-container-header">
          <span className="interaction-container-kind-icon" aria-hidden="true">
            <Box size={17} />
          </span>
          <div className="interaction-container-heading-copy">
            <strong id={titleId}>{state.title}</strong>
            <span>{state.items.length} / {state.capacity}</span>
          </div>
          {state.canConfigure && (
            <button
              aria-label={view === "settings" ? labels.containerItemsView : labels.containerConfigure}
              aria-pressed={view === "settings"}
              className="interaction-container-configure"
              title={view === "settings" ? labels.containerItemsView : labels.containerConfigure}
              type="button"
              onClick={() => setView((current) => current === "settings" ? "items" : "settings")}
            >
              {view === "settings"
                ? <Boxes aria-hidden="true" size={16} />
                : <Settings2 aria-hidden="true" size={16} />}
            </button>
          )}
          <button
            aria-label={labels.containerClose}
            autoFocus
            className="interaction-container-close"
            type="button"
            onClick={close}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        {view === "items" ? (
          <div className="interaction-container-body">
            <div
              aria-label={empty ? labels.containerEmpty : labels.containerContents}
              className="interaction-container-items"
            >
              {Array.from({ length: slotCount }, (_, index) => {
                const item = state.items[index];
                return item
                  ? <Item index={index} item={item} key={item.id} />
                  : <EmptySlot index={index} key={`slot-${index}`} />;
              })}
            </div>
          </div>
        ) : (
          <form className="interaction-container-settings" onSubmit={submitConfiguration}>
            <div className="interaction-container-access">
              <ShieldCheck aria-hidden="true" size={16} />
              <span>{labels.containerConfigureGranted}</span>
            </div>
            <label>
              <span>{labels.containerName}</span>
              <input
                maxLength={120}
                required
                type="text"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </label>
            <label>
              <span>{labels.containerCapacity}</span>
              <input
                max={128}
                min={Math.max(1, state.items.length)}
                required
                type="number"
                value={draftCapacity}
                onChange={(event) => setDraftCapacity(Number(event.target.value))}
              />
            </label>
            <button className="interaction-container-apply" type="submit">
              <Save aria-hidden="true" size={15} />
              <span>{labels.containerConfigureApply}</span>
            </button>
          </form>
        )}

        {view === "items" && (
          <footer className="interaction-container-footer">
            <div className="interaction-container-actions">
              <button
                aria-label={labels.containerStore}
                className="interaction-container-store"
                disabled={full}
                title={labels.containerStore}
                type="button"
                onClick={store}
              >
                <ArrowDownToLine aria-hidden="true" size={15} />
                <span>{labels.containerStore}</span>
              </button>
              <button
                aria-label={labels.containerTake}
                className="interaction-container-take"
                disabled={empty}
                title={labels.containerTake}
                type="button"
                onClick={take}
              >
                <ArrowUpFromLine aria-hidden="true" size={15} />
                <span>{labels.containerTake}</span>
              </button>
            </div>
          </footer>
        )}
      </section>
    </>
  );
}
