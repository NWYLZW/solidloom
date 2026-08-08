export type Unit = "mm" | "cm" | "in";
export type DocumentKind = "asset" | "scene";
export type FeatureOperation = "add" | "cut";
export type Vector3Tuple = [number, number, number];
export type CornerAlgorithm = "circular" | "smooth";
export type FeatureMaterialPreset = "default" | "wood" | "metal" | "plastic" | "glass" | "fabric" | "rubber";
export type VoxelSkinModel = "classic" | "slim";
export type VoxelSkinPart = "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";
export type VoxelSkinSegment = "full" | "upper" | "lower" | "foot";
export interface VoxelSkinAppearance {
  model: VoxelSkinModel;
  part: VoxelSkinPart;
  segment?: VoxelSkinSegment;
  url: string;
}
export interface FeatureAppearance {
  material?: FeatureMaterialPreset;
  color?: string;
  voxelSkin?: VoxelSkinAppearance;
}
export type BoxCornerKey =
  | "xMinYMinZMin"
  | "xMaxYMinZMin"
  | "xMaxYMinZMax"
  | "xMinYMinZMax"
  | "xMinYMaxZMin"
  | "xMaxYMaxZMin"
  | "xMaxYMaxZMax"
  | "xMinYMaxZMax";
export type BoxCornerRadii = Record<BoxCornerKey, number>;

export interface FeatureBase {
  id: string;
  name: string;
  operation: FeatureOperation;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale?: Vector3Tuple;
  appearance?: FeatureAppearance;
  parameterExpressions?: Record<string, string>;
}

interface ModelVariableBase {
  id: string;
  label: string;
}

export interface NumericModelVariable extends ModelVariableBase {
  type?: "number";
  value: number;
  unit?: Unit;
}

export interface ColorModelVariable extends ModelVariableBase {
  type: "color";
  value: string;
}

export type ModelVariable = NumericModelVariable | ColorModelVariable;

export interface FeatureGraphGenerator {
  id: string;
  version: 1;
  options?: Record<string, unknown>;
}

export interface BoxFeature extends FeatureBase {
  type: "box";
  parameters: {
    width: number;
    depth: number;
    height: number;
    cornerRadius?: number;
    cornerRadii?: BoxCornerRadii;
    cornerAlgorithm?: CornerAlgorithm;
  };
}

export interface CylinderFeature extends FeatureBase {
  type: "cylinder";
  parameters: {
    radius: number;
    height: number;
  };
}

export interface ProceduralRecess {
  center: [number, number];
  size: [number, number];
  depth: number;
}

export interface RecessedDeckSource {
  kind: "recessed-deck";
  size: Vector3Tuple;
  recesses: ProceduralRecess[];
  outlineRadius: number;
  edgeFilletRadius: number;
}

export interface RecessedPanelSource {
  kind: "recessed-panel";
  size: Vector3Tuple;
  recessSize: Vector3Tuple;
  outlineRadius: number;
  recessRadius: number;
  edgeFilletRadius: number;
}

export interface RoomShellSource {
  kind: "room-shell";
  size: Vector3Tuple;
  wallThickness: number;
  floorThickness: number;
  autoHideSurfaces: boolean;
  door: {
    width: number;
    height: number;
    offsetZ: number;
  };
  window: {
    fullWall?: boolean;
    width: number;
    height: number;
    sillHeight: number;
    offsetX: number;
  };
}

export type ProceduralMeshSource = RecessedDeckSource | RecessedPanelSource | RoomShellSource;

export interface MeshFeature extends FeatureBase {
  type: "mesh";
  parameters: {
    positions: number[];
    normals: number[];
    indices: number[];
    source?: ProceduralMeshSource;
  };
}

export type ModelFeature = BoxFeature | CylinderFeature | MeshFeature;

export interface FeatureGroup {
  id: string;
  name: string;
  featureIds: string[];
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale?: Vector3Tuple;
}

export interface RevoluteJoint {
  id: string;
  name: string;
  type: "revolute";
  groupId: string;
  parentJointId?: string;
  pivot: Vector3Tuple;
  axis: Vector3Tuple;
  value: number;
  restValue: number;
  min: number;
  max: number;
}

export type ArticulationJoint = RevoluteJoint;

export interface ArticulationPosePreset {
  id: string;
  name: string;
  durationMs?: number;
  jointValues: Record<string, number>;
}

export interface ArticulationAnimationKeyframe {
  offset: number;
  jointValues: Record<string, number>;
}

export interface ArticulationAnimationClip {
  id: string;
  name: string;
  durationMs: number;
  loop: boolean;
  keyframes: ArticulationAnimationKeyframe[];
}

