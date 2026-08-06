import { ArrowDownToLine, ArrowUpFromLine, Box, X } from "lucide-react";
import { useId } from "react";
import type { ContainerInteractionRendererProps } from "../types";
import "./DefaultContainerInteractionRenderer.css";

export function DefaultContainerInteractionRenderer({
  controller,
  presentation,
  slots,
}: ContainerInteractionRendererProps) {
  const titleId = useId();
  const { close, empty, full, labels, state, store, take } = controller;
  const { EmptySlot, Item } = slots;
  const slotCount = Math.max(state.capacity, state.items.length);

  return (
    <>
      <div className="interaction-container-backdrop" aria-hidden="true" />
      <section
        aria-labelledby={titleId}
        aria-modal={presentation === "modal" || presentation === "sheet" ? true : undefined}
        className="interaction-container-panel"
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
      </section>
    </>
  );
}
