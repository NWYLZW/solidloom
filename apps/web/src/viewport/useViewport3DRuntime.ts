import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { JointAnimationRequest } from "../articulation/types";
import {
  navigationFrameFromKeyboard,
  navigationFrameFromSnapshot,
} from "../input";
import { shouldRefreshShadowMap, shouldScheduleViewportFrame } from "../renderPerformance";
import { createAnnotationProjector } from "./annotationProjection";
import { createCameraControllerRuntime } from "./cameraControllerRuntime";
import { createFeatureLodRuntime } from "./featureLodRuntime";
import { createJointAnimationRuntime } from "./jointAnimationRuntime";
import { createModelSceneRuntime } from "./modelSceneRuntime";
import {
  createNavigationRuntime,
  type SavedNavigationRuntimeState,
} from "./navigationRuntime";
import { createRoomSurfaceVisibilityRuntime } from "./roomSurfaceVisibilityRuntime";
import { createRuntimeLifecycle } from "./runtimeLifecycle";
import { GRID_DISPLAY_OFFSET } from "./scenePrimitives";
import { createSelectionTransformRuntime } from "./selectionTransformRuntime";
import type {
  NavigationContainerOperation,
  NavigationContainerPanelState,
  NavigationDeviceOperation,
  NavigationDevicePanelState,
  TransformMode,
  Viewport3DProps,
} from "./types";
import {
  createViewportPointerRuntime,
  type ViewportPointerRuntime,
} from "./viewportPointerRuntime";
import {
  createViewportRenderLoopRuntime,
  type ViewportRenderLoopRuntime,
} from "./viewportRenderLoopRuntime";
import { createViewportSceneRuntime } from "./viewportSceneRuntime";

