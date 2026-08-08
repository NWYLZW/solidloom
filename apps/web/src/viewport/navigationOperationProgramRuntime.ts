import * as THREE from "three";
import type { NavigationInteractionRuntime } from "./navigationInteractionRuntime";
import type { NavigationOperationMotion, NavigationOperationProgram } from "./types";

export interface SavedNavigationOperationProgramState {
  collectedOptionIds: string[];
  readyOptionId: string | null;
}

interface ObjectSnapshot {
  object: THREE.Object3D;
  position: THREE.Vector3;
  scale: THREE.Vector3;
  visible: boolean;
}

interface MotionTarget {
  motion: NavigationOperationMotion;
  snapshot: ObjectSnapshot;
}

interface RunningProgram {
  elapsedMs: number;
  from: Map<THREE.Object3D, ObjectSnapshot>;
  interaction: NavigationInteractionRuntime;
  optionId: string;
  program: NavigationOperationProgram;
  stepIndex: number;
}

interface CreateNavigationOperationProgramRuntimeOptions {
  featureGroupById: Map<string, THREE.Group>;
  featureMeshById: Map<string, THREE.Mesh>;
  interactions: NavigationInteractionRuntime[];
  onChange: (interaction: NavigationInteractionRuntime) => void;
  savedStates?: Map<string, SavedNavigationOperationProgramState>;
}

