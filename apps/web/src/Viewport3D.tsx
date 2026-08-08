import { InteractionSurface } from "./interaction-ui/InteractionSurface";
import { AnnotationOverlay } from "./viewport/AnnotationOverlay";
import { NavigationOverlays } from "./viewport/NavigationOverlays";
import { RendererFallback } from "./viewport/RendererFallback";
import { useViewport3DRuntime } from "./viewport/useViewport3DRuntime";
import type { Viewport3DProps } from "./viewport/types";

export type {
  NavigationCameraMode,
  NavigationFirstPersonAvatarMode,
  NavigationInteractionDescriptor,
  TransformCommit,
  TransformMode,
  Viewport3DProps,
} from "./viewport/types";
export {
  createInteractionUI,
  InteractionUIProvider,
  mergeInteractionUI,
} from "./interaction-ui";
export type {
  ContainerEmptySlotProps,
  ContainerInteractionRendererProps,
  ContainerInteractionSlots,
  ContainerItemSlotProps,
  InteractionPresentation,
  ResolvedInteractionPresentation,
  InteractionRendererRegistry,
  InteractionSlotRegistry,
  InteractionUIConfig,
  InteractionUIProviderProps,
  InteractionSurfaceProps,
  InteractionUITheme,
  InteractionUITokens,
} from "./interaction-ui";

export function Viewport3D(props: Viewport3DProps) {
  const runtime = useViewport3DRuntime(props);
  const {
    annotationMode,
    annotationStrings,
    features,
    groups,
    interactionUI,
    modelName,
    navigation,
    navigationCameraControlsVisible,
    navigationCameraLabels,
    navigationCameraMode,
    navigationInteractionLabels,
    navigationMode,
    navigationModeLabel,
    onNavigationCameraModeChange,
    onSelectFeature,
    onSelectGroup,
    rendererFailureLabel,
    rendererReloadLabel,
    selectedFeatureIds,
    selectedGroupId,
    viewCubeLabel,
  } = props;

  return (
    <div
      className={`viewport-3d${navigationMode ? " navigation-active" : ""}`}
      ref={runtime.containerRef}
    >
      <canvas className="axis-widget" ref={runtime.axisWidgetRef} aria-label={viewCubeLabel} />
      <NavigationOverlays
        aimTargetVisible={runtime.navigationAimTargetVisible}
        cameraControlsVisible={navigationCameraControlsVisible}
        cameraLabels={navigationCameraLabels}
        cameraMode={navigationCameraMode}
        interactionKeyHint={navigationInteractionLabels.keyHint}
        modeLabel={navigationModeLabel}
        navigation={navigation}
        navigationMode={navigationMode}
        onCameraModeChange={onNavigationCameraModeChange}
        onInteraction={runtime.performNavigationInteraction}
        prompts={runtime.navigationInteractionPrompts}
      />
      <InteractionSurface
        config={interactionUI}
        container={runtime.navigationContainerPanel}
        device={runtime.navigationDevicePanel}
        labels={navigationInteractionLabels}
        onContainerOperation={runtime.performNavigationContainerOperation}
        onDeviceOperation={runtime.performNavigationDeviceOperation}
      />
      {runtime.rendererFailed && (
        <RendererFallback
          failureLabel={rendererFailureLabel}
          reloadLabel={rendererReloadLabel}
        />
      )}
      <AnnotationOverlay
        annotationMode={annotationMode}
        annotationStrings={annotationStrings}
        features={features}
        groups={groups}
        modelName={modelName}
        onSelectFeature={onSelectFeature}
        onSelectGroup={onSelectGroup}
        overlayRef={runtime.annotationOverlayRef}
        selectedFeatureIds={selectedFeatureIds}
        selectedGroupId={selectedGroupId}
      />
    </div>
  );
}
