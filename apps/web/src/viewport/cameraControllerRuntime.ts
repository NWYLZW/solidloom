import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { clampOrbitDirection, rotateOrbitOffset } from "./cameraOrbitMath";
import type { createViewCubeRuntime } from "./viewCubeRuntime";

interface SavedCameraView {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

interface CreateCameraControllerRuntimeOptions {
  axisRenderer: THREE.WebGLRenderer;
  axisWidget: HTMLCanvasElement;
  boundingSphere: THREE.Sphere;
  bounds: THREE.Box3;
  camera: THREE.PerspectiveCamera;
  center: THREE.Vector3;
  container: HTMLDivElement;
  controls: OrbitControls;
  featureGroupById: Map<string, THREE.Group>;
  featureMeshById: Map<string, THREE.Mesh>;
  getActiveNavigationInteractionId: () => string | null;
  maximumDimension: number;
  navigationMode: boolean;
  performNavigationInteraction: (interactionId: string) => void;
  renderer: THREE.WebGLRenderer;
  requestRender: () => void;
  savedView: SavedCameraView | null;
  selectedFeatureIds: string[];
  selectedGroupId: string | null;
  viewCubeRuntime: ReturnType<typeof createViewCubeRuntime>;
  viewDirection: THREE.Vector3;
}

interface ViewTransition {
  endPosition: THREE.Vector3;
  endQuaternion: THREE.Quaternion;
  startedAt: number;
  startPosition: THREE.Vector3;
  startQuaternion: THREE.Quaternion;
}

export interface CameraControllerRuntime {
  dispose: () => void;
  keyboardNavigationKeys: Set<string>;
  rotateCamera: (deltaX: number, deltaY: number) => void;
  updateAxisWidget: () => void;
  updateTransition: (frameTime: number) => void;
  readonly viewTransitionActive: boolean;
}

export function createCameraControllerRuntime({
  axisRenderer,
  axisWidget,
  boundingSphere,
  bounds,
  camera,
  center,
  container,
  controls,
  featureGroupById,
  featureMeshById,
  getActiveNavigationInteractionId,
  maximumDimension,
  navigationMode,
  performNavigationInteraction,
  renderer,
  requestRender,
  savedView,
  selectedFeatureIds,
  selectedGroupId,
  viewCubeRuntime,
  viewDirection,
}: CreateCameraControllerRuntimeOptions): CameraControllerRuntime {
  const {
    axisCamera,
    axisScene,
    faceDefinitions,
    gridCellHoverMaterial,
    gridCellMaterial,
    gridCellMeshes,
    orientationGroup,
    viewCube,
  } = viewCubeRuntime;
  const previousCameraQuaternion = new THREE.Quaternion();
  let axisWidgetInitialized = false;
  let hoveredCells: THREE.Mesh[] = [];
  let hoveredDirectionKey = "";
  const renderAxisWidget = () => {
    orientationGroup.quaternion.copy(camera.quaternion).invert();
    axisRenderer.render(axisScene, axisCamera);
  };
  const updateAxisWidget = () => {
    if (axisWidgetInitialized && 1 - Math.abs(previousCameraQuaternion.dot(camera.quaternion)) < 0.000001) return;
    previousCameraQuaternion.copy(camera.quaternion);
    renderAxisWidget();
    axisWidgetInitialized = true;
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hitTestViewCube = (event: PointerEvent) => {
    const widgetBounds = axisWidget.getBoundingClientRect();
    pointer.set(
      ((event.clientX - widgetBounds.left) / widgetBounds.width) * 2 - 1,
      -((event.clientY - widgetBounds.top) / widgetBounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, axisCamera);
    const hit = raycaster.intersectObjects([...gridCellMeshes, viewCube], false)[0];
    if (!hit) return null;
    if (hit.object.userData.viewDirection instanceof THREE.Vector3) {
      return {
        direction: hit.object.userData.viewDirection as THREE.Vector3,
        faceIndex: Number(hit.object.userData.faceIndex),
      };
    }
    const faceIndex = hit.face?.materialIndex ?? -1;
    const faceDefinition = faceDefinitions[faceIndex];
    return !faceDefinition ? null : { direction: faceDefinition.normal, faceIndex };
  };
  const setHoveredTarget = (direction: THREE.Vector3 | null, isInteractive: boolean) => {
    const directionKey = direction
      ? direction.toArray().map((component) => Math.round(component * 1000)).join(":")
      : "";
    if (hoveredDirectionKey === directionKey && axisWidget.classList.contains("face-hovered") === isInteractive) return;
    for (const cell of hoveredCells) cell.material = gridCellMaterial;
    hoveredCells = direction
      ? gridCellMeshes.filter((cell) => (cell.userData.viewDirection as THREE.Vector3).dot(direction) > 0.999)
      : [];
    for (const cell of hoveredCells) cell.material = gridCellHoverMaterial;
    hoveredDirectionKey = directionKey;
    axisWidget.dataset.viewDirection = directionKey;
    axisWidget.classList.toggle("face-hovered", isInteractive);
    renderAxisWidget();
  };

  let viewTransition: ViewTransition | null = null;
  const switchToView = (direction: THREE.Vector3) => {
    const orbitDirection = clampOrbitDirection(direction);
    const distance = Math.max(camera.position.distanceTo(controls.target), maximumDimension * 1.4);
    const endPosition = controls.target.clone().addScaledVector(orbitDirection, distance);
    const targetCamera = camera.clone();
    targetCamera.position.copy(endPosition);
    targetCamera.up.set(0, 1, 0);
    targetCamera.lookAt(controls.target);
    viewTransition = {
      endPosition,
      endQuaternion: targetCamera.quaternion.clone(),
      startedAt: performance.now(),
      startPosition: camera.position.clone(),
      startQuaternion: camera.quaternion.clone(),
    };
    requestRender();
  };
  const frameBounds = (targetBounds: THREE.Box3) => {
    if (targetBounds.isEmpty()) return;
    const targetCenter = targetBounds.getCenter(new THREE.Vector3());
    const targetSphere = targetBounds.getBoundingSphere(new THREE.Sphere());
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const distance = Math.max(
      targetSphere.radius / Math.max(0.01, Math.sin(limitingFov / 2)) * 1.18,
      maximumDimension * 0.08,
    );
    const direction = camera.position.clone().sub(controls.target);
    if (direction.lengthSq() < 0.0001) direction.copy(viewDirection);
    direction.normalize();
    viewTransition = null;
    controls.target.copy(targetCenter);
    camera.position.copy(targetCenter).addScaledVector(direction, distance);
    camera.lookAt(targetCenter);
    controls.update();
  };
  const frameSelection = () => {
    const selectionBounds = new THREE.Box3();
    const selectionObjects = selectedGroupId
      ? [featureGroupById.get(selectedGroupId)].filter((object): object is THREE.Group => Boolean(object))
      : selectedFeatureIds
        .map((id) => featureMeshById.get(id))
        .filter((object): object is THREE.Mesh => Boolean(object));
    if (selectionObjects.length === 0) {
      frameBounds(bounds);
      return;
    }
    selectionObjects.forEach((object) => selectionBounds.expandByObject(object));
    frameBounds(selectionBounds);
  };
  const rotateCamera = (deltaX: number, deltaY: number) => {
    const offset = camera.position.clone().sub(controls.target);
    rotateOrbitOffset(offset, deltaX, deltaY);
    camera.up.set(0, 1, 0);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    controls.update();
  };

  type AxisTarget = ReturnType<typeof hitTestViewCube>;
  let axisPointerGesture: {
    dragged: boolean;
    lastX: number;
    lastY: number;
    pointerId: number;
    startX: number;
    startY: number;
    target: AxisTarget;
  } | null = null;
  const handleAxisPointerMove = (event: PointerEvent) => {
    if (!axisPointerGesture || axisPointerGesture.pointerId !== event.pointerId) {
      const target = hitTestViewCube(event);
      setHoveredTarget(target?.direction ?? null, target !== null);
      return;
    }
    const totalDistance = Math.hypot(
      event.clientX - axisPointerGesture.startX,
      event.clientY - axisPointerGesture.startY,
    );
    if (totalDistance > 3) {
      axisPointerGesture.dragged = true;
      axisWidget.classList.add("dragging");
      setHoveredTarget(null, false);
    }
    if (axisPointerGesture.dragged) {
      rotateCamera(event.clientX - axisPointerGesture.lastX, event.clientY - axisPointerGesture.lastY);
    }
    axisPointerGesture.lastX = event.clientX;
    axisPointerGesture.lastY = event.clientY;
  };
  const handleAxisPointerLeave = () => {
    if (!axisPointerGesture) setHoveredTarget(null, false);
  };
  const handleAxisPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    renderer.domElement.focus({ preventScroll: true });
    viewTransition = null;
    axisPointerGesture = {
      dragged: false,
      lastX: event.clientX,
      lastY: event.clientY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      target: hitTestViewCube(event),
    };
    axisWidget.setPointerCapture(event.pointerId);
  };
  const handleAxisPointerUp = (event: PointerEvent) => {
    if (!axisPointerGesture || axisPointerGesture.pointerId !== event.pointerId) return;
    const gesture = axisPointerGesture;
    axisPointerGesture = null;
    axisWidget.classList.remove("dragging");
    if (axisWidget.hasPointerCapture(event.pointerId)) axisWidget.releasePointerCapture(event.pointerId);
    if (!gesture.dragged) {
      const target = hitTestViewCube(event) ?? gesture.target;
      if (target) {
        setHoveredTarget(null, false);
        switchToView(target.direction);
      }
    }
  };
  const handleAxisPointerCancel = (event: PointerEvent) => {
    if (!axisPointerGesture || axisPointerGesture.pointerId !== event.pointerId) return;
    axisPointerGesture = null;
    axisWidget.classList.remove("dragging");
    setHoveredTarget(null, false);
  };
  const cancelViewTransition = () => {
    viewTransition = null;
  };
  axisWidget.addEventListener("pointermove", handleAxisPointerMove);
  axisWidget.addEventListener("pointerleave", handleAxisPointerLeave);
  axisWidget.addEventListener("pointerdown", handleAxisPointerDown);
  axisWidget.addEventListener("pointerup", handleAxisPointerUp);
  axisWidget.addEventListener("pointercancel", handleAxisPointerCancel);
  controls.addEventListener("start", cancelViewTransition);

  const keyboardNavigationKeys = new Set<string>();
  const navigationCodes = new Set([
    "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE",
    "Space",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "ShiftLeft", "ShiftRight", "AltLeft", "AltRight",
  ]);
  const handleViewportKeyDown = (event: KeyboardEvent) => {
    if (document.activeElement !== renderer.domElement || event.metaKey || event.ctrlKey) return;
    if (event.code === "KeyS" && event.shiftKey) return;
    const activeInteractionId = getActiveNavigationInteractionId();
    if (event.code === "KeyE" && navigationMode && activeInteractionId && !event.repeat) {
      event.preventDefault();
      performNavigationInteraction(activeInteractionId);
      return;
    }
    if (navigationCodes.has(event.code)) {
      event.preventDefault();
      viewTransition = null;
      keyboardNavigationKeys.add(event.code);
      requestRender();
      return;
    }
    if (event.repeat) return;
    if (event.code === "KeyF") {
      event.preventDefault();
      frameSelection();
    } else if (event.code === "Home") {
      event.preventDefault();
      frameBounds(bounds);
    } else if (event.code === "Digit1") {
      event.preventDefault();
      switchToView(new THREE.Vector3(0, 0, 1));
    } else if (event.code === "Digit3") {
      event.preventDefault();
      switchToView(new THREE.Vector3(1, 0, 0));
    } else if (event.code === "Digit7") {
      event.preventDefault();
      switchToView(new THREE.Vector3(0, 1, 0));
    }
  };
  const handleViewportKeyUp = (event: KeyboardEvent) => {
    keyboardNavigationKeys.delete(event.code);
    requestRender();
  };
  const clearViewportKeys = () => {
    keyboardNavigationKeys.clear();
    requestRender();
  };
  window.addEventListener("keydown", handleViewportKeyDown);
  window.addEventListener("keyup", handleViewportKeyUp);
  window.addEventListener("blur", clearViewportKeys);

  let cameraFitted = false;
  const resize = () => {
    requestRender();
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    if (!cameraFitted) {
      if (savedView) {
        camera.up.set(0, 1, 0);
        camera.position.copy(savedView.position);
      } else {
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
        const limitingFov = Math.min(verticalFov, horizontalFov);
        const distance = (boundingSphere.radius / Math.sin(limitingFov / 2)) * 1.18;
        camera.position.copy(center).add(viewDirection.clone().multiplyScalar(distance));
      }
      cameraFitted = true;
    }
    camera.updateProjectionMatrix();
    controls.update();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const updateTransition = (frameTime: number) => {
    if (!viewTransition) return;
    const progress = THREE.MathUtils.clamp((frameTime - viewTransition.startedAt) / 280, 0, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(viewTransition.startPosition, viewTransition.endPosition, easedProgress);
    camera.quaternion.slerpQuaternions(
      viewTransition.startQuaternion,
      viewTransition.endQuaternion,
      easedProgress,
    );
    if (progress >= 1) {
      camera.up.set(0, 1, 0);
      viewTransition = null;
      controls.update();
    }
  };

  return {
    keyboardNavigationKeys,
    rotateCamera,
    updateAxisWidget,
    updateTransition,
    get viewTransitionActive() {
      return Boolean(viewTransition);
    },
    dispose: () => {
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleViewportKeyDown);
      window.removeEventListener("keyup", handleViewportKeyUp);
      window.removeEventListener("blur", clearViewportKeys);
      axisWidget.removeEventListener("pointermove", handleAxisPointerMove);
      axisWidget.removeEventListener("pointerleave", handleAxisPointerLeave);
      axisWidget.removeEventListener("pointerdown", handleAxisPointerDown);
      axisWidget.removeEventListener("pointerup", handleAxisPointerUp);
      axisWidget.removeEventListener("pointercancel", handleAxisPointerCancel);
      controls.removeEventListener("start", cancelViewTransition);
    },
  };
}
