const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export type FocusDirection = "up" | "down" | "left" | "right";

export function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => (
    element.getAttribute("aria-hidden") !== "true" && !element.hidden
  ));
}

export function focusInitialElement(container: HTMLElement) {
  const target = container.querySelector<HTMLElement>("[data-dialog-initial-focus='true']")
    ?? container.querySelector<HTMLElement>("[aria-current='page']")
    ?? getFocusableElements(container)[0]
    ?? container;
  target.focus({ preventScroll: true });
  return target;
}

export function focusSequentialElement(container: HTMLElement, direction: -1 | 1) {
  const elements = getFocusableElements(container);
  if (elements.length === 0) return focusInitialElement(container);
  const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
  const nextIndex = currentIndex === -1
    ? (direction === 1 ? 0 : elements.length - 1)
    : (currentIndex + direction + elements.length) % elements.length;
  elements[nextIndex]?.focus({ preventScroll: true });
  return elements[nextIndex] ?? null;
}

export function focusSpatialElement(container: HTMLElement, direction: FocusDirection) {
  const elements = getFocusableElements(container);
  if (elements.length === 0) return focusInitialElement(container);
  const active = document.activeElement instanceof HTMLElement
    && container.contains(document.activeElement)
    ? document.activeElement
    : focusInitialElement(container);
  const activeRect = active.getBoundingClientRect();
  const activeCenter = {
    x: activeRect.left + activeRect.width / 2,
    y: activeRect.top + activeRect.height / 2,
  };
  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  const candidate = elements
    .filter((element) => element !== active)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const primary = (center[axis] - activeCenter[axis]) * sign;
      const crossAxis = axis === "x" ? "y" : "x";
      const secondary = Math.abs(center[crossAxis] - activeCenter[crossAxis]);
      return { element, primary, score: primary + secondary * 1.8 };
    })
    .filter(({ primary }) => primary > 1)
    .sort((first, second) => first.score - second.score)[0]?.element;
  candidate?.focus({ preventScroll: true });
  return candidate ?? null;
}

export function adjustFocusedControl(container: HTMLElement, direction: -1 | 1) {
  const active = document.activeElement;
  if (!container.contains(active)) return false;
  if (active instanceof HTMLSelectElement) {
    const options = Array.from(active.options);
    let candidate = active.selectedIndex + direction;
    while (candidate >= 0 && candidate < options.length && options[candidate]?.disabled) {
      candidate += direction;
    }
    if (candidate < 0 || candidate >= options.length) return true;
    active.selectedIndex = candidate;
    active.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  if (!(active instanceof HTMLInputElement) || active.type !== "range") return false;
  if (direction > 0) active.stepUp();
  else active.stepDown();
  active.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

export function activateFocusedElement(container: HTMLElement) {
  const active = document.activeElement;
  if (active instanceof HTMLElement && container.contains(active)) {
    active.click();
    return true;
  }
  const initial = focusInitialElement(container);
  if (initial instanceof HTMLButtonElement || initial instanceof HTMLAnchorElement) {
    initial.click();
    return true;
  }
  return false;
}
