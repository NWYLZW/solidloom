import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../apps/server/src/app.js";

describe("SolidLoom model service", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes health and progressive discovery without MCP", async () => {
    const health = await app.inject({ method: "GET", url: "/api/health" });
    const llms = await app.inject({ method: "GET", url: "/llms.txt" });
    const manifest = await app.inject({ method: "GET", url: "/capabilities.json" });
    const skill = await app.inject({ method: "GET", url: "/api/models/skill.md" });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ status: "ok", service: "solidloom", version: "0.1.0" });
    expect(llms.statusCode).toBe(200);
    expect(llms.body).toContain("/api/models/skill.md");
    expect(llms.body).toContain("expectedRevision");
    expect(llms.body.toLowerCase()).not.toContain("mcp");

    const capabilities = manifest.json().capabilities as Array<{ id: string; status: string }>;
    expect(capabilities).toContainEqual(expect.objectContaining({ id: "models.list", status: "available" }));
    expect(capabilities).toContainEqual(expect.objectContaining({ id: "models.create", status: "available" }));
    expect(capabilities).toContainEqual(expect.objectContaining({ id: "models.features.replace", status: "available" }));
    expect(skill.statusCode).toBe(200);
    expect(skill.body).toContain("name: solidloom-api-models");
    expect(skill.body).toContain("Status: available.");
  });

  it("creates, lists, reads, updates, and deletes a versioned model", async () => {
    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/models",
      payload: { name: "桌面挂钩" },
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json();
    expect(created).toMatchObject({ name: "桌面挂钩", unit: "mm", revision: 1 });
    expect(created.featureGraph.features).toHaveLength(1);
    expect(created.featureGraph.groups).toEqual([]);
    expect(created.featureGraph.features[0]).toMatchObject({ type: "box", operation: "add" });

    const listed = await app.inject({ method: "GET", url: "/api/models" });
    expect(listed.json()).toMatchObject({ total: 1, items: [expect.objectContaining({ id: created.id })] });

    const inspected = await app.inject({ method: "GET", url: `/api/models/${created.id}` });
    expect(inspected.statusCode).toBe(200);
    expect(inspected.json()).toMatchObject({ id: created.id, revision: 1 });

    const conflict = await app.inject({
      method: "PATCH",
      url: `/api/models/${created.id}`,
      payload: { expectedRevision: 9, description: "功能件" },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ error: "revision_conflict" });

    const updatedResponse = await app.inject({
      method: "PATCH",
      url: `/api/models/${created.id}`,
      payload: { expectedRevision: 1, description: "功能件" },
    });
    expect(updatedResponse.statusCode).toBe(200);
    const updated = updatedResponse.json();
    expect(updated).toMatchObject({ id: created.id, description: "功能件", revision: 2 });

    const graph = structuredClone(updated.featureGraph);
    graph.features[0].parameters.width = 72;
    graph.features[0].scale = [1.2, 1, 1];
    graph.groups = [{
      id: "mounting-parts",
      name: "安装件",
      featureIds: [graph.features[0].id],
      position: [1, 2, 3],
      rotation: [0, 0, 15],
      scale: [1, 1, 1],
    }];
    const replacedResponse = await app.inject({
      method: "PUT",
      url: `/api/models/${created.id}/features`,
      payload: { expectedRevision: 2, featureGraph: graph },
    });
    expect(replacedResponse.statusCode).toBe(200);
    const replaced = replacedResponse.json();
    expect(replaced).toMatchObject({ revision: 3 });
    expect(replaced.featureGraph.features[0].parameters.width).toBe(72);
    expect(replaced.featureGraph.groups[0]).toMatchObject({
      id: "mounting-parts",
      featureIds: [graph.features[0].id],
      position: [1, 2, 3],
      rotation: [0, 0, 15],
      scale: [1, 1, 1],
    });
    expect(replaced.featureGraph.features[0].scale).toEqual([1.2, 1, 1]);

    const staleDelete = await app.inject({ method: "DELETE", url: `/api/models/${created.id}?expectedRevision=2` });
    expect(staleDelete.statusCode).toBe(409);

    const deleted = await app.inject({ method: "DELETE", url: `/api/models/${created.id}?expectedRevision=3` });
    expect(deleted.statusCode).toBe(204);
    const missing = await app.inject({ method: "GET", url: `/api/models/${created.id}` });
    expect(missing.statusCode).toBe(404);
  });

  it("persists a derived triangle-mesh result", async () => {
    const feature = {
      id: "derived-mesh",
      name: "布尔结果",
      type: "mesh",
      operation: "add",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      parameters: {
        positions: [0, 0, 0, 10, 0, 0, 0, 10, 0],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
      },
    };
    const created = await app.inject({
      method: "POST",
      url: "/api/models",
      payload: { name: "网格结果", featureGraph: { version: 1, features: [feature], groups: [] } },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().featureGraph.features[0]).toMatchObject({ id: "derived-mesh", type: "mesh", scale: [1, 1, 1] });

    const removed = await app.inject({ method: "DELETE", url: `/api/models/${created.json().id}?expectedRevision=1` });
    expect(removed.statusCode).toBe(204);
  });

  it("rejects duplicate feature ids before persistence", async () => {
    const graph = {
      version: 1,
      features: [
        { id: "duplicate", name: "实体一", type: "box", operation: "add", position: [0, 0, 0], rotation: [0, 0, 0], parameters: { width: 10, depth: 10, height: 10 } },
        { id: "duplicate", name: "实体二", type: "box", operation: "add", position: [0, 0, 0], rotation: [0, 0, 0], parameters: { width: 10, depth: 10, height: 10 } },
      ],
    };
    const response = await app.inject({ method: "POST", url: "/api/models", payload: { name: "无效模型", featureGraph: graph } });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: "invalid_feature_graph" });
  });

  it("rejects feature groups that share the same feature", async () => {
    const feature = {
      id: "shared-feature",
      name: "共享实体",
      type: "box",
      operation: "add",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      parameters: { width: 10, depth: 10, height: 10 },
    };
    const graph = {
      version: 1,
      features: [feature],
      groups: [
        { id: "group-a", name: "分组一", featureIds: [feature.id], position: [0, 0, 0], rotation: [0, 0, 0] },
        { id: "group-b", name: "分组二", featureIds: [feature.id], position: [0, 0, 0], rotation: [0, 0, 0] },
      ],
    };
    const response = await app.inject({ method: "POST", url: "/api/models", payload: { name: "重叠分组", featureGraph: graph } });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: "invalid_feature_graph" });
  });
});
