import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../apps/server/src/app.js";

describe("SolidLoom scaffold", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes a health route", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "solidloom", version: "0.1.0" });
  });

  it("exposes progressive agent discovery without MCP", async () => {
    const llms = await app.inject({ method: "GET", url: "/llms.txt" });
    const manifest = await app.inject({ method: "GET", url: "/capabilities.json" });
    const skill = await app.inject({ method: "GET", url: "/api/models/skill.md" });

    expect(llms.statusCode).toBe(200);
    expect(llms.body).toContain("/api/models/skill.md");
    expect(llms.body.toLowerCase()).not.toContain("mcp");

    expect(manifest.statusCode).toBe(200);
    const capabilities = manifest.json().capabilities as Array<{ id: string; status: string }>;
    expect(capabilities).toContainEqual(expect.objectContaining({ id: "models.list", status: "available" }));
    expect(capabilities).toContainEqual(expect.objectContaining({ id: "models.create", status: "planned" }));

    expect(skill.statusCode).toBe(200);
    expect(skill.body).toContain("name: solidloom-api-models");
    expect(skill.body).toContain("Status: planned. Do not call this capability yet.");
  });

  it("keeps the model list callable but empty until persistence is added", async () => {
    const response = await app.inject({ method: "GET", url: "/api/models" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], total: 0 });
  });
});
