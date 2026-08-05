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
    <section className="interaction-container-panel" aria-label={state.title}>
      <header className="interaction-container-header">
        <div>
          <strong>{state.title}</strong>
          <span>{state.items.length} / {state.capacity}</span>
        </div>
        <button
          aria-label={labels.containerClose}
          autoFocus
          className="interaction-container-close"
          type="button"
          onClick={() => onOperation(state.interactionId, "close")}
        >
          ×
        </button>
      </header>
      <div className="interaction-container-items">
        {empty ? (
          <p>{labels.containerEmpty}</p>
        ) : state.items.map((item) => (
          <span className="interaction-container-item" key={item.id}>{item.name}</span>
        ))}
      </div>
      <div className="interaction-container-actions">
        <button
          disabled={full}
          type="button"
          onClick={() => onOperation(state.interactionId, "store")}
        >
          {labels.containerStore}
        </button>
        <button
          disabled={empty}
          type="button"
          onClick={() => onOperation(state.interactionId, "take")}
        >
          {labels.containerTake}
        </button>
      </div>
      <small>{labels.containerSessionOnly}</small>
    </section>
  );
}