function easeInOut(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

function selectedProgram(interaction: NavigationInteractionRuntime) {
  for (const group of interaction.operationGroups ?? []) {
    const option = group.options.find((candidate) => (
      candidate.id === interaction.deviceSelections[group.id]
    ));
    if (option?.program) return { optionId: option.id, program: option.program };
  }
  return null;
}

export function createNavigationOperationProgramRuntime({
  featureGroupById,
  featureMeshById,
  interactions,
  onChange,
  savedStates,
}: CreateNavigationOperationProgramRuntimeOptions) {
  const originByObject = new Map<THREE.Object3D, ObjectSnapshot>();
  let running: RunningProgram | null = null;

  const snapshot = (object: THREE.Object3D) => {
    const existing = originByObject.get(object);
    if (existing) return existing;
    const next = {
      object,
      position: object.position.clone(),
      scale: object.scale.clone(),
      visible: object.visible,
    };
    originByObject.set(object, next);
    return next;
  };

  const targetsForMotion = (motion: NavigationOperationMotion): MotionTarget[] => {
    const objects = [
      ...(motion.targetFeatureIds ?? []).flatMap((id) => {
        const mesh = featureMeshById.get(id);
        return mesh ? [mesh] : [];
      }),
      ...(motion.targetGroupId ? [featureGroupById.get(motion.targetGroupId)].filter(Boolean) : []),
    ] as THREE.Object3D[];
    return objects.map((object) => ({ motion, snapshot: snapshot(object) }));
  };

  const applyTarget = (target: MotionTarget, progress: number, from: ObjectSnapshot) => {
    const { motion, snapshot: origin } = target;
    const offset = motion.positionOffset ?? [0, 0, 0];
    const multiplier = motion.scaleMultiplier ?? [1, 1, 1];
    const targetPosition = new THREE.Vector3(
      origin.position.x + offset[0],
      origin.position.y + offset[1],
      origin.position.z + offset[2],
    );
    const targetScale = new THREE.Vector3(
      origin.scale.x * multiplier[0],
      origin.scale.y * multiplier[1],
      origin.scale.z * multiplier[2],
    );
    origin.object.position.lerpVectors(from.position, targetPosition, progress);
    origin.object.scale.lerpVectors(from.scale, targetScale, progress);
    if (motion.visible !== undefined && progress >= 1) origin.object.visible = motion.visible;
    origin.object.updateWorldMatrix(true, true);
  };

  const applyStep = (
    program: NavigationOperationProgram,
    stepIndex: number,
    progress: number,
    from: Map<THREE.Object3D, ObjectSnapshot>,
  ) => {
    const step = program.steps[stepIndex];
    if (!step) return;
    for (const motion of step.motions) {
      for (const target of targetsForMotion(motion)) {
        const fromSnapshot = from.get(target.snapshot.object) ?? target.snapshot;
        applyTarget(target, progress, fromSnapshot);
      }
    }
  };

  const captureCurrentTargets = (program: NavigationOperationProgram, stepIndex: number) => {
    const next = new Map<THREE.Object3D, ObjectSnapshot>();
    for (const motion of program.steps[stepIndex]?.motions ?? []) {
      for (const { snapshot: origin } of targetsForMotion(motion)) {
        next.set(origin.object, {
          object: origin.object,
          position: origin.object.position.clone(),
          scale: origin.object.scale.clone(),
          visible: origin.object.visible,
        });
      }
    }
    return next;
  };

  const setStepStatus = (active: RunningProgram) => {
    const step = active.program.steps[active.stepIndex];
    active.interaction.deviceStatus = step
      ? `${active.stepIndex + 1}/${active.program.steps.length} · ${step.label}`
      : null;
    onChange(active.interaction);
  };

  for (const interaction of interactions) {
    const saved = savedStates?.get(interaction.id);
    interaction.deviceCollectedOptionIds = new Set(saved?.collectedOptionIds ?? []);
    interaction.deviceProgramPhase = "idle";
    interaction.deviceProgramOptionId = null;
    for (const group of interaction.operationGroups ?? []) {
      for (const option of group.options) {
        if (!option.program?.collect || !interaction.deviceCollectedOptionIds.has(option.id)) continue;
        const cargo = featureGroupById.get(option.program.collect.targetGroupId);
        if (cargo) cargo.visible = false;
      }
    }
    if (!saved?.readyOptionId) continue;
    const option = (interaction.operationGroups ?? [])
      .flatMap((group) => group.options)
      .find((candidate) => candidate.id === saved.readyOptionId && candidate.program);
    if (!option?.program) continue;
    const from = new Map<THREE.Object3D, ObjectSnapshot>();
    for (let index = 0; index < option.program.steps.length; index += 1) {
      applyStep(option.program, index, 1, from);
    }
    interaction.deviceProgramPhase = "ready";
    interaction.deviceProgramOptionId = option.id;
  }

  const execute = (interaction: NavigationInteractionRuntime) => {
    if (interaction.deviceProgramPhase === "running") return true;
    const selected = selectedProgram(interaction);
    if (!selected) return false;
    if (interaction.deviceCollectedOptionIds.has(selected.optionId)) {
      interaction.deviceStatus = "该货位已取空，请选择其他货物。";
      onChange(interaction);
      return true;
    }
    if (
      interaction.deviceProgramPhase === "ready"
      && interaction.deviceProgramOptionId === selected.optionId
      && selected.program.collect
    ) {
      const cargo = featureGroupById.get(selected.program.collect.targetGroupId);
      if (cargo) cargo.visible = false;
      interaction.deviceCollectedOptionIds.add(selected.optionId);
      interaction.deviceProgramPhase = "idle";
      interaction.deviceProgramOptionId = null;
      interaction.deviceStatus = selected.program.collect.status;
      onChange(interaction);
      return true;
    }
    interaction.deviceProgramPhase = "running";
    interaction.deviceProgramOptionId = selected.optionId;
    running = {
      elapsedMs: 0,
      from: captureCurrentTargets(selected.program, 0),
      interaction,
      optionId: selected.optionId,
      program: selected.program,
      stepIndex: 0,
    };
    setStepStatus(running);
    return true;
  };

  const update = (deltaSeconds: number) => {
    if (!running) return false;
    let changed = false;
    let remainingMs = Math.max(0, deltaSeconds * 1000);
    while (running && remainingMs >= 0) {
      const step = running.program.steps[running.stepIndex];
      if (!step) break;
      const available = Math.max(0, step.durationMs - running.elapsedMs);
      const consumed = Math.min(remainingMs, available);
      running.elapsedMs += consumed;
      remainingMs -= consumed;
      const progress = step.durationMs <= 0 ? 1 : Math.min(1, running.elapsedMs / step.durationMs);
      applyStep(running.program, running.stepIndex, easeInOut(progress), running.from);
      changed = true;
      if (progress < 1) break;
      const nextIndex = running.stepIndex + 1;
      if (nextIndex >= running.program.steps.length) {
        const completed = running;
        running = null;
        completed.interaction.deviceProgramPhase = completed.program.collect ? "ready" : "idle";
        completed.interaction.deviceProgramOptionId = completed.program.collect ? completed.optionId : null;
        const selection = (completed.interaction.operationGroups ?? []).flatMap((group) => (
          group.options.find((option) => option.id === completed.interaction.deviceSelections[group.id])?.label ?? []
        )).join(" · ");
        completed.interaction.deviceStatus = (completed.interaction.operationCompleteLabel ?? "{selection} 已送达出库位。")
          .replace("{selection}", selection);
        onChange(completed.interaction);
        break;
      }
      running.stepIndex = nextIndex;
      running.elapsedMs = 0;
      running.from = captureCurrentTargets(running.program, nextIndex);
      setStepStatus(running);
      if (remainingMs <= 0) break;
    }
    return changed;
  };

  return {
    captureStates: () => new Map(interactions
      .filter((interaction) => interaction.kind === "device")
      .map((interaction) => [interaction.id, {
        collectedOptionIds: [...interaction.deviceCollectedOptionIds],
        readyOptionId: interaction.deviceProgramPhase === "ready"
          ? interaction.deviceProgramOptionId
          : null,
      }])),
    execute,
    executeDisabled: (interaction: NavigationInteractionRuntime) => {
      const selected = selectedProgram(interaction);
      return interaction.deviceProgramPhase === "running"
        || Boolean(selected && interaction.deviceCollectedOptionIds.has(selected.optionId));
    },
    executeLabel: (interaction: NavigationInteractionRuntime) => {
      const selected = selectedProgram(interaction);
      return interaction.deviceProgramPhase === "ready"
        && interaction.deviceProgramOptionId === selected?.optionId
        && selected.program.collect
        ? selected.program.collect.label
        : interaction.operationExecuteLabel;
    },
    isBusy: (interaction: NavigationInteractionRuntime) => interaction.deviceProgramPhase === "running",
    isOptionDisabled: (interaction: NavigationInteractionRuntime, optionId: string) => (
      interaction.deviceCollectedOptionIds.has(optionId)
      || (interaction.deviceProgramPhase === "ready" && interaction.deviceProgramOptionId !== optionId)
    ),
    update,
  };
}
