import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { NavigationCameraMode } from "./types";
import {
  AXIS_WIDGET_SIZE,
  createInfiniteGrid,
} from "./scenePrimitives";
import { createViewCubeRuntime } from "./viewCubeRuntime";
import type { RuntimeDisposable } from "./runtimeLifecycle";

interface CreateViewportSceneRuntimeOptions {
  axisWidget: HTMLCanvasElement;
  container: HTMLDivElement;
  label: string;
  navigationCameraMode: NavigationCameraMode;
  navigationMode: boolean;
  onRendererFailureChange: (failed: boolean) => void;
  theme: "light" | "dark" | "system";
  viewLabels: [string, string, string, string, string, string];
}

export interface ViewportSceneRuntime extends RuntimeDisposable {
  readonly axisRenderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly cornerBoxColor: string;
  readonly infiniteGrid: ReturnType<typeof createInfiniteGrid>;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly viewCubeRuntime: ReturnType<typeof createViewCubeRuntime>;
}

export function createViewportSceneRuntime({
  axisWidget,
  container,
  label,
  navigationCameraMode,
  navigationMode,
  onRendererFailureChange,
  theme,
  viewLabels,
}: CreateViewportSceneRuntimeOptions): ViewportSceneRuntime {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  let axisRenderer: THREE.WebGLRenderer;
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.domElement.setAttribute("aria-label", label);
    renderer.domElement.setAttribute("data-testid", "model-canvas");
    renderer.domElement.tabIndex = 0;
    container.append(renderer.domElement);

    axisRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      canvas: axisWidget,
    });
    axisRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    axisRenderer.setSize(AXIS_WIDGET_SIZE, AXIS_WIDGET_SIZE, false);
    axisRenderer.outputColorSpace = THREE.SRGBColorSpace;
    axisRenderer.setClearColor(0x000000, 0);
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    onRendererFailureChange(true);
    throw error;
  }

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    onRendererFailureChange(true);
  };
  const handleContextRestored = () => onRendererFailureChange(false);
  renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
  renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);
  axisWidget.addEventListener("webglcontextlost", handleContextLost);
  axisWidget.addEventListener("webglcontextrestored", handleContextRestored);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10_000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.enabled = !navigationMode || navigationCameraMode === "god";

  const viewCubeRuntime = createViewCubeRuntime(axisWidget, viewLabels);
  const computedStyle = window.getComputedStyle(container);
  const gridMajor = computedStyle.getPropertyValue("--color-grid-major").trim() || "#ccccc5";
  const gridMinor = computedStyle.getPropertyValue("--color-grid-minor").trim() || "#d5d5ce";
  const infiniteGrid = createInfiniteGrid(gridMinor, gridMajor, camera.far);
  scene.add(infiniteGrid.mesh);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x53604d, theme === "dark" ? 1.8 : 1.45);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xffffff, theme === "dark" ? 3.3 : 2.5);
  keyLight.position.set(80, 120, 70);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xbed7ff, 1.1);
  fillLight.position.set(-90, 50, -60);
  scene.add(fillLight);
  onRendererFailureChange(false);

  let disposed = false;
  return {
    axisRenderer,
    camera,
    controls,
    cornerBoxColor: computedStyle.getPropertyValue("--color-text").trim() || "#f7f8f3",
    infiniteGrid,
    renderer,
    scene,
    viewCubeRuntime,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      axisWidget.removeEventListener("webglcontextlost", handleContextLost);
      axisWidget.removeEventListener("webglcontextrestored", handleContextRestored);
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      axisRenderer.dispose();
      viewCubeRuntime.dispose();
      infiniteGrid.geometry.dispose();
      infiniteGrid.material.dispose();
      renderer.domElement.remove();
    },
  };
}
