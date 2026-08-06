import type {
  ArticulationJoint,
  FeatureGroup,
  ModelFeature,
  NavigationSurface,
  Vector3Tuple,
} from "@solidloom/shared";
import type { JointAnimationRequest } from "../articulation/types";
import type {
  InteractionUIConfig,
  NavigationContainerItem,
  NavigationInteractionLabels,
} from "../interaction-ui/types";
import type { NavigationAvatarSkin } from "../navigationAvatar";

export type {
  NavigationContainerItem,
  NavigationContainerOperation,
  NavigationContainerPanelState,
  NavigationDeviceOperation,
  NavigationDevicePanelState,
  NavigationInteractionLabels,
} from "../interaction-ui/types";

export type TransformMode = "translate" | "rotate" | "scale" | null;
export type NavigationCameraMode = "god" | "first-person" | "third-person";

export interface TransformCommit {
  id: string;
  kind: "feature" | "group";
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
}

export interface NavigationInteractionDescriptor {
  activateLabel?: string;
  anchorPosition?: Vector3Tuple;
  containerCapacity?: number;
  containerCanConfigure?: boolean;
  containerCurrency?: string;
  containerItems?: NavigationContainerItem[];
  containerProducts?: Array<{
    id: string;
    name: string;
    unitPrice: number;
  }>;
  deactivateLabel?: string;
  entityLabel: string;
  groupId: string;
  id: string;
  kind: "power" | "seat" | "door" | "articulation" | "container" | "device";
  label?: string;
  jointAxis?: Vector3Tuple;
  jointClosedValue?: number;
  jointInitialValue?: number;
  jointOpenValue?: number;
  jointPivot?: Vector3Tuple;
  openAngle?: number;
  operationCompleteLabel?: string;
  operationExecuteLabel?: string;
  operationGroups?: Array<{
    id: string;
    label: string;
    options: Array<{
      description?: string;
      id: string;
      label: string;
    }>;
  }>;
  range?: number;
  targetFeatureIds: string[];
}

export interface Viewport3DProps {
  annotationMode: boolean;
  annotationStrings: {
    add: string;
    assistActive: string;
    box: string;
    cut: string;
    cylinder: string;
    feature: string;
    group: string;
    members: string;
    mesh: string;
    path: string;
    proceduralShell: string;
    roomShell: string;
  };
  features: ModelFeature[];
  groups: FeatureGroup[];
  joints: ArticulationJoint[];
  jointAnimation: JointAnimationRequest | null;
  interactionUI?: InteractionUIConfig;
  label: string;
  modelId: string;
  modelName: string;
  rendererFailureLabel: string;
  rendererReloadLabel: string;
  onSelectFeature: (featureId: string | null, additive: boolean) => void;
  onSelectGroup: (groupId: string) => void;
  onOpenContextMenu: (featureId: string | null, point: { x: number; y: number }) => void;
  onTransformCommit: (transforms: TransformCommit[]) => void;
  navigation: NavigationSurface | null;
  navigationAvatarSkin: NavigationAvatarSkin | null;
  navigationCameraLabels: Record<NavigationCameraMode, string>;
  navigationCameraMode: NavigationCameraMode;
  navigationCameraControlsVisible: boolean;
  navigationCanConfigureInteractions: boolean;
  navigationMode: boolean;
  navigationModeLabel: string;
  onNavigationCameraModeChange: (mode: NavigationCameraMode) => void;
  onJointAnimationComplete: (animationId: number) => void;
  navigationDynamicBodies: Array<{
    friction: number;
    groupId: string;
    linearDamping: number;
    mass: number;
  }>;
  navigationInteractions: NavigationInteractionDescriptor[];
  navigationInteractionLabels: NavigationInteractionLabels;
  selectedFeatureIds: string[];
  selectedGroupId: string | null;
  theme: "light" | "dark" | "system";
  transformMode: TransformMode;
  cutPlane: { offset: number; rotation: Vector3Tuple } | null;
  viewCubeLabel: string;
  viewLabels: [string, string, string, string, string, string];
}

export interface NavigationPrompt {
  id: string;
  label: string;
}
