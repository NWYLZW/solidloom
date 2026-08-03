import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifySchema } from "fastify";
import { inspectFeatureGraph } from "@solidloom/cad-engine";
import {
  createCapabilityManifest,
  getCapability,
  renderLlmsTxt,
  renderSkillMarkdown,
  type CapabilityDefinition,
  type CreateModelInput,
  type ReplaceFeatureGraphInput,
  type UpdateModelInput,
} from "@solidloom/shared";
import { ModelRepository, RevisionConflictError } from "./model-repository.js";

export interface BuildAppOptions {
  logger?: boolean;
  databasePath?: string;
}

function requestBaseUrl(request: FastifyRequest): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0]?.trim() : request.protocol;
  return `${protocol ?? "http"}://${request.host}`;
}

function routeSchema(capability: CapabilityDefinition): FastifySchema {
  const schema: FastifySchema = {
    summary: capability.summary,
    description: capability.description,
    tags: capability.tags,
  };
  if (capability.schema.params) schema.params = capability.schema.params;
  if (capability.schema.querystring) schema.querystring = capability.schema.querystring;
  if (capability.schema.body) schema.body = capability.schema.body;
  if (capability.schema.response) schema.response = capability.schema.response;
  return schema;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ bodyLimit: 8 * 1024 * 1024, logger: options.logger ?? false });
  const models = new ModelRepository(options.databasePath);

  app.addHook("onClose", async () => models.close());

  await app.register(cors, {
    origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/],
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "SolidLoom local API",
        description: "Local model records and versioned feature graphs. Planned routes remain listed in /capabilities.json.",
        version: "0.1.0",
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.addHook("onRequest", async (request, reply) => {
    if (request.method !== "GET") return;
    const pathname = new URL(request.url, "http://solidloom.local").pathname;
    if (pathname !== "/skill.md" && !pathname.endsWith("/skill.md")) return;

    const scopedPath = pathname === "/skill.md" ? "/" : pathname.slice(0, -"/skill.md".length) || "/";
    const markdown = renderSkillMarkdown(scopedPath, requestBaseUrl(request));
    if (!markdown) {
      return reply.code(404).type("application/json").send({
        error: "skill_not_found",
        message: `No capabilities are disclosed for ${scopedPath}.`,
      });
    }
    return reply.type("text/markdown; charset=utf-8").header("cache-control", "no-store").send(markdown);
  });

  app.get("/llms.txt", async (request, reply) => {
    return reply
      .type("text/plain; charset=utf-8")
      .header("cache-control", "no-store")
      .send(renderLlmsTxt(requestBaseUrl(request)));
  });

  app.get("/capabilities.json", async (request, reply) => {
    return reply
      .type("application/json")
      .header("cache-control", "no-store")
      .send(createCapabilityManifest(requestBaseUrl(request)));
  });

  const health = getCapability("system.health");
  app.route({
    method: health.method,
    url: health.path,
    schema: routeSchema(health),
    handler: async () => ({
      status: "ok",
      service: "solidloom",
      version: "0.1.0",
      time: new Date().toISOString(),
    }),
  });

  const listModels = getCapability("models.list");
  app.route({
    method: listModels.method,
    url: listModels.path,
    schema: routeSchema(listModels),
    handler: async () => models.list(),
  });

  const createModel = getCapability("models.create");
  app.route({
    method: createModel.method,
    url: createModel.path,
    schema: routeSchema(createModel),
    handler: async (request, reply) => {
      const input = request.body as CreateModelInput;
      if (!input.name.trim()) {
        return reply.code(400).send({ error: "invalid_name", message: "Model name cannot be blank." });
      }
      const graph = input.featureGraph;
      if (graph) {
        const inspection = inspectFeatureGraph(graph);
        const errors = inspection.issues.filter((issue) => issue.level === "error");
        if (errors.length > 0) {
          return reply.code(422).send({ error: "invalid_feature_graph", message: errors.map((issue) => issue.message).join(" ") });
        }
      }
      return reply.code(201).send(models.create(input));
    },
  });

  const getModel = getCapability("models.get");
  app.route({
    method: getModel.method,
    url: getModel.path,
    schema: routeSchema(getModel),
    handler: async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      const model = models.get(modelId);
      return model ?? reply.code(404).send({ error: "model_not_found", message: `Model ${modelId} was not found.` });
    },
  });

  const updateModel = getCapability("models.update");
  app.route({
    method: updateModel.method,
    url: updateModel.path,
    schema: routeSchema(updateModel),
    handler: async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      const input = request.body as UpdateModelInput;
      if (input.name !== undefined && !input.name.trim()) {
        return reply.code(400).send({ error: "invalid_name", message: "Model name cannot be blank." });
      }
      try {
        const model = models.update(modelId, input);
        return model ?? reply.code(404).send({ error: "model_not_found", message: `Model ${modelId} was not found.` });
      } catch (error) {
        if (error instanceof RevisionConflictError) {
          return reply.code(409).send({ error: "revision_conflict", message: error.message });
        }
        throw error;
      }
    },
  });

  const replaceFeatures = getCapability("models.features.replace");
  app.route({
    method: replaceFeatures.method,
    url: replaceFeatures.path,
    schema: routeSchema(replaceFeatures),
    handler: async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      const input = request.body as ReplaceFeatureGraphInput;
      const inspection = inspectFeatureGraph(input.featureGraph);
      const errors = inspection.issues.filter((issue) => issue.level === "error");
      if (errors.length > 0) {
        return reply.code(422).send({ error: "invalid_feature_graph", message: errors.map((issue) => issue.message).join(" ") });
      }
      try {
        const model = models.replaceFeatureGraph(modelId, input);
        return model ?? reply.code(404).send({ error: "model_not_found", message: `Model ${modelId} was not found.` });
      } catch (error) {
        if (error instanceof RevisionConflictError) {
          return reply.code(409).send({ error: "revision_conflict", message: error.message });
        }
        throw error;
      }
    },
  });

  const deleteModel = getCapability("models.delete");
  app.route({
    method: deleteModel.method,
    url: deleteModel.path,
    schema: routeSchema(deleteModel),
    handler: async (request, reply) => {
      const { modelId } = request.params as { modelId: string };
      const { expectedRevision } = request.query as { expectedRevision: number };
      try {
        if (!models.delete(modelId, expectedRevision)) {
          return reply.code(404).send({ error: "model_not_found", message: `Model ${modelId} was not found.` });
        }
        return reply.code(204).send();
      } catch (error) {
        if (error instanceof RevisionConflictError) {
          return reply.code(409).send({ error: "revision_conflict", message: error.message });
        }
        throw error;
      }
    },
  });

  app.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({
      error: "not_found",
      message: `No available route matches ${request.method} ${request.url}. Check /capabilities.json for available and planned capabilities.`,
    });
  });

  return app;
}
