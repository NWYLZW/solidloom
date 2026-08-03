import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifySchema } from "fastify";
import {
  createCapabilityManifest,
  getCapability,
  renderLlmsTxt,
  renderSkillMarkdown,
  type CapabilityDefinition,
} from "@solidloom/shared";

export interface BuildAppOptions {
  logger?: boolean;
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
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cors, {
    origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/],
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "SolidLoom local API",
        description: "Runnable scaffold for the local modeling service. Planned routes are listed in /capabilities.json.",
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
    handler: async () => ({ items: [], total: 0 }),
  });

  app.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({
      error: "not_found",
      message: `No available route matches ${request.method} ${request.url}. Check /capabilities.json for available and planned capabilities.`,
    });
  });

  return app;
}
