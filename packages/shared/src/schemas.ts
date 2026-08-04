const vector3Schema = {
  type: "array",
  items: { type: "number" },
  minItems: 3,
  maxItems: 3,
} as const;

const vector2Schema = {
  type: "array",
  items: { type: "number" },
  minItems: 2,
  maxItems: 2,
} as const;

const proceduralRecessSchema = {
  type: "object",
  additionalProperties: false,
  required: ["center", "size", "depth"],
  properties: {
    center: vector2Schema,
    size: {
      type: "array",
      items: { type: "number", exclusiveMinimum: 0 },
      minItems: 2,
      maxItems: 2,
    },
    depth: { type: "number", minimum: 0 },
  },
} as const;

const proceduralMeshSourceSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "size", "recesses", "outlineRadius", "edgeFilletRadius"],
      properties: {
        kind: { const: "recessed-deck" },
        size: vector3Schema,
        recesses: { type: "array", items: proceduralRecessSchema, minItems: 1, maxItems: 16 },
        outlineRadius: { type: "number", minimum: 0 },
        edgeFilletRadius: { type: "number", minimum: 0 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "size", "recessSize", "outlineRadius", "recessRadius", "edgeFilletRadius"],
      properties: {
        kind: { const: "recessed-panel" },
        size: vector3Schema,
        recessSize: vector3Schema,
        outlineRadius: { type: "number", minimum: 0 },
        recessRadius: { type: "number", minimum: 0 },
        edgeFilletRadius: { type: "number", minimum: 0 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "size", "wallThickness", "floorThickness", "autoHideSurfaces", "door", "window"],
      properties: {
        kind: { const: "room-shell" },
        size: vector3Schema,
        wallThickness: { type: "number", exclusiveMinimum: 0 },
        floorThickness: { type: "number", exclusiveMinimum: 0 },
        autoHideSurfaces: { type: "boolean" },
        door: {
          type: "object",
          additionalProperties: false,
          required: ["width", "height", "offsetZ"],
          properties: {
            width: { type: "number", exclusiveMinimum: 0 },
            height: { type: "number", exclusiveMinimum: 0 },
            offsetZ: { type: "number" },
          },
        },
        window: {
          type: "object",
          additionalProperties: false,
          required: ["width", "height", "sillHeight", "offsetX"],
          properties: {
            fullWall: { type: "boolean" },
            width: { type: "number", exclusiveMinimum: 0 },
            height: { type: "number", exclusiveMinimum: 0 },
            sillHeight: { type: "number", minimum: 0 },
            offsetX: { type: "number" },
          },
        },
      },
    },
  ],
} as const;

const featureBaseProperties = {
  id: { type: "string", minLength: 1 },
  name: { type: "string", minLength: 1 },
  operation: { type: "string", enum: ["add", "cut"] },
  position: vector3Schema,
  rotation: vector3Schema,
  scale: vector3Schema,
  appearance: {
    type: "object",
    additionalProperties: false,
    properties: {
      material: { type: "string", enum: ["default", "wood", "metal", "plastic", "glass"] },
      color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    },
  },
  parameterExpressions: {
    type: "object",
    propertyNames: { pattern: "^[A-Za-z][A-Za-z0-9]*(?:\\.[A-Za-z0-9]+)*$" },
    additionalProperties: { type: "string", minLength: 1, maxLength: 500 },
  },
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
            cornerRadius: { type: "number", minimum: 0 },
            cornerRadii: {
              type: "object",
              additionalProperties: false,
              required: [
                "xMinYMinZMin",
                "xMaxYMinZMin",
                "xMaxYMinZMax",
                "xMinYMinZMax",
                "xMinYMaxZMin",
                "xMaxYMaxZMin",
                "xMaxYMaxZMax",
                "xMinYMaxZMax",
              ],
              properties: {
                xMinYMinZMin: { type: "number", minimum: 0 },
                xMaxYMinZMin: { type: "number", minimum: 0 },
                xMaxYMinZMax: { type: "number", minimum: 0 },
                xMinYMinZMax: { type: "number", minimum: 0 },
                xMinYMaxZMin: { type: "number", minimum: 0 },
                xMaxYMaxZMin: { type: "number", minimum: 0 },
                xMaxYMaxZMax: { type: "number", minimum: 0 },
                xMinYMaxZMax: { type: "number", minimum: 0 },
              },
            },
            cornerAlgorithm: { type: "string", enum: ["circular", "smooth"] },
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
            source: proceduralMeshSourceSchema,
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
    variables: {
      type: "array",
      maxItems: 128,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "value"],
        properties: {
          id: { type: "string", pattern: "^--[A-Za-z][A-Za-z0-9-]*$" },
          label: { type: "string", minLength: 1, maxLength: 120 },
          value: { type: "number" },
          unit: { type: "string", enum: ["mm", "cm", "in"] },
        },
      },
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
