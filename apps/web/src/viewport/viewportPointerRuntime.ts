import * as THREE from "three";
import type { NavigationCameraMode } from "./types";

interface CreateViewportPointerRuntimeOptions {
  adjustNavigationCamera: (yawDelta: number, pitchDelta: number) => void;
  camera: THREE.Camera;
  cameraMode: NavigationCameraMode;
  container: HTMLDivElement;
  domElement: HTMLCanvasElement;
  featureGroup: THREE.Group;
  isTransformGestureActive: () => boolean;
  navigationMode: boolean;
  onOpenContextMenu: (featureId: string | null, point: { x: number; y: number }) => void;
  onSelectFeature: (featureId: string | null, additive: boolean) => void;
  requestRender: () => void;
  setNavigationDestination: (event: { clientX: number; clientY: number }) => boolean;
}

export interface ViewportPointerRuntime {
  dispose: () => void;
  setMouseLookSuspended: (suspended: boolean) => void;
}

export function createViewportPointerRuntime({
  adjustNavigationCamera,
  camera,
  cameraMode,
  container,
  domElement,
  featureGroup,
  isTransformGestureActive,
  navigationMode,
  onOpenContextMenu,
  onSelectFeature,
  requestRender,
  setNavigationDestination,
}: CreateViewportPointerRuntimeOptions): ViewportPointerRuntime {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const mouseLookShield = document.createElement("div");
  mouseLookShield.className = "mouse-look-shield";
  mouseLookShield.setAttribute("aria-hidden", "true");
  container.append(mouseLookShield);

  const hitTestModel = (event: { clientX: number; clientY: number }) => {
    const bounds = domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(featureGroup, true)
      .find((intersection) => typeof intersection.object.userData.featureId === "string");
    return hit ? String(hit.object.userData.featureId) : null;
  };

  let viewportPointerGesture: {
    button: number;
    dragged: boolean;
    pointerId: number;
    startX: number;
    startY: number;
  } | null = null;
  let suppressNextContextMenu = false;
  let hoverHitTestFrame = 0;
  let pendingHoverPoint: { clientX: number; clientY: number } | null = null;
  const scheduleHoverHitTest = (event: PointerEvent) => {
    pendingHoverPoint = { clientX: event.clientX, clientY: event.clientY };
    if (hoverHitTestFrame !== 0) return;
    hoverHitTestFrame = window.requestAnimationFrame(() => {
      hoverHitTestFrame = 0;
      const point = pendingHoverPoint;
      pendingHoverPoint = null;
      const featureId = point ? hitTestModel(point) : null;
      domElement.classList.toggle("object-hovered", featureId !== null);
    });
  };
  let fallbackMouseLookActive = false;
  let fallbackMouseX = 0;
  let fallbackMouseY = 0;
  let mouseLookSuspended = false;
  const deactivateMouseLook = () => {
    fallbackMouseLookActive = false;
    container.classList.remove("pointer-locked", "pointer-lock-fallback");
  };
  const setMouseLookSuspended = (suspended: boolean) => {
    mouseLookSuspended = suspended;
    if (!suspended) return;
    viewportPointerGesture = null;
    if (document.pointerLockElement === domElement) document.exitPointerLock();
    deactivateMouseLook();
  };
  const activateFallbackMouseLook = (clientX: number, clientY: number) => {
    fallbackMouseLookActive = true;
    fallbackMouseX = clientX;
    fallbackMouseY = clientY;
    container.classList.add("pointer-locked", "pointer-lock-fallback");
  };
  const requestMouseLook = (event: MouseEvent) => {
    if (mouseLookSuspended || !navigationMode || cameraMode === "god") return;
    fallbackMouseX = event.clientX;
    fallbackMouseY = event.clientY;
    const requestPointerLock = domElement.requestPointerLock;
    if (typeof requestPointerLock !== "function") {
      activateFallbackMouseLook(event.clientX, event.clientY);
      return;
    }
    try {
      void requestPointerLock.call(domElement).catch(() => {
        activateFallbackMouseLook(event.clientX, event.clientY);
      });
    } catch {
      activateFallbackMouseLook(event.clientX, event.clientY);
    }
  };
  const handleViewportPointerDown = (event: PointerEvent) => {
    if (isTransformGestureActive()) return;
    if (event.button !== 0 && event.button !== 2) return;
    domElement.focus({ preventScroll: true });
    if (event.button === 0 && navigationMode && cameraMode !== "god") return;
    viewportPointerGesture = {
      button: event.button,
      dragged: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };
  const handleViewportPointerMove = (event: PointerEvent) => {
    if (viewportPointerGesture?.pointerId === event.pointerId) {
      const gesture = viewportPointerGesture;
      gesture.dragged ||= Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 3;
    }
    if (navigationMode || viewportPointerGesture?.dragged) {
      pendingHoverPoint = null;
      domElement.classList.remove("object-hovered");
    } else {
      scheduleHoverHitTest(event);
    }
  };
  const handleViewportPointerUp = (event: PointerEvent) => {
    if (!viewportPointerGesture || viewportPointerGesture.pointerId !== event.pointerId) return;
    const gesture = viewportPointerGesture;
    viewportPointerGesture = null;
    if (isTransformGestureActive()) return;
    if (gesture.button === 0 && !gesture.dragged) {
      if (setNavigationDestination(event)) return;
      onSelectFeature(hitTestModel(event), event.metaKey || event.ctrlKey);
    }
    if (gesture.button === 2) suppressNextContextMenu = gesture.dragged;
  };
  const handleViewportContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    if (suppressNextContextMenu) {
      suppressNextContextMenu = false;
      return;
    }
    onOpenContextMenu(hitTestModel(event), { x: event.clientX, y: event.clientY });
  };
  const handleViewportPointerLeave = () => {
    pendingHoverPoint = null;
    if (!viewportPointerGesture) domElement.classList.remove("object-hovered");
  };
  const handleViewportPointerCancel = () => {
    viewportPointerGesture = null;
    domElement.classList.remove("object-hovered");
  };
  const handleMouseLookMouseMove = (event: MouseEvent) => {
    if (mouseLookSuspended) return;
    const nativePointerLocked = document.pointerLockElement === domElement;
    if ((!nativePointerLocked && !fallbackMouseLookActive) || !navigationMode || cameraMode === "god") return;
    const fallbackMovementX = event.clientX - fallbackMouseX;
    const fallbackMovementY = event.clientY - fallbackMouseY;
    const movementX = nativePointerLocked || event.movementX !== 0 ? event.movementX : fallbackMovementX;
    const movementY = nativePointerLocked || event.movementY !== 0 ? event.movementY : fallbackMovementY;
    fallbackMouseX = event.clientX;
    fallbackMouseY = event.clientY;
    adjustNavigationCamera(
      -THREE.MathUtils.clamp(movementX, -240, 240) * 0.0024,
      -THREE.MathUtils.clamp(movementY, -240, 240) * 0.0021,
    );
    requestRender();
  };
  const handlePointerLockChange = () => {
    const nativePointerLocked = document.pointerLockElement === domElement;
    if (nativePointerLocked) {
      fallbackMouseLookActive = false;
      container.classList.add("pointer-locked");
      container.classList.remove("pointer-lock-fallback");
    } else if (!fallbackMouseLookActive) {
      container.classList.remove("pointer-locked");
    }
  };
  const handlePointerLockError = () => {
    if (navigationMode && cameraMode !== "god") activateFallbackMouseLook(fallbackMouseX, fallbackMouseY);
  };
  const handleMouseLookKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || (!fallbackMouseLookActive && document.pointerLockElement !== domElement)) return;
    event.preventDefault();
    event.stopPropagation();
    if (document.pointerLockElement === domElement) document.exitPointerLock();
    deactivateMouseLook();
  };

  domElement.addEventListener("pointerdown", handleViewportPointerDown);
  domElement.addEventListener("click", requestMouseLook);
  domElement.addEventListener("pointermove", handleViewportPointerMove);
  domElement.addEventListener("pointerup", handleViewportPointerUp);
  domElement.addEventListener("pointerleave", handleViewportPointerLeave);
  domElement.addEventListener("pointercancel", handleViewportPointerCancel);
  domElement.addEventListener("contextmenu", handleViewportContextMenu);
  document.addEventListener("mousemove", handleMouseLookMouseMove);
  document.addEventListener("pointerlockchange", handlePointerLockChange);
  document.addEventListener("pointerlockerror", handlePointerLockError);
  document.addEventListener("keydown", handleMouseLookKeyDown, true);

  return {
    setMouseLookSuspended,
    dispose: () => {
      window.cancelAnimationFrame(hoverHitTestFrame);
      domElement.removeEventListener("pointerdown", handleViewportPointerDown);
      domElement.removeEventListener("click", requestMouseLook);
      domElement.removeEventListener("pointermove", handleViewportPointerMove);
      domElement.removeEventListener("pointerup", handleViewportPointerUp);
      domElement.removeEventListener("pointerleave", handleViewportPointerLeave);
      domElement.removeEventListener("pointercancel", handleViewportPointerCancel);
      domElement.removeEventListener("contextmenu", handleViewportContextMenu);
      document.removeEventListener("mousemove", handleMouseLookMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      document.removeEventListener("keydown", handleMouseLookKeyDown, true);
      if (document.pointerLockElement === domElement) document.exitPointerLock();
      deactivateMouseLook();
      mouseLookShield.remove();
    },
  };
}
