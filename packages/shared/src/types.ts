export type Unit = "mm" | "cm" | "in";
export type FeatureOperation = "add" | "cut";
export type Vector3Tuple = [number, number, number];
export type CornerAlgorithm = "circular" | "smooth";
export type FeatureMaterialPreset = "default" | "wood" | "metal" | "plastic" | "glass";
export interface FeatureAppearance {
  material?: FeatureMaterialPreset;
  color?: string;
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

export interface ModelVariable {
  id: string;
  label: string;
  value: number;
  unit?: Unit;
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

export interface FeatureGraph {
  version: 1;
  features: ModelFeature[];
  groups?: FeatureGroup[];
  variables?: ModelVariable[];
}

export interface ModelRecord {
  id: string;
  name: string;
  description: string;
  unit: Unit;
  revision: number;
  featureGraph: FeatureGraph;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelInput {
  name: string;
  description?: string;
  unit?: Unit;
  featureGraph?: FeatureGraph;
}

export interface UpdateModelInput {
  expectedRevision: number;
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
