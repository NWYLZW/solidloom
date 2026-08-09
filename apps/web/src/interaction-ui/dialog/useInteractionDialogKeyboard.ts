import { type RefObject, useEffect, useRef } from "react";
import {
  activateFocusedElement,
  focusInitialElement,
  focusSequentialElement,
  focusSpatialElement,
  useInputAction,
  useInputContext,
  useOptionalInputRuntime,
} from "../../input";

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
  const inputRuntime = useOptionalInputRuntime();
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

  useInputContext("device", enabled);
  useInputAction((event) => {
    if (!enabled || event.context !== "device" || event.phase === "released") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const callbacks = callbacksRef.current;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (active && isTextEntryTarget(active) && event.action !== "ui-back") return;

    if (event.action === "ui-back") {
      if (event.phase !== "pressed") return;
      event.preventDefault();
      callbacks.onClose();
      return;
    }
    if (event.action === "ui-next" || event.action === "ui-previous") {
      event.preventDefault();
      focusSequentialElement(dialog, event.action === "ui-next" ? 1 : -1);
      return;
    }
    if (event.action === "ui-up" || event.action === "ui-down") {
      event.preventDefault();
      if (callbacks.onMoveSelection) {
        callbacks.onMoveSelection(event.action === "ui-down" ? 1 : -1);
        focusSelectedOption(dialog);
      } else {
        focusSpatialElement(dialog, event.action === "ui-down" ? "down" : "up");
      }
      return;
    }
    if (event.action === "ui-left" || event.action === "ui-right") {
      event.preventDefault();
      focusSpatialElement(dialog, event.action === "ui-right" ? "right" : "left");
      return;
    }
    if (event.action === "ui-page-previous" || event.action === "ui-page-next") {
      if (!callbacks.onSelectBoundary) return;
      event.preventDefault();
      callbacks.onSelectBoundary(event.action === "ui-page-previous" ? "first" : "last");
      focusSelectedOption(dialog);
      return;
    }
    if (event.action !== "ui-confirm" || event.phase !== "pressed") return;
    event.preventDefault();
    const nativeAction = active?.closest("button:not([data-dialog-selection]), a[href]");
    if (nativeAction instanceof HTMLElement) {
      nativeAction.click();
    } else if (callbacks.onPrimaryAction) {
      callbacks.onPrimaryAction();
    } else {
      activateFocusedElement(dialog);
    }
  }, enabled);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !enabled) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const initialFocusFrame = window.requestAnimationFrame(() => {
      focusInitialElement(dialog);
    });
    const handleLegacyKeyDown = (event: KeyboardEvent) => {
      const callbacks = callbacksRef.current;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        callbacks.onClose();
        return;
      }
      if (event.key === "Tab" && trapFocus) {
        event.preventDefault();
        focusSequentialElement(dialog, event.shiftKey ? -1 : 1);
        return;
      }
      if (isTextEntryTarget(event.target)) return;
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && callbacks.onMoveSelection) {
        event.preventDefault();
        callbacks.onMoveSelection(event.key === "ArrowDown" ? 1 : -1);
        focusSelectedOption(dialog);
        return;
      }
      if ((event.key === "Home" || event.key === "End") && callbacks.onSelectBoundary) {
        event.preventDefault();
        callbacks.onSelectBoundary(event.key === "Home" ? "first" : "last");
        focusSelectedOption(dialog);
        return;
      }
      if (event.key !== "Enter" || !callbacks.onPrimaryAction) return;
      const active = event.target instanceof HTMLElement ? event.target : null;
      if (active?.closest("button:not([data-dialog-selection]), a[href]")) return;
      event.preventDefault();
      callbacks.onPrimaryAction();
    };
    if (!inputRuntime) document.addEventListener("keydown", handleLegacyKeyDown, true);
    return () => {
      window.cancelAnimationFrame(initialFocusFrame);
      if (!inputRuntime) document.removeEventListener("keydown", handleLegacyKeyDown, true);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [dialogRef, enabled, inputRuntime, trapFocus]);
}
