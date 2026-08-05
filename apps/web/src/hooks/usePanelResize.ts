import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

type ResizeCursorClass = "resizing-column" | "resizing-row";
type ResizeOrientation = "horizontal" | "vertical";

export function usePanelResize() {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const beginResize = (
    event: ReactPointerEvent<HTMLDivElement>,
    cursorClass: ResizeCursorClass,
    update: (deltaX: number, deltaY: number) => void,
  ) => {
    event.preventDefault();
    cleanupRef.current?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const onPointerMove = (moveEvent: PointerEvent) => update(moveEvent.clientX - startX, moveEvent.clientY - startY);
    const cleanup = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      document.body.classList.remove("resizing-column", "resizing-row");
      cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;
    document.body.classList.add(cursorClass);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  const resizeWithKeyboard = (
    event: KeyboardEvent<HTMLDivElement>,
    orientation: ResizeOrientation,
    update: (delta: number) => void,
  ) => {
    const delta = orientation === "vertical"
      ? event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0
      : event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0;
    if (delta === 0) return;
    event.preventDefault();
    update(delta);
  };

  return { beginResize, resizeWithKeyboard };
}
