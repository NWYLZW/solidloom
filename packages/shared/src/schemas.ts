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
      material: { type: "string", enum: ["default", "wood", "metal", "plastic", "glass", "fabric", "rubber"] },
      color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
      voxelSkin: {
        type: "object",
        additionalProperties: false,
        required: ["model", "part", "url"],
        properties: {
          model: { type: "string", enum: ["classic", "slim"] },
          part: { type: "string", enum: ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"] },
            segment: { type: "string", enum: ["full", "upper", "lower", "foot"] },
          url: { type: "string", minLength: 1, maxLength: 400000 },
        },
      },
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

export const articulationJointSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "type", "groupId", "pivot", "axis", "value", "restValue", "min", "max"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    type: { const: "revolute" },
    groupId: { type: "string", minLength: 1 },
    parentJointId: { type: "string", minLength: 1 },
    pivot: vector3Schema,
    axis: vector3Schema,
    value: { type: "number" },
    restValue: { type: "number" },
    min: { type: "number" },
    max: { type: "number" },
  },
} as const;

export const articulationPosePresetSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "jointValues"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 120 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    durationMs: { type: "number", minimum: 100, maximum: 10_000 },
    jointValues: {
      type: "object",
      propertyNames: { minLength: 1 },
      additionalProperties: { type: "number" },
      minProperties: 1,
      maxProperties: 128,
    },
  },
} as const;

export const articulationAnimationClipSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "durationMs", "loop", "keyframes"],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 120 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    durationMs: { type: "number", minimum: 100, maximum: 60_000 },
    loop: { type: "boolean" },
    keyframes: {
      type: "array",
      minItems: 2,
      maxItems: 128,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["offset", "jointValues"],
        properties: {
          offset: { type: "number", minimum: 0, maximum: 1 },
          jointValues: {
            type: "object",
            propertyNames: { minLength: 1 },
            additionalProperties: { type: "number" },
            minProperties: 1,
            maxProperties: 128,
          },
        },
      },
    },
  },
} as const;

export const articulationLocomotionProfileSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "walkAnimationId",
    "runAnimationId",
    "defaultSpeed",
    "minimumSpeed",
    "maximumSpeed",
    "walkReferenceSpeed",
    "runReferenceSpeed",
    "transitionStartSpeed",
    "transitionEndSpeed",
    "transitionDurationMs",
  ],
  properties: {
    id: { type: "string", minLength: 1, maxLength: 120 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    walkAnimationId: { type: "string", minLength: 1, maxLength: 120 },
    runAnimationId: { type: "string", minLength: 1, maxLength: 120 },
    defaultSpeed: { type: "number", minimum: 0 },
    minimumSpeed: { type: "number", minimum: 0 },
    maximumSpeed: { type: "number", exclusiveMinimum: 0 },
    walkReferenceSpeed: { type: "number", exclusiveMinimum: 0 },
    runReferenceSpeed: { type: "number", exclusiveMinimum: 0 },
    transitionStartSpeed: { type: "number", minimum: 0 },
    transitionEndSpeed: { type: "number", exclusiveMinimum: 0 },
    transitionDurationMs: { type: "number", minimum: 100, maximum: 3_000 },
  },
} as const;

export const navigationSurfaceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["enabled", "floorY", "bounds", "cellSize", "agentRadius", "agentHeight", "start"],
  properties: {
    enabled: { type: "boolean" },
    floorY: { type: "number" },
    bounds: {
      type: "array",
      items: { type: "number" },
      minItems: 4,
      maxItems: 4,
    },
    cellSize: { type: "number", exclusiveMinimum: 0 },
    agentRadius: { type: "number", minimum: 0 },
    agentHeight: { type: "number", exclusiveMinimum: 0 },
    start: vector2Schema,
  },
} as const;