export function useViewport3DRuntime({
  cutPlane,
  features,
  groups,
  jointAnimation,
  joints,
  label,
  modelId,
  navigation,
  navigationAvatarSkin,
  navigationCanConfigureInteractions,
  navigationCameraMode,
  navigationDynamicBodies,
  navigationFirstPersonAvatarMode,
  navigationInteractions,
  navigationInteractionLabels,
  navigationMode,
  onJointAnimationComplete,
  onSelectFeature,
  onSelectGroup,
  onOpenContextMenu,
  onTransformCommit,
  selectedFeatureIds,
  selectedGroupId,
  semanticInputRuntime,
  theme,
  transformMode,
  viewLabels,
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const axisWidgetRef = useRef<HTMLCanvasElement>(null);
  const annotationOverlayRef = useRef<HTMLDivElement>(null);
  const onSelectFeatureRef = useRef(onSelectFeature);
  const onSelectGroupRef = useRef(onSelectGroup);
  const onOpenContextMenuRef = useRef(onOpenContextMenu);
  const onTransformCommitRef = useRef(onTransformCommit);
  const onJointAnimationCompleteRef = useRef(onJointAnimationComplete);
  const updateSelectionRef = useRef<((featureIds: string[], groupId: string | null) => void) | null>(null);
  const updateTransformRef = useRef<((mode: TransformMode, featureIds: string[], groupId: string | null) => void) | null>(null);
  const updateCutPlaneRef = useRef<((plane: Viewport3DProps["cutPlane"], featureIds: string[], groupId: string | null) => void) | null>(null);
  const playJointAnimationRef = useRef<((request: JointAnimationRequest | null) => void) | null>(null);
  const performNavigationInteractionRef = useRef<((interactionId: string) => boolean) | null>(null);
  const setNavigationFirstPersonAvatarModeRef = useRef<((
    mode: Viewport3DProps["navigationFirstPersonAvatarMode"],
  ) => void) | null>(null);
  const setNavigationInteractionLabelsRef = useRef<((
    labels: Viewport3DProps["navigationInteractionLabels"],
  ) => void) | null>(null);
  const viewportPointerRuntimeRef = useRef<ViewportPointerRuntime | null>(null);
  const performNavigationContainerOperationRef = useRef<((
    interactionId: string,
    operation: NavigationContainerOperation,
  ) => void) | null>(null);
  const performNavigationDeviceOperationRef = useRef<((
    interactionId: string,
    operation: NavigationDeviceOperation,
  ) => void) | null>(null);
  const savedViewRef = useRef<{
    modelId: string;
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);
  const savedNavigationStateRef = useRef<SavedNavigationRuntimeState | null>(null);
  const [navigationInteractionPrompts, setNavigationInteractionPrompts] = useState<Array<{ id: string; label: string }>>([]);
  const [navigationContainerPanel, setNavigationContainerPanel] = useState<NavigationContainerPanelState | null>(null);
  const [navigationDevicePanel, setNavigationDevicePanel] = useState<NavigationDevicePanelState | null>(null);
  const [navigationAimTargetVisible, setNavigationAimTargetVisible] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);

  useEffect(() => {
    onSelectFeatureRef.current = onSelectFeature;
  }, [onSelectFeature]);

  useEffect(() => {
    onSelectGroupRef.current = onSelectGroup;
  }, [onSelectGroup]);

  useEffect(() => {
    onOpenContextMenuRef.current = onOpenContextMenu;
  }, [onOpenContextMenu]);

  useEffect(() => {
    onTransformCommitRef.current = onTransformCommit;
  }, [onTransformCommit]);

  useEffect(() => {
    onJointAnimationCompleteRef.current = onJointAnimationComplete;
  }, [onJointAnimationComplete]);

  useEffect(() => {
    const container = containerRef.current;
    const axisWidget = axisWidgetRef.current;
    if (!container || !axisWidget) return;

    const lifecycle = createRuntimeLifecycle();
    let renderLoop: ViewportRenderLoopRuntime | null = null;
    const requestRender = () => renderLoop?.requestRender();
    let sceneRuntime: ReturnType<typeof createViewportSceneRuntime>;
    try {
      sceneRuntime = lifecycle.add(createViewportSceneRuntime({
        axisWidget,
        container,
        label,
        navigationCameraMode,
        navigationMode,
        onRendererFailureChange: setRendererFailed,
        theme,
        viewLabels,
      }));
    } catch {
      setRendererFailed(true);
      return;
    }

    const {
      axisRenderer,
      camera,
      controls,
      cornerBoxColor,
      infiniteGrid,
      render,
      renderer,
      scene,
      viewCubeRuntime,
    } = sceneRuntime;
    const modelSceneRuntime = lifecycle.add(createModelSceneRuntime({
      features,
      groups,
      joints,
      requestRender,
      scene,
    }));
    const {
      featureGroup,
      featureGroupById,
      featureLodById,
      featureLodEntries,
      featureMeshById,
      groupIdByFeatureId,
      jointRuntimeById,
      roomSurfaceMeshes,
    } = modelSceneRuntime;
    const jointAnimationRuntime = createJointAnimationRuntime(
      jointRuntimeById,
      (animationId) => onJointAnimationCompleteRef.current(animationId),
      requestRender,
    );
    playJointAnimationRef.current = jointAnimationRuntime.play;

    const initialBounds = new THREE.Box3().setFromObject(featureGroup);
    const initialSize = initialBounds.getSize(new THREE.Vector3());
    const maximumDimension = Math.max(initialSize.x, initialSize.y, initialSize.z, 20);
    const navigationRuntime = lifecycle.add(createNavigationRuntime({
      camera,
      controls,
      domElement: renderer.domElement,
      featureGroup,
      featureGroupById,
      featureMeshById,
      groupIdByFeatureId,
      maximumDimension,
      modelId,
      navigation,
      navigationAvatarSkin,
      navigationCanConfigureInteractions,
      navigationCameraMode,
      navigationDynamicBodies,
      navigationFirstPersonAvatarMode,
      navigationInteractionLabels,
      navigationInteractions,
      navigationMode,
      onAimTargetVisibleChange: setNavigationAimTargetVisible,
      onContainerPanelChange: setNavigationContainerPanel,
      onDevicePanelChange: setNavigationDevicePanel,
      onPromptsChange: setNavigationInteractionPrompts,
      requestRender,
      savedState: savedNavigationStateRef.current,
      scene,
    }));
    performNavigationInteractionRef.current = navigationRuntime.performInteraction;
    setNavigationFirstPersonAvatarModeRef.current = navigationRuntime.setFirstPersonAvatarMode;
    setNavigationInteractionLabelsRef.current = navigationRuntime.setInteractionLabels;
    performNavigationContainerOperationRef.current = navigationRuntime.performContainerOperation;
    performNavigationDeviceOperationRef.current = navigationRuntime.performDeviceOperation;

    const roomSurfaceVisibilityRuntime = createRoomSurfaceVisibilityRuntime({
      camera,
      featureMeshById,
      roomSurfaceMeshes,
    });
    const updateAnnotationTargets = createAnnotationProjector({
      camera,
      container,
      featureGroupById,
      featureMeshById,
      overlayRef: annotationOverlayRef,
    });
    const selectionTransformRuntime = lifecycle.add(createSelectionTransformRuntime({
      camera,
      controls,
      cornerBoxColor,
      cutPlane,
      domElement: renderer.domElement,
      featureGroupById,
      featureLodById,
      featureMeshById,
      onTransformCommit: (transforms) => onTransformCommitRef.current(transforms),
      requestRender,
      scene,
      selectedFeatureIds,
      selectedGroupId,
      transformMode,
    }));
    updateSelectionRef.current = selectionTransformRuntime.applySelection;
    updateTransformRef.current = selectionTransformRuntime.applyTransformMode;
    updateCutPlaneRef.current = selectionTransformRuntime.applyCutPlane;

    const bounds = new THREE.Box3().setFromObject(featureGroup);
    const center = bounds.getCenter(new THREE.Vector3());
    const boundingSphere = bounds.getBoundingSphere(new THREE.Sphere());
    const viewDirection = new THREE.Vector3(1.35, 1.05, 1.55).normalize();
    const savedView = savedViewRef.current?.modelId === modelId ? savedViewRef.current : null;
    controls.target.copy(savedView?.target ?? center);
    const usesFirstPersonCamera = Boolean(
      navigationMode && navigation && navigationCameraMode === "first-person",
    );
    const modelNearPlane = Math.max(0.1, maximumDimension / 100);
    const firstPersonNearPlane = navigation
      ? Math.max(0.1, Math.min(modelNearPlane, navigation.agentHeight * 0.01))
      : modelNearPlane;
    camera.fov = usesFirstPersonCamera ? 55 : 38;
    camera.near = usesFirstPersonCamera ? firstPersonNearPlane : modelNearPlane;
    camera.far = maximumDimension * 100;
    camera.updateProjectionMatrix();
    infiniteGrid.mesh.scale.set(camera.far, camera.far, 1);

    const cameraControllerRuntime = lifecycle.add(createCameraControllerRuntime({
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
      getActiveNavigationInteractionId: navigationRuntime.getActiveInteractionId,
      maximumDimension,
      navigationMode,
      performNavigationInteraction: navigationRuntime.performInteraction,
      renderer,
      requestRender,
      savedView,
      selectedFeatureIds,
      selectedGroupId,
      semanticInputEnabled: Boolean(semanticInputRuntime),
      viewCubeRuntime,
      viewDirection,
    }));
    const viewportPointerRuntime = lifecycle.add(createViewportPointerRuntime({
      adjustNavigationCamera: navigationRuntime.adjustCamera,
      camera,
      cameraMode: navigationCameraMode,
      container,
      domElement: renderer.domElement,
      featureGroup,
      isTransformGestureActive: () => selectionTransformRuntime.transformGestureActive,
      navigationMode,
      onOpenContextMenu: (featureId, point) => onOpenContextMenuRef.current(featureId, point),
      onSelectFeature: (featureId, additive) => onSelectFeatureRef.current(featureId, additive),
      requestRender,
      setNavigationDestination: navigationRuntime.setDestination,
    }));
    viewportPointerRuntimeRef.current = viewportPointerRuntime;
    const featureLodRuntime = createFeatureLodRuntime({
      camera,
      container,
      entries: featureLodEntries,
      isFeatureSelected: selectionTransformRuntime.isFeatureSelected,
    });
    const readNavigationInput = () => semanticInputRuntime
      ? navigationFrameFromSnapshot(semanticInputRuntime.getSnapshot())
      : navigationFrameFromKeyboard(cameraControllerRuntime.keyboardNavigationKeys);
    const unsubscribeInputChange = semanticInputRuntime?.subscribe(() => requestRender());
    const unsubscribeInputAction = semanticInputRuntime?.subscribeAction((event) => {
      if (event.context !== "gameplay" || event.phase !== "pressed" || event.action !== "primary") return;
      const interactionId = navigationRuntime.getActiveInteractionId();
      if (!interactionId) return;
      event.preventDefault();
      navigationRuntime.performInteraction(interactionId);
      requestRender();
    });

    renderLoop = lifecycle.add(createViewportRenderLoopRuntime({
      onFrame: ({ deltaSeconds, frameTime, renderRequested }) => {
        const navigationInput = readNavigationInput();
        const controlsChanged = !cameraControllerRuntime.viewTransitionActive
          && (!navigationMode || navigationCameraMode === "god")
          ? controls.update()
          : false;
        const navigationActive = navigationRuntime.needsContinuousRendering(navigationInput);
        const continuousRendering = Boolean(
          navigationActive
          || cameraControllerRuntime.viewTransitionActive
          || jointAnimationRuntime.active
          || selectionTransformRuntime.transformGestureActive
        );
        if (!renderRequested && !controlsChanged && !continuousRendering) return false;

        const jointAnimationRunning = jointAnimationRuntime.active;
        jointAnimationRuntime.update(frameTime);
        const viewTransitionRunning = cameraControllerRuntime.viewTransitionActive;
        cameraControllerRuntime.updateTransition(frameTime);
        const navigationFrame = navigationRuntime.update({
          deltaSeconds,
          ...navigationInput,
          rotateCamera: cameraControllerRuntime.rotateCamera,
          viewTransitionActive: viewTransitionRunning,
        });
        infiniteGrid.mesh.position.set(camera.position.x, GRID_DISPLAY_OFFSET, camera.position.z);
        const roomVisibilityChanged = roomSurfaceVisibilityRuntime.update();
        const lodChanged = featureLodRuntime.update();
        if (shouldRefreshShadowMap({
          jointAnimationActive: jointAnimationRunning,
          navigationObjectChanged: navigationFrame.navigationObjectChanged || lodChanged,
          roomVisibilityChanged,
          transformActive: selectionTransformRuntime.transformGestureActive,
        })) {
          renderer.shadowMap.needsUpdate = true;
        }
        updateAnnotationTargets();
        cameraControllerRuntime.updateAxisWidget();
        render();
        return shouldScheduleViewportFrame({
          controlsChanged,
          jointAnimationActive: jointAnimationRuntime.active,
          navigationActive: navigationRuntime.needsContinuousRendering(readNavigationInput()),
          renderRequested: renderLoop?.renderRequested ?? false,
          transformActive: selectionTransformRuntime.transformGestureActive,
          viewTransitionActive: cameraControllerRuntime.viewTransitionActive,
        });
      },
    }));

    return () => {
      unsubscribeInputAction?.();
      unsubscribeInputChange?.();
      if (updateSelectionRef.current === selectionTransformRuntime.applySelection) updateSelectionRef.current = null;
      if (updateTransformRef.current === selectionTransformRuntime.applyTransformMode) updateTransformRef.current = null;
      if (updateCutPlaneRef.current === selectionTransformRuntime.applyCutPlane) updateCutPlaneRef.current = null;
      if (playJointAnimationRef.current === jointAnimationRuntime.play) playJointAnimationRef.current = null;
      if (performNavigationInteractionRef.current === navigationRuntime.performInteraction) {
        performNavigationInteractionRef.current = null;
      }
      if (setNavigationFirstPersonAvatarModeRef.current === navigationRuntime.setFirstPersonAvatarMode) {
        setNavigationFirstPersonAvatarModeRef.current = null;
      }
      if (setNavigationInteractionLabelsRef.current === navigationRuntime.setInteractionLabels) {
        setNavigationInteractionLabelsRef.current = null;
      }
      if (performNavigationContainerOperationRef.current === navigationRuntime.performContainerOperation) {
        performNavigationContainerOperationRef.current = null;
      }
      if (performNavigationDeviceOperationRef.current === navigationRuntime.performDeviceOperation) {
        performNavigationDeviceOperationRef.current = null;
      }
      if (viewportPointerRuntimeRef.current === viewportPointerRuntime) viewportPointerRuntimeRef.current = null;
      savedNavigationStateRef.current = navigationRuntime.captureState();
      if (!navigationMode || navigationCameraMode === "god") {
        savedViewRef.current = {
          modelId,
          position: camera.position.clone(),
          target: controls.target.clone(),
        };
      }
      lifecycle.dispose();
    };
  }, [
    features,
    groups,
    joints,
    label,
    modelId,
    navigation,
    navigationAvatarSkin,
    navigationCanConfigureInteractions,
    navigationCameraMode,
    navigationDynamicBodies,
    navigationInteractions,
    navigationMode,
    semanticInputRuntime,
    theme,
    viewLabels,
  ]);

  useEffect(() => {
    playJointAnimationRef.current?.(jointAnimation);
  }, [jointAnimation]);

  useEffect(() => {
    setNavigationFirstPersonAvatarModeRef.current?.(navigationFirstPersonAvatarMode);
  }, [navigationFirstPersonAvatarMode]);

  useEffect(() => {
    setNavigationInteractionLabelsRef.current?.(navigationInteractionLabels);
  }, [navigationInteractionLabels]);

  useEffect(() => {
    updateSelectionRef.current?.(selectedFeatureIds, selectedGroupId);
  }, [selectedFeatureIds, selectedGroupId]);

  useEffect(() => {
    updateTransformRef.current?.(transformMode, selectedFeatureIds, selectedGroupId);
  }, [selectedFeatureIds, selectedGroupId, transformMode]);

  useEffect(() => {
    updateCutPlaneRef.current?.(cutPlane, selectedFeatureIds, selectedGroupId);
  }, [cutPlane, selectedFeatureIds, selectedGroupId]);

  useEffect(() => {
    viewportPointerRuntimeRef.current?.setMouseLookSuspended(
      navigationContainerPanel !== null || navigationDevicePanel !== null,
    );
  }, [navigationContainerPanel, navigationDevicePanel]);

  const performNavigationInteraction = (interactionId: string) => {
    const panelOpened = performNavigationInteractionRef.current?.(interactionId) ?? false;
    viewportPointerRuntimeRef.current?.setMouseLookSuspended(panelOpened);
    if (panelOpened) return;
    containerRef.current
      ?.querySelector<HTMLCanvasElement>("canvas[data-testid='model-canvas']")
      ?.focus({ preventScroll: true });
  };
  const performNavigationContainerOperation = (
    interactionId: string,
    operation: NavigationContainerOperation,
  ) => {
    performNavigationContainerOperationRef.current?.(interactionId, operation);
  };
  const performNavigationDeviceOperation = (
    interactionId: string,
    operation: NavigationDeviceOperation,
  ) => {
    performNavigationDeviceOperationRef.current?.(interactionId, operation);
  };

  return {
    annotationOverlayRef,
    axisWidgetRef,
    containerRef,
    navigationAimTargetVisible,
    navigationContainerPanel,
    navigationDevicePanel,
    navigationInteractionPrompts,
    performNavigationContainerOperation,
    performNavigationDeviceOperation,
    performNavigationInteraction,
    rendererFailed,
  };
}
