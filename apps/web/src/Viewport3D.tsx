import { AnnotationOverlay } from "./viewport/AnnotationOverlay";
import { NavigationOverlays } from "./viewport/NavigationOverlays";
import { RendererFallback } from "./viewport/RendererFallback";
import { useViewport3DRuntime } from "./viewport/useViewport3DRuntime";
import type { Viewport3DProps } from "./viewport/types";

export type {
  NavigationCameraMode,
  NavigationInteractionDescriptor,
  TransformCommit,
  TransformMode,
  Viewport3DProps,
} from "./viewport/types";

export function Viewport3D(props: Viewport3DProps) {
  const runtime = useViewport3DRuntime(props);
  const {
    annotationMode,
    annotationStrings,
    features,
    groups,
    modelName,
    navigation,
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
