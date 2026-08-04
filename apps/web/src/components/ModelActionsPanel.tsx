import type {
  ArticulationAnimationClip,
  ArticulationJoint,
  ArticulationLocomotionProfile,
  ArticulationPosePreset,
} from "@solidloom/shared";
import type { LocomotionState } from "../articulation/locomotion";
import "./ModelActionsPanel.css";

interface ModelActionsPanelProps {
  activeAnimationId: string | null;
  animations: ArticulationAnimationClip[];
  joints: ArticulationJoint[];
  labels: {
    angle: string;
    animations: string;
    closed: string;
    expanded: string;
    half: string;
    modelActions: string;
    locomotionBlend: string;
    locomotionCycle: string;
    locomotionIdle: string;
    locomotionRun: string;
    locomotionSpeed: string;
    locomotionTransitionEnd: string;
    locomotionTransitionStart: string;
    locomotionTransition: string;
    locomotionWalk: string;
    locomotionWalkReference: string;
    locomotionRunReference: string;
    posePresets: string;
    range: string;
    revolute: string;
  };
  onJointValueChange: (joint: ArticulationJoint, value: number) => void;
  onAnimationSelect: (animation: ArticulationAnimationClip) => void;
  onLocomotionProfileChange: (key: "walkReferenceSpeed" | "runReferenceSpeed" | "transitionStartSpeed" | "transitionEndSpeed", value: number) => void;
  onLocomotionSpeedChange: (speed: number) => void;
  onPoseSelect: (pose: ArticulationPosePreset) => void;
  locomotion: ArticulationLocomotionProfile | undefined;
  locomotionBlend: number;
  locomotionCycleDurationMs: number | null;
  locomotionSpeed: number;
  locomotionState: LocomotionState;
  poses: ArticulationPosePreset[];
}

export function ModelActionsPanel({ activeAnimationId, animations, joints, labels, locomotion, locomotionBlend, locomotionCycleDurationMs, locomotionSpeed, locomotionState, onAnimationSelect, onJointValueChange, onLocomotionProfileChange, onLocomotionSpeedChange, onPoseSelect, poses }: ModelActionsPanelProps) {
  const locomotionStateLabel = {
    idle: labels.locomotionIdle,
    walk: labels.locomotionWalk,
    blend: labels.locomotionTransition,
    run: labels.locomotionRun,
  }[locomotionState];
  return (
    <div className="model-actions-panel">
      <strong>{labels.modelActions}</strong>
      {locomotion && (
        <div className="model-actions-locomotion">
          <label>
            <span><strong>{labels.locomotionSpeed}</strong><small>{locomotionStateLabel}</small></span>
            <output>{locomotionSpeed.toFixed(1)} m/s</output>
          </label>
          <input
            aria-label={labels.locomotionSpeed}
            className="model-actions-range"
            max={locomotion.maximumSpeed}
            min={locomotion.minimumSpeed}
            onChange={(event) => onLocomotionSpeedChange(Number(event.target.value))}
            step="0.1"
            type="range"
            value={locomotionSpeed}
          />
          <small>
            {locomotionCycleDurationMs === null
              ? labels.locomotionIdle
              : `${labels.locomotionCycle} ${(locomotionCycleDurationMs / 1_000).toFixed(2)} s · ${labels.locomotionBlend} ${Math.round(locomotionBlend * 100)}%`}
          </small>
          <div className="model-actions-locomotion-settings">
            <label>{labels.locomotionWalkReference}<span><input aria-label={labels.locomotionWalkReference} min="0.1" max={locomotion.maximumSpeed} step="0.1" type="number" value={locomotion.walkReferenceSpeed} onChange={(event) => onLocomotionProfileChange("walkReferenceSpeed", Number(event.target.value))} /> m/s</span></label>
            <label>{labels.locomotionRunReference}<span><input aria-label={labels.locomotionRunReference} min="0.1" max={locomotion.maximumSpeed} step="0.1" type="number" value={locomotion.runReferenceSpeed} onChange={(event) => onLocomotionProfileChange("runReferenceSpeed", Number(event.target.value))} /> m/s</span></label>
            <label>{labels.locomotionTransitionStart}<span><input aria-label={labels.locomotionTransitionStart} min={locomotion.minimumSpeed} max={locomotion.transitionEndSpeed} step="0.1" type="number" value={locomotion.transitionStartSpeed} onChange={(event) => onLocomotionProfileChange("transitionStartSpeed", Number(event.target.value))} /> m/s</span></label>
            <label>{labels.locomotionTransitionEnd}<span><input aria-label={labels.locomotionTransitionEnd} min={locomotion.transitionStartSpeed} max={locomotion.maximumSpeed} step="0.1" type="number" value={locomotion.transitionEndSpeed} onChange={(event) => onLocomotionProfileChange("transitionEndSpeed", Number(event.target.value))} /> m/s</span></label>
          </div>
        </div>
      )}
      {poses.length > 0 && (
        <>
          <small>{labels.posePresets}</small>
          <div className="model-actions-presets">
            {poses.map((pose) => (
              <button type="button" key={pose.id} onClick={() => onPoseSelect(pose)}>{pose.name}</button>
            ))}
          </div>
        </>
      )}
      {animations.length > 0 && (
        <>
          <small>{labels.animations}</small>
          <div className="model-actions-animations">
            {animations.map((animation) => (
              <button className={activeAnimationId === animation.id ? "active" : ""} aria-pressed={activeAnimationId === animation.id} type="button" key={animation.id} onClick={() => onAnimationSelect(animation)}>{animation.name}</button>
            ))}
          </div>
        </>
      )}
      {joints.map((joint) => (
        <div className="model-actions-joint" key={joint.id}>
          <label>
            <span className="model-actions-joint-name"><strong>{joint.name}</strong><small>{labels.revolute}</small></span>
            <span><input aria-label={`${joint.name} ${labels.angle}`} type="number" step="1" min={joint.min} max={joint.max} value={joint.value} onChange={(event) => onJointValueChange(joint, Number(event.target.value))} /> °</span>
          </label>
          <input className="model-actions-range" aria-label={`${joint.name} ${labels.angle}`} type="range" step="1" min={joint.min} max={joint.max} value={joint.value} onChange={(event) => onJointValueChange(joint, Number(event.target.value))} />
          <small>{labels.range} · {joint.min}°–{joint.max}°</small>
          <div className="model-actions-joint-buttons">
            <button type="button" onClick={() => onJointValueChange(joint, joint.min)}>{labels.closed}</button>
            <button type="button" onClick={() => onJointValueChange(joint, (joint.min + joint.restValue) / 2)}>{labels.half}</button>
            <button type="button" onClick={() => onJointValueChange(joint, joint.restValue)}>{labels.expanded}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
