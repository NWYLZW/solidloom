import { ArrowDownToLine, ArrowUpFromLine, Box, Info, PackageOpen, X } from "lucide-react";
import type {
  NavigationContainerOperation,
  NavigationContainerPanelState,
  Viewport3DProps,
} from "./types";

interface ContainerInteractionPanelProps {
  labels: Viewport3DProps["navigationInteractionLabels"];
  onOperation: (interactionId: string, operation: NavigationContainerOperation) => void;
  state: NavigationContainerPanelState;
}

export function ContainerInteractionPanel({
  labels,
  onOperation,
  state,
}: ContainerInteractionPanelProps) {
  const full = state.items.length >= state.capacity;
  const empty = state.items.length === 0;

  return (
    <>
      <div className="interaction-container-backdrop" aria-hidden="true" />
      <section
        aria-labelledby="interaction-container-title"
        aria-modal="true"
        className="interaction-container-panel"
        role="dialog"
      >
        <header className="interaction-container-header">
          <div className="interaction-container-heading">
            <div className="interaction-container-heading-copy">
              <strong id="interaction-container-title">{state.title}</strong>
              <span>{labels.containerCapacity} {state.items.length} / {state.capacity}</span>
            </div>
          </div>
          <button
            aria-label={labels.containerClose}
            autoFocus
            className="interaction-container-close"
            type="button"
            onClick={() => onOperation(state.interactionId, "close")}
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
            {Array.from({ length: Math.max(state.capacity, state.items.length) }, (_, index) => {
              const item = state.items[index];
              return item ? (
                <span className="interaction-container-item" key={item.id}>
                  <span aria-hidden="true"><Box size={15} /></span>
                  <strong>{item.name}</strong>
                </span>
              ) : (
                <span className="interaction-container-slot" aria-hidden="true" key={`slot-${index}`}>
                  <span />
                </span>
              );
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
              onClick={() => onOperation(state.interactionId, "store")}
            >
              <ArrowDownToLine aria-hidden="true" size={15} />
              <span>{labels.containerStore}</span>
            </button>
            <button
              className="interaction-container-take"
              disabled={empty}
              type="button"
              onClick={() => onOperation(state.interactionId, "take")}
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
