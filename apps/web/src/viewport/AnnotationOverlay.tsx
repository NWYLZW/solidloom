import { Fragment, type RefObject } from "react";
import type { FeatureGroup, ModelFeature } from "@solidloom/shared";
import type { Viewport3DProps } from "./types";

interface AnnotationOverlayProps {
  annotationMode: boolean;
  annotationStrings: Viewport3DProps["annotationStrings"];
  features: ModelFeature[];
  groups: FeatureGroup[];
  modelName: string;
  onSelectFeature: (featureId: string, additive: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  overlayRef: RefObject<HTMLDivElement | null>;
  selectedFeatureIds: string[];
  selectedGroupId: string | null;
}

function featureTypeLabel(
  feature: ModelFeature,
  strings: Viewport3DProps["annotationStrings"],
) {
  if (feature.type === "box") return strings.box;
  if (feature.type === "cylinder") return strings.cylinder;
  if (feature.parameters.source?.kind === "room-shell") return strings.roomShell;
  if (feature.parameters.source) return strings.proceduralShell;
  return strings.mesh;
}

export function AnnotationOverlay({
  annotationMode,
  annotationStrings,
  features,
  groups,
  modelName,
  onSelectFeature,
  onSelectGroup,
  overlayRef,
  selectedFeatureIds,
  selectedGroupId,
}: AnnotationOverlayProps) {
  return (
    <div
      className={`annotation-overlay${annotationMode ? " active" : ""}`}
      ref={overlayRef}
      aria-hidden={!annotationMode}
    >
      {annotationMode && (
        <>
          <div className="annotation-assist-banner" role="status">{annotationStrings.assistActive}</div>
          {groups.map((group) => {
            const accessibleLabel = `${annotationStrings.group}: ${group.name}; ${annotationStrings.members}: ${group.featureIds.length}; ${annotationStrings.path}: ${modelName} / ${group.name}`;
            const targetId = `annotation-group-${group.id}`;
            return (
              <Fragment key={group.id}>
                <button
                  className={`annotation-target annotation-group-target${selectedGroupId === group.id ? " selected" : ""}`}
                  data-annotation-kind="group"
                  data-annotation-id={group.id}
                  data-group-id={group.id}
                  data-object-path={`${modelName}/${group.name}`}
                  id={targetId}
                  type="button"
                  aria-label={accessibleLabel}
                  aria-pressed={selectedGroupId === group.id}
                  title={accessibleLabel}
                  onClick={() => onSelectGroup(group.id)}
                >
                  <svg className="annotation-target-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon />
                  </svg>
                </button>
                <span className="annotation-target-label annotation-group-label" data-annotation-label-for={targetId} aria-hidden="true">
                  {group.name}
                </span>
              </Fragment>
            );
          })}
          {features.map((feature) => {
            const parentGroup = groups.find((group) => group.featureIds.includes(feature.id));
            const featureType = featureTypeLabel(feature, annotationStrings);
            const operation = feature.operation === "add" ? annotationStrings.add : annotationStrings.cut;
            const path = [modelName, parentGroup?.name, feature.name].filter(Boolean).join(" / ");
            const accessibleLabel = `${annotationStrings.feature}: ${feature.name}; ${featureType}; ${operation}; ${annotationStrings.path}: ${path}`;
            const targetId = `annotation-feature-${feature.id}`;
            const selected = selectedFeatureIds.includes(feature.id);
            return (
              <Fragment key={feature.id}>
                <button
                  className={`annotation-target annotation-feature-target${selected ? " selected" : ""}`}
                  data-annotation-kind="feature"
                  data-annotation-id={feature.id}
                  data-feature-id={feature.id}
                  data-feature-type={feature.type}
                  data-feature-operation={feature.operation}
                  data-object-path={path}
                  id={targetId}
                  type="button"
                  aria-label={accessibleLabel}
                  aria-pressed={selected}
                  title={accessibleLabel}
                  onClick={() => onSelectFeature(feature.id, false)}
                >
                  <svg className="annotation-target-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polygon />
                  </svg>
                </button>
                <span className="annotation-target-label" data-annotation-label-for={targetId} aria-hidden="true">
                  {feature.name}
                </span>
              </Fragment>
            );
          })}
        </>
      )}
    </div>
  );
}
