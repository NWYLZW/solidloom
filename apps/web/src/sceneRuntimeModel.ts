import type {
  FeatureGroup,
  ModelFeature,
  ModelRecord,
  ModelReferenceInteraction,
} from "@solidloom/shared";
import type { NavigationAvatarSkin } from "./navigationAvatar";
import { referenceViewportGroupId, resolveModelReferences } from "./modelReferences";
import type { NavigationInteractionDescriptor } from "./viewport/types";

export interface SceneRuntimeModel {
  avatarSkin: NavigationAvatarSkin | null;
  dynamicBodies: Array<{
    friction: number;
    groupId: string;
    linearDamping: number;
    mass: number;
  }>;
  features: ModelFeature[];
  groups: FeatureGroup[];
  interactions: NavigationInteractionDescriptor[];
}

export function resolveNavigationOperationGroups(
  groupId: string,
  groups: NonNullable<ModelReferenceInteraction["operationGroups"]>,
): NonNullable<NavigationInteractionDescriptor["operationGroups"]> {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    options: group.options.map((option) => ({
      id: option.id,
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
      ...(option.program ? {
        program: {
          ...(option.program.collect ? {
            collect: {
              label: option.program.collect.label,
              status: option.program.collect.status,
              targetGroupId: referenceViewportGroupId(option.program.collect.targetReferenceId),
            },
          } : {}),
          steps: option.program.steps.map((step) => ({
            ...step,
            motions: step.motions.map((motion) => ({
              ...(motion.positionOffset ? { positionOffset: motion.positionOffset } : {}),
              ...(motion.scaleMultiplier ? { scaleMultiplier: motion.scaleMultiplier } : {}),
              ...(motion.targetFeatureIds ? {
                targetFeatureIds: motion.targetFeatureIds.map((featureId) => `${groupId}:${featureId}`),
              } : {}),
              ...(motion.targetReferenceId ? {
                targetGroupId: referenceViewportGroupId(motion.targetReferenceId),
              } : {}),
              ...(motion.visible === undefined ? {} : { visible: motion.visible }),
            })),
          })),
        },
      } : {}),
    })),
  }));
}

export function resolveSceneRuntimeModel(scene: ModelRecord, models: ModelRecord[]): SceneRuntimeModel {
  const references = scene.featureGraph.references ?? [];
  const resolved = resolveModelReferences(scene.featureGraph, models, scene.id);
  const avatarModel = models.find((model) => model.name === "原创方块角色")
    ?? models.find((model) => model.featureGraph.features.some((feature) => feature.appearance?.voxelSkin));
  const avatarSkin = avatarModel?.featureGraph.features.find((feature) => feature.appearance?.voxelSkin)
    ?.appearance?.voxelSkin;

  return {
    avatarSkin: avatarSkin ? { model: avatarSkin.model, url: avatarSkin.url } : null,
    dynamicBodies: references.flatMap((reference) => reference.physics?.bodyType === "dynamic"
      ? [{
          friction: reference.physics.friction ?? 0.4,
          groupId: referenceViewportGroupId(reference.id),
          linearDamping: reference.physics.linearDamping ?? 2.6,
          mass: reference.physics.mass ?? 20,
        }]
      : []),
    features: [...scene.featureGraph.features, ...resolved.features],
    groups: [...(scene.featureGraph.groups ?? []), ...resolved.groups],
    interactions: references.flatMap((reference) => {
      const groupId = referenceViewportGroupId(reference.id);
      const sourceModel = models.find((model) => model.id === reference.modelId);
      return (reference.interactions ?? []).flatMap((interaction) => {
        const { operationGroups, ...interactionFields } = interaction;
        const joint = interaction.kind === "articulation"
          ? sourceModel?.featureGraph.joints?.find((candidate) => candidate.id === interaction.jointId)
          : null;
        if (interaction.kind === "articulation" && !joint) return [];
        return [{
          ...interactionFields,
          entityLabel: reference.name,
          groupId,
          id: `${reference.id}:${interaction.id}`,
          ...(joint ? {
            jointAxis: joint.axis,
            jointClosedValue: interaction.closedValue ?? joint.min,
            jointInitialValue: reference.jointValues?.[joint.id] ?? joint.value,
            jointOpenValue: interaction.openValue ?? joint.value,
            jointPivot: joint.pivot,
          } : {}),
          ...(operationGroups ? {
            operationGroups: resolveNavigationOperationGroups(groupId, operationGroups),
          } : {}),
          targetFeatureIds: interaction.targetFeatureIds?.map((featureId) => `${groupId}:${featureId}`) ?? [],
        }];
      });
    }),
  };
}
