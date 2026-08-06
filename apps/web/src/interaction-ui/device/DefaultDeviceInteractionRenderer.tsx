import { Check, SlidersHorizontal, X, Zap } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { useInteractionDialogKeyboard } from "../dialog/useInteractionDialogKeyboard";
import type { DeviceInteractionRendererProps } from "../types";
import "./DefaultDeviceInteractionRenderer.css";

export function DefaultDeviceInteractionRenderer({
  controller,
  presentation,
}: DeviceInteractionRendererProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const { close, execute, labels, select, state } = controller;
  const [activeGroupId, setActiveGroupId] = useState(state.groups[0]?.id ?? "");
  const activeGroup = state.groups.find((group) => group.id === activeGroupId)
    ?? state.groups[0];

  const moveSelection = useCallback((direction: -1 | 1) => {
    if (!activeGroup || activeGroup.options.length === 0) return;
    const currentIndex = activeGroup.options.findIndex((option) => (
      option.id === activeGroup.selectedOptionId
    ));
    const nextIndex = currentIndex === -1
      ? (direction === 1 ? 0 : activeGroup.options.length - 1)
      : (currentIndex + direction + activeGroup.options.length) % activeGroup.options.length;
    const nextOption = activeGroup.options[nextIndex];
    if (nextOption) select(activeGroup.id, nextOption.id);
  }, [activeGroup, select]);

  const selectBoundary = useCallback((boundary: "first" | "last") => {
    if (!activeGroup || activeGroup.options.length === 0) return;
    const nextOption = boundary === "first"
      ? activeGroup.options[0]
      : activeGroup.options[activeGroup.options.length - 1];
    if (nextOption) select(activeGroup.id, nextOption.id);
  }, [activeGroup, select]);

  const modalPresentation = presentation === "modal" || presentation === "sheet";
  useInteractionDialogKeyboard({
    dialogRef: panelRef,
    enabled: modalPresentation,
    onClose: close,
    onMoveSelection: moveSelection,
    onPrimaryAction: execute,
    onSelectBoundary: selectBoundary,
  });

  return (
    <>
      <div className="interaction-device-backdrop" aria-hidden="true" />
      <section
        aria-labelledby={titleId}
        aria-modal={modalPresentation ? true : undefined}
        className="interaction-device-panel"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="interaction-device-header">
          <span className="interaction-device-kind-icon" aria-hidden="true">
            <SlidersHorizontal size={17} />
          </span>
          <div className="interaction-device-heading-copy">
            <strong id={titleId}>{state.title}</strong>
            <span>{labels.deviceReady}</span>
          </div>
          <button
            aria-keyshortcuts="Escape"
            aria-label={labels.deviceClose}
            className="interaction-device-close"
            type="button"
            onClick={close}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <div className="interaction-device-body">
          {state.groups.map((group, groupIndex) => (
            <fieldset className="interaction-device-group" key={group.id}>
              <legend>{group.label}</legend>
              <div
                aria-keyshortcuts="ArrowUp ArrowDown Home End"
                className="interaction-device-options"
                role="radiogroup"
              >
                {group.options.map((option, optionIndex) => {
                  const selected = option.id === group.selectedOptionId;
                  const active = group.id === activeGroup?.id;
                  return (
                    <button
                      aria-checked={selected}
                      className="interaction-device-option"
                      data-dialog-initial-focus={groupIndex === 0 && optionIndex === 0}
                      data-dialog-selection={active ? true : undefined}
                      data-selected={active && selected}
                      key={option.id}
                      role="radio"
                      type="button"
                      onClick={() => {
                        setActiveGroupId(group.id);
                        select(group.id, option.id);
                      }}
                      onFocus={() => setActiveGroupId(group.id)}
                    >
                      <span className="interaction-device-option-copy">
                        <strong>{option.label}</strong>
                        {option.description && <span>{option.description}</span>}
                      </span>
                      <span className="interaction-device-option-check" aria-hidden="true">
                        {selected && <Check size={15} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {state.status && (
            <div className="interaction-device-status" role="status">
              <Check aria-hidden="true" size={15} />
              <span>{state.status}</span>
            </div>
          )}
        </div>

        <footer className="interaction-device-actions">
          <button
            aria-keyshortcuts="Enter"
            className="interaction-device-primary"
            data-dialog-primary-action
            type="button"
            onClick={execute}
          >
            <Zap aria-hidden="true" size={16} />
            <span>{state.executeLabel}</span>
          </button>
        </footer>
      </section>
    </>
  );
}
