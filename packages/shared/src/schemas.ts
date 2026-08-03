const vector3Schema = {
  type: "array",
  items: { type: "number" },
  minItems: 3,
  maxItems: 3,
} as const;

const featureBaseProperties = {
  id: { type: "string", minLength: 1 },
  name: { type: "string", minLength: 1 },
  operation: { type: "string", enum: ["add", "cut"] },
  position: vector3Schema,
  rotation: vector3Schema,
  scale: vector3Schema,
};

export const modelFeatureSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "type", "operation", "position", "rotation", "parameters"],
      properties: {
        ...featureBaseProperties,
        type: { const: "box" },
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["width", "depth", "height"],
          properties: {
            width: { type: "number", exclusiveMinimum: 0 },
            depth: { type: "number", exclusiveMinimum: 0 },
            height: { type: "number", exclusiveMinimum: 0 },
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "type", "operation", "position", "rotation", "parameters"],
      properties: {
        ...featureBaseProperties,
        type: { const: "mesh" },
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["positions", "normals", "indices"],
          properties: {
            positions: { type: "array", items: { type: "number" }, minItems: 9, maxItems: 300000 },
            normals: { type: "array", items: { type: "number" }, minItems: 9, maxItems: 300000 },
            indices: { type: "array", items: { type: "integer", minimum: 0 }, minItems: 3, maxItems: 300000 },
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "name", "type", "operation", "position", "rotation", "parameters"],
      properties: {
        ...featureBaseProperties,
        type: { const: "cylinder" },
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["radius", "height"],
          properties: {
            radius: { type: "number", exclusiveMinimum: 0 },
            height: { type: "number", exclusiveMinimum: 0 },
          },
        },
      },
    },
  ],
} as const;

export const featureGroupSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "featureIds", "position", "rotation"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    featureIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
      maxItems: 256,
      uniqueItems: true,
    },
    position: vector3Schema,
    rotation: vector3Schema,
    scale: vector3Schema,
  },
} as const;

export const featureGraphSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "features"],
  properties: {
    version: { const: 1 },
    features: {
      type: "array",
      items: modelFeatureSchema,
      maxItems: 256,
    },
    groups: {
      type: "array",
      items: featureGroupSchema,
      maxItems: 64,
    },
  },
} as const;

export const modelSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "description",
    "unit",
    "revision",
    "featureGraph",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    unit: { type: "string", enum: ["mm", "cm", "in"] },
    revision: { type: "integer", minimum: 1 },
    featureGraph: featureGraphSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

export const modelParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["modelId"],
  properties: {
    modelId: { type: "string", minLength: 1 },
  },
} as const;

export const createModelSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: "string", maxLength: 2000 },
    unit: { type: "string", enum: ["mm", "cm", "in"] },
    featureGraph: featureGraphSchema,
  },
} as const;

export const updateModelSchema = {
  type: "object",
  additionalProperties: false,
  required: ["expectedRevision"],
  minProperties: 2,
  properties: {
    expectedRevision: { type: "integer", minimum: 1 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: "string", maxLength: 2000 },
    unit: { type: "string", enum: ["mm", "cm", "in"] },
  },
} as const;

export const replaceFeatureGraphSchema = {
  type: "object",
  additionalProperties: false,
  required: ["expectedRevision", "featureGraph"],
  properties: {
    expectedRevision: { type: "integer", minimum: 1 },
    featureGraph: featureGraphSchema,
  },
} as const;

export const deleteModelQuerySchema = {
  type: "object",
  additionalProperties: false,
  required: ["expectedRevision"],
  properties: {
    expectedRevision: { type: "integer", minimum: 1 },
  },
} as const;

export const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
  },
} as const;