export interface ArticulationLocomotionProfile {
  id: string;
  name: string;
  walkAnimationId: string;
  runAnimationId: string;
  defaultSpeed: number;
  minimumSpeed: number;
  maximumSpeed: number;
  walkReferenceSpeed: number;
  runReferenceSpeed: number;
  transitionStartSpeed: number;
  transitionEndSpeed: number;
  transitionDurationMs: number;
}

export interface NavigationSurface {
  enabled: boolean;
  floorY: number;
  bounds: [number, number, number, number];
  cellSize: number;
  agentRadius: number;
  agentHeight: number;
  start: [number, number];
}

export type RuntimeMenuItem = "resume" | "character" | "settings" | "return-workshop";

export interface RuntimeUIConfiguration {
  menuItems?: RuntimeMenuItem[];
}

export interface ModelReferencePhysics {
  bodyType: "static" | "dynamic";
  mass?: number;
  friction?: number;
  linearDamping?: number;
}

export interface ModelReferenceInteraction {
  id: string;
  kind: "power" | "seat" | "door" | "articulation" | "container" | "device";
  label?: string;
  activateLabel?: string;
  deactivateLabel?: string;
  anchorPosition?: Vector3Tuple;
  range?: number;
  targetFeatureIds?: string[];
  openAngle?: number;
  jointId?: string;
  closedValue?: number;
  openValue?: number;
  containerCapacity?: number;
  containerCanConfigure?: boolean;
  containerCurrency?: string;
  containerProducts?: Array<{
    id: string;
    name: string;
    unitPrice: number;
  }>;
  containerItems?: Array<{
    id: string;
    name: string;
    productId?: string;
  }>;
  operationGroups?: Array<{
    id: string;
    label: string;
    options: Array<{
      description?: string;
      id: string;
      label: string;
      program?: ModelReferenceOperationProgram;
    }>;
  }>;
  operationExecuteLabel?: string;
  operationCompleteLabel?: string;
}

export interface ModelReferenceOperationMotion {
  positionOffset?: Vector3Tuple;
  scaleMultiplier?: Vector3Tuple;
  targetFeatureIds?: string[];
  targetReferenceId?: string;
  visible?: boolean;
}

export interface ModelReferenceOperationStep {
  durationMs: number;
  id: string;
  label: string;
  motions: ModelReferenceOperationMotion[];
}

export interface ModelReferenceOperationProgram {
  collect?: {
    label: string;
    status: string;
    targetReferenceId: string;
  };
  steps: ModelReferenceOperationStep[];
}

export interface ModelReferenceInstance {
  id: string;
  name: string;
  modelId: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale?: Vector3Tuple;
  jointValues?: Record<string, number>;
  roomSurfaceMode?: "source" | "interior" | "exterior";
  physics?: ModelReferencePhysics;
  interactions?: ModelReferenceInteraction[];
}

export interface FeatureGraph {
  version: 1;
  features: ModelFeature[];
  generator?: FeatureGraphGenerator;
  groups?: FeatureGroup[];
  joints?: ArticulationJoint[];
  poses?: ArticulationPosePreset[];
  animations?: ArticulationAnimationClip[];
  locomotion?: ArticulationLocomotionProfile;
  navigation?: NavigationSurface;
  references?: ModelReferenceInstance[];
  runtimeUI?: RuntimeUIConfiguration;
  variables?: ModelVariable[];
}

export interface ModelRecord {
  id: string;
  kind: DocumentKind;
  name: string;
  description: string;
  unit: Unit;
  revision: number;
  featureGraph: FeatureGraph;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelInput {
  kind?: DocumentKind;
  name: string;
  description?: string;
  unit?: Unit;
  featureGraph?: FeatureGraph;
}

export interface UpdateModelInput {
  expectedRevision: number;
  kind?: DocumentKind;
  name?: string;
  description?: string;
  unit?: Unit;
}

export interface ReplaceFeatureGraphInput {
  expectedRevision: number;
  featureGraph: FeatureGraph;
}

export interface ModelList {
  items: ModelRecord[];
  total: number;
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type JsonSchema = Record<string, unknown>;

export interface CapabilityDefinition {
  id: string;
  status: "available" | "planned";
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  safety: "read" | "write" | "destructive";
  agent: {
    useWhen: string;
    instructions: string[];
    example?: string;
  };
  schema: {
    params?: JsonSchema;
    querystring?: JsonSchema;
    body?: JsonSchema;
    response?: Record<string, JsonSchema>;
  };
}

export interface CapabilityManifest {
  service: {
    name: string;
    version: string;
    description: string;
    transport: "http";
  };
  discovery: {
    llms: string;
    capabilities: string;
    skillPattern: string;
  };
  capabilities: CapabilityDefinition[];
}