export const modelReferenceInstanceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "modelId", "position", "rotation"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    modelId: { type: "string", minLength: 1 },
    position: vector3Schema,
    rotation: vector3Schema,
    scale: vector3Schema,
    jointValues: {
      type: "object",
      propertyNames: { minLength: 1 },
      additionalProperties: { type: "number" },
      maxProperties: 128,
    },
    roomSurfaceMode: { type: "string", enum: ["source", "interior", "exterior"] },
    physics: {
      type: "object",
      additionalProperties: false,
      required: ["bodyType"],
      properties: {
        bodyType: { type: "string", enum: ["static", "dynamic"] },
        mass: { type: "number", exclusiveMinimum: 0 },
        friction: { type: "number", minimum: 0, maximum: 1 },
        linearDamping: { type: "number", minimum: 0 },
      },
    },
    interactions: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kind"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 120 },
          kind: { type: "string", enum: ["power", "seat", "door", "articulation", "container", "device"] },
          label: { type: "string", minLength: 1, maxLength: 120 },
          activateLabel: { type: "string", minLength: 1, maxLength: 120 },
          deactivateLabel: { type: "string", minLength: 1, maxLength: 120 },
          anchorPosition: vector3Schema,
          range: { type: "number", exclusiveMinimum: 0 },
          targetFeatureIds: {
            type: "array",
            items: { type: "string", minLength: 1 },
            uniqueItems: true,
            maxItems: 16,
          },
          openAngle: { type: "number", minimum: -180, maximum: 180 },
          jointId: { type: "string", minLength: 1, maxLength: 120 },
          closedValue: { type: "number", minimum: -360, maximum: 360 },
          openValue: { type: "number", minimum: -360, maximum: 360 },
          containerCapacity: { type: "integer", minimum: 1, maximum: 128 },
          containerCanConfigure: { type: "boolean" },
          containerCurrency: { type: "string", minLength: 3, maxLength: 12 },
          containerProducts: {
            type: "array",
            maxItems: 32,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "name", "unitPrice"],
              properties: {
                id: { type: "string", minLength: 1, maxLength: 120 },
                name: { type: "string", minLength: 1, maxLength: 120 },
                unitPrice: { type: "number", minimum: 0, maximum: 1000000000 },
              },
            },
          },
          containerItems: {
            type: "array",
            maxItems: 128,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "name"],
              properties: {
                id: { type: "string", minLength: 1, maxLength: 120 },
                name: { type: "string", minLength: 1, maxLength: 120 },
                productId: { type: "string", minLength: 1, maxLength: 120 },
              },
            },
          },
          operationGroups: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "label", "options"],
              properties: {
                id: { type: "string", minLength: 1, maxLength: 120 },
                label: { type: "string", minLength: 1, maxLength: 120 },
                options: {
                  type: "array",
                  minItems: 1,
                  maxItems: 16,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "label"],
                    properties: {
                      id: { type: "string", minLength: 1, maxLength: 120 },
                      label: { type: "string", minLength: 1, maxLength: 120 },
                      description: { type: "string", minLength: 1, maxLength: 240 },
                    },
                  },
                },
              },
            },
          },
          operationExecuteLabel: { type: "string", minLength: 1, maxLength: 120 },
          operationCompleteLabel: { type: "string", minLength: 1, maxLength: 240 },
        },
      },
    },
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
    generator: {
      type: "object",
      additionalProperties: false,
      required: ["id", "version"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 160 },
        version: { const: 1 },
        options: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    groups: {
      type: "array",
      items: featureGroupSchema,
      maxItems: 64,
    },
    joints: {
      type: "array",
      items: articulationJointSchema,
      maxItems: 128,
    },
    poses: {
      type: "array",
      items: articulationPosePresetSchema,
      maxItems: 64,
    },
    animations: {
      type: "array",
      items: articulationAnimationClipSchema,
      maxItems: 64,
    },
    locomotion: articulationLocomotionProfileSchema,
    navigation: navigationSurfaceSchema,
    references: {
      type: "array",
      items: modelReferenceInstanceSchema,
      maxItems: 64,
    },
    variables: {
      type: "array",
      maxItems: 128,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "value"],
            properties: {
              id: { type: "string", pattern: "^--[A-Za-z][A-Za-z0-9-]*$" },
              label: { type: "string", minLength: 1, maxLength: 120 },
              type: { const: "number" },
              value: { type: "number" },
              unit: { type: "string", enum: ["mm", "cm", "in"] },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "type", "value"],
            properties: {
              id: { type: "string", pattern: "^--[A-Za-z][A-Za-z0-9-]*$" },
              label: { type: "string", minLength: 1, maxLength: 120 },
              type: { const: "color" },
              value: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
            },
          },
        ],
      },
    },
  },
} as const;

export const modelSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "kind",
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
    kind: { type: "string", enum: ["asset", "scene"] },
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
    kind: { type: "string", enum: ["asset", "scene"] },
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
    kind: { type: "string", enum: ["asset", "scene"] },
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
