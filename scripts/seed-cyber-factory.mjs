import { cyberFactoryModels } from "@solidloom/shared";

const server = (process.env.SOLIDLOOM_URL ?? "http://127.0.0.1:4310").replace(/\/+$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${server}${path}`, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json().catch(() => ({ error: "invalid_response" }));
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

function canonicalJson(value) {
  const normalize = (item) => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.keys(item).sort().map((key) => [key, normalize(item[key])]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
}

const health = await request("/api/health");
if (health.status !== "ok") throw new Error("SolidLoom 本地服务尚未就绪。");

const existingModels = await request("/api/models");
const existingByName = new Map(existingModels.items.map((item) => [item.name, item]));
const replaceExisting = process.argv.includes("--replace");
const created = [];
const replaced = [];
const skipped = [];

for (const specification of [...cyberFactoryModels].reverse()) {
  const existing = existingByName.get(specification.name);
  if (existing && !replaceExisting) {
    skipped.push(specification.name);
    continue;
  }
  if (existing) {
    let current = existing;
    let changed = false;
    if (current.description !== specification.description || current.unit !== specification.unit) {
      current = await request(`/api/models/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        body: {
          expectedRevision: current.revision,
          description: specification.description,
          unit: specification.unit,
        },
      });
      changed = true;
    }
    if (canonicalJson(current.featureGraph) !== canonicalJson(specification.featureGraph)) {
      current = await request(`/api/models/${encodeURIComponent(current.id)}/features`, {
        method: "PUT",
        body: { expectedRevision: current.revision, featureGraph: specification.featureGraph },
      });
      changed = true;
    }
    if (changed) {
      replaced.push({ id: current.id, name: current.name, revision: current.revision, features: current.featureGraph.features.length });
    } else {
      skipped.push(specification.name);
    }
    continue;
  }
  const model = await request("/api/models", { method: "POST", body: specification });
  created.push({ id: model.id, name: model.name, features: model.featureGraph.features.length });
}

process.stdout.write(`${JSON.stringify({ project: "赛博工厂", created, replaced, skipped }, null, 2)}\n`);
