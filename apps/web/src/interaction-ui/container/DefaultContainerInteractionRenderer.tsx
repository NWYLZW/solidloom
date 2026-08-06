import { ArrowDownToLine, ArrowUpFromLine, Info, PackageOpen, X } from "lucide-react";
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
        aria-modal={presentation === "anchored" ? undefined : true}
        className="interaction-container-panel"
        role="dialog"
      >
        <header className="interaction-container-header">
          <div className="interaction-container-heading-copy">
            <strong id={titleId}>{state.title}</strong>
            <span>{labels.containerCapacity} {state.items.length} / {state.capacity}</span>
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
          <div className="interaction-container-section-heading">
            <span aria-hidden="true"><PackageOpen size={16} /></span>
            <strong>{labels.containerContents}</strong>
          </div>
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
          <div className="interaction-container-note">
            <Info aria-hidden="true" size={13} />
            <small>{labels.containerSessionOnly}</small>
          </div>
          <div className="interaction-container-actions">
            <button
              className="interaction-container-store"
              disabled={full}
              type="button"
              onClick={store}
            >
              <ArrowDownToLine aria-hidden="true" size={15} />
              <span>{labels.containerStore}</span>
            </button>
            <button
              className="interaction-container-take"
              disabled={empty}
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
