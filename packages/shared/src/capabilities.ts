import {
  createModelSchema,
  errorSchema,
  featureGraphSchema,
  modelParamsSchema,
  modelSchema,
  updateModelSchema,
} from "./schemas.js";
import type { CapabilityDefinition } from "./types.js";

const modelResponses = {
  "200": modelSchema,
  "404": errorSchema,
};

export const capabilityRegistry = [
  {
    id: "system.health",
    status: "available",
    method: "GET",
    path: "/api/health",
    summary: "Check local service health",
    description: "Return service status, version, and the current time.",
    tags: ["system"],
    safety: "read",
    agent: {
      useWhen: "Verify that the local SolidLoom service is reachable before other calls.",
      instructions: ["Call without authentication.", "Treat a non-2xx response as an unavailable service."],
      example: "curl -s http://127.0.0.1:4310/api/health",
    },
    schema: {
      response: {
        "200": {
          type: "object",
          additionalProperties: false,
          required: ["status", "service", "version", "time"],
          properties: {
            status: { const: "ok" },
            service: { const: "solidloom" },
            version: { type: "string" },
            time: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
  {
    id: "models.list",
    status: "available",
    method: "GET",
    path: "/api/models",
    summary: "List models",
    description: "List locally stored model records in most-recently-updated order.",
    tags: ["models"],
    safety: "read",
    agent: {
      useWhen: "Discover available models or obtain an id for a later operation.",
      instructions: ["Call this before guessing a model id.", "Use the returned revision to reason about later updates."],
      example: "curl -s http://127.0.0.1:4310/api/models",
    },
    schema: {
      response: {
        "200": {
          type: "object",
          additionalProperties: false,
          required: ["items", "total"],
          properties: {
            items: { type: "array", items: modelSchema },
            total: { type: "integer", minimum: 0 },
          },
        },
      },
    },
  },
  {
    id: "models.create",
    status: "planned",
    method: "POST",
    path: "/api/models",
    summary: "Create a model",
    description: "Create a local model record with an optional initial feature graph.",
    tags: ["models"],
    safety: "write",
    agent: {
      useWhen: "Create a new modeling workspace after the user has supplied or approved a name.",
      instructions: ["Use millimetres unless the user specifies another unit.", "Keep the initial feature graph small and explicit."],
      example: "curl -s -X POST http://127.0.0.1:4310/api/models -H 'content-type: application/json' -d '{\"name\":\"Desk hook\"}'",
    },
    schema: {
      body: createModelSchema,
      response: {
        "201": modelSchema,
        "400": errorSchema,
      },
    },
  },
  {
    id: "models.get",
    status: "planned",
    method: "GET",
    path: "/api/models/:modelId",
    summary: "Inspect a model",
    description: "Return one model and its complete feature graph.",
    tags: ["models"],
    safety: "read",
    agent: {
      useWhen: "Inspect current parameters before proposing or applying edits.",
      instructions: ["Read before updating.", "Preserve ids of unchanged features."],
      example: "curl -s http://127.0.0.1:4310/api/models/MODEL_ID",
    },
    schema: { params: modelParamsSchema, response: modelResponses },
  },
  {
    id: "models.update",
    status: "planned",
    method: "PATCH",
    path: "/api/models/:modelId",
    summary: "Update model metadata",
    description: "Update model name, description, or unit without replacing its feature graph.",
    tags: ["models"],
    safety: "write",
    agent: {
      useWhen: "Rename a model or change its descriptive metadata.",
      instructions: ["Send only fields that should change.", "Use the feature endpoint for geometry changes."],
      example: "curl -s -X PATCH http://127.0.0.1:4310/api/models/MODEL_ID -H 'content-type: application/json' -d '{\"description\":\"Wall-mounted cable guide\"}'",
    },
    schema: { params: modelParamsSchema, body: updateModelSchema, response: modelResponses },
  },
  {
    id: "models.features.replace",
    status: "planned",
    method: "PUT",
    path: "/api/models/:modelId/features",
    summary: "Replace a feature graph",
    description: "Validate and replace the complete version-1 parametric feature graph.",
    tags: ["models", "geometry"],
    safety: "write",
    agent: {
      useWhen: "Apply an approved change to box or cylinder parameters and feature ordering.",
      instructions: [
        "Inspect the current model first.",
        "Send the complete graph, not a partial patch.",
        "Use positive dimensions and unique feature ids.",
        "Do not claim that cut operations have been evaluated by a B-Rep kernel in this scaffold.",
      ],
    },
    schema: { params: modelParamsSchema, body: featureGraphSchema, response: modelResponses },
  },
  {
    id: "models.delete",
    status: "planned",
    method: "DELETE",
    path: "/api/models/:modelId",
    summary: "Delete a model",
    description: "Permanently remove a model record from the local database.",
    tags: ["models"],
    safety: "destructive",
    agent: {
      useWhen: "Delete a model only after the user explicitly confirms the exact model.",
      instructions: ["List and inspect the model first.", "Obtain explicit confirmation immediately before calling this endpoint."],
    },
    schema: {
      params: modelParamsSchema,
      response: { "404": errorSchema },
    },
  },
] as const satisfies readonly CapabilityDefinition[];

export function getCapability(id: string): CapabilityDefinition {
  const capability = capabilityRegistry.find((item) => item.id === id);
  if (!capability) throw new Error(`Unknown capability: ${id}`);
  return capability;
}
