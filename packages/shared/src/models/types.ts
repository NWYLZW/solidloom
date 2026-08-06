import type {
  CreateModelInput,
  FeatureMaterialPreset,
  Unit,
  Vector3Tuple,
} from "../types.js";

export type ModelAssetKind = "asset" | "character" | "scene";
export type ModelAssetDeviceClass = "desktop" | "mobile";
export type ModelAssetAnchorKind =
  | "approach"
  | "interaction"
  | "placement"
  | "seat"
  | "socket";
export type ModelAssetColliderShape = "box" | "capsule" | "cylinder";

export interface ModelAssetParameterDefinition {
  id: string;
  label: string;
  type: "boolean" | "number" | "select";
  defaultValue: boolean | number | string;
  unit?: Unit | "degree" | "percent";
  minimum?: number;
  maximum?: number;
  step?: number;
  options?: string[];
}

export interface ModelAssetMaterialSlot {
  id: string;
  label: string;
  material: FeatureMaterialPreset;
  color?: string;
  featureIds: string[];
}

export interface ModelAssetTarget {
  featureId?: string;
  groupId?: string;
  jointId?: string;
}

export interface ModelAssetAnchor extends ModelAssetTarget {
  id: string;
  label: string;
  kind: ModelAssetAnchorKind;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  range?: number;
  tags?: string[];
}

export interface ModelAssetCollider extends ModelAssetTarget {
  id: string;
  label: string;
  shape: ModelAssetColliderShape;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  size: Vector3Tuple;
  radius?: number;
  height?: number;
  dynamic?: boolean;
}

export interface ModelAssetJointBinding {
  id: string;
  label: string;
  jointId: string;
  semantic: string;
}

export interface ModelAssetLodLevel {
  id: string;
  maximumDistance: number;
  featureIds?: string[];
  triangleBudget?: number;
}

export interface ModelAssetLodProfile {
  device: ModelAssetDeviceClass;
  levels: ModelAssetLodLevel[];
}

export interface ModelAssetPreview {
  device: ModelAssetDeviceClass;
  cameraPosition: Vector3Tuple;
  cameraTarget: Vector3Tuple;
  background: "dark" | "light" | "transparent";
}

export interface ModelAssetPlacement {
  upAxis: "y";
  groundY: number;
  origin: Vector3Tuple;
  defaultScale: Vector3Tuple;
}

export interface ModelAssetManifest {
  schemaVersion: 1;
  id: string;
  displayName: string;
  description: string;
  version: string;
  kind: ModelAssetKind;
  modelUnit: Unit;
  parameters: ModelAssetParameterDefinition[];
  materials: ModelAssetMaterialSlot[];
  placement: ModelAssetPlacement;
  colliders: ModelAssetCollider[];
  anchors: ModelAssetAnchor[];
  joints: ModelAssetJointBinding[];
  lod: ModelAssetLodProfile[];
  previews: ModelAssetPreview[];
  tags?: string[];
}

export interface ModelAssetDefinition {
  manifest: ModelAssetManifest;
  createModel: () => CreateModelInput;
}

export type ModelAssetValidationCode =
  | "duplicate-id"
  | "duplicate-profile"
  | "invalid-anchor"
  | "invalid-collider"
  | "invalid-color"
  | "invalid-id"
  | "invalid-lod"
  | "invalid-parameter"
  | "invalid-placement"
  | "invalid-preview"
  | "invalid-version"
  | "missing-feature"
  | "missing-group"
  | "missing-joint"
  | "model-mismatch";

export interface ModelAssetValidationIssue {
  code: ModelAssetValidationCode;
  path: string;
  message: string;
}

export interface ModelAssetValidationResult {
  valid: boolean;
  issues: ModelAssetValidationIssue[];
}
