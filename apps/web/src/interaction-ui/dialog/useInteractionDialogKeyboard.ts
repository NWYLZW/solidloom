import { type RefObject, useEffect, useRef } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => (
    element.getAttribute("aria-hidden") !== "true" && !element.hidden
  ));
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function focusSelectedOption(dialog: HTMLElement) {
  window.requestAnimationFrame(() => {
    dialog.querySelector<HTMLElement>("[data-dialog-selection][data-selected='true']")
      ?.focus({ preventScroll: true });
  });
}

export interface InteractionDialogKeyboardOptions {
  dialogRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onClose: () => void;
  onMoveSelection?: ((direction: -1 | 1) => void) | undefined;
  onSelectBoundary?: ((boundary: "first" | "last") => void) | undefined;
  onPrimaryAction?: (() => void) | undefined;
  trapFocus?: boolean;
}

/**
 * Shared keyboard behavior for interaction dialogs.
 *
 * Business renderers opt into list navigation and their primary action through callbacks, while
 * focus containment, Escape handling and editable-control safety stay consistent across dialogs.
 */
export function useInteractionDialogKeyboard({
  dialogRef,
  enabled,
  onClose,
  onMoveSelection,
  onPrimaryAction,
  onSelectBoundary,
  trapFocus = true,
}: InteractionDialogKeyboardOptions) {
  const callbacksRef = useRef({
    onClose,
    onMoveSelection,
    onPrimaryAction,
    onSelectBoundary,
  });

  useEffect(() => {
    callbacksRef.current = {
      onClose,
      onMoveSelection,
      onPrimaryAction,
      onSelectBoundary,
    };
  }, [onClose, onMoveSelection, onPrimaryAction, onSelectBoundary]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !enabled) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const initialFocusFrame = window.requestAnimationFrame(() => {
      const initialFocus = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus='true']")
        ?? getFocusableElements(dialog)[0]
        ?? dialog;
      initialFocus.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const callbacks = callbacksRef.current;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        callbacks.onClose();
        return;
      }

      if (event.key === "Tab" && trapFocus) {
        const focusableElements = getFocusableElements(dialog);
        if (focusableElements.length === 0) {
          event.preventDefault();
          dialog.focus({ preventScroll: true });
          return;
        }

        const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1)
          : (currentIndex === -1 || currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1);
        event.preventDefault();
        focusableElements[nextIndex]?.focus({ preventScroll: true });
        return;
      }

      if (isTextEntryTarget(event.target)) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!callbacks.onMoveSelection) return;
        event.preventDefault();
        callbacks.onMoveSelection(event.key === "ArrowDown" ? 1 : -1);
        focusSelectedOption(dialog);
        return;
      }

      if (event.key === "Home" || event.key === "End") {
        if (!callbacks.onSelectBoundary) return;
        event.preventDefault();
        callbacks.onSelectBoundary(event.key === "Home" ? "first" : "last");
        focusSelectedOption(dialog);
        return;
      }

      if (event.key !== "Enter" || !callbacks.onPrimaryAction) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const nativeAction = target?.closest("button:not([data-dialog-selection]), a[href]");
      if (nativeAction) return;
      event.preventDefault();
      callbacks.onPrimaryAction();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(initialFocusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [dialogRef, enabled, trapFocus]);
}
