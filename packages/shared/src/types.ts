export type Unit = "mm" | "cm" | "in";
export type FeatureOperation = "add" | "cut";
export type Vector3Tuple = [number, number, number];

export interface FeatureBase {
  id: string;
  name: string;
  operation: FeatureOperation;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
}

export interface BoxFeature extends FeatureBase {
  type: "box";
  parameters: {
    width: number;
    depth: number;
    height: number;
  };
}

export interface CylinderFeature extends FeatureBase {
  type: "cylinder";
  parameters: {
    radius: number;
    height: number;
  };
}

export type ModelFeature = BoxFeature | CylinderFeature;

export interface FeatureGraph {
  version: 1;
  features: ModelFeature[];
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
  name?: string;
  description?: string;
  unit?: Unit;
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
