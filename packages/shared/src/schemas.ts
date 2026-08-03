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
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    description: { type: "string", maxLength: 2000 },
    unit: { type: "string", enum: ["mm", "cm", "in"] },
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
