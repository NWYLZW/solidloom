import {
  createCyberOfficeSpaceModel,
  createInteractionPlaygroundModel,
  cyberFactoryModels,
} from "@solidloom/shared";

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
    if (current.kind !== (specification.kind ?? "asset") || current.description !== specification.description || current.unit !== specification.unit) {
      current = await request(`/api/models/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        body: {
          expectedRevision: current.revision,
          kind: specification.kind ?? "asset",
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

const sourceModels = await request("/api/models");
const sourceByName = new Map(sourceModels.items.map((item) => [item.name, item]));
const room = sourceByName.get("房间");
const desk = sourceByName.get("办公桌");
const monitor = sourceByName.get("电脑显示器");
const laptop = sourceByName.get("笔记本");
const chair = sourceByName.get("简易人体工学椅");
const snackCabinet = sourceByName.get("参数化零食售货机");
if (!room || !desk || !monitor || !laptop || !chair || !snackCabinet) throw new Error("创建场景前必须先存在房间、办公桌、电脑显示器、笔记本、简易人体工学椅和参数化零食售货机模型。");

const spaceSpecification = createCyberOfficeSpaceModel({
  roomId: room.id,
  deskId: desk.id,
  monitorId: monitor.id,
  laptopId: laptop.id,
  chairId: chair.id,
});
const existingSpace = sourceByName.get(spaceSpecification.name);
if (!existingSpace) {
  const space = await request("/api/models", { method: "POST", body: spaceSpecification });
  created.push({ id: space.id, name: space.name, features: space.featureGraph.features.length, references: space.featureGraph.references?.length ?? 0 });
} else {
  let current = existingSpace;
  let changed = false;
  if (current.kind !== (spaceSpecification.kind ?? "asset") || current.description !== spaceSpecification.description || current.unit !== spaceSpecification.unit) {
    current = await request(`/api/models/${encodeURIComponent(current.id)}`, {
      method: "PATCH",
      body: {
        expectedRevision: current.revision,
        kind: spaceSpecification.kind ?? "asset",
        description: spaceSpecification.description,
        unit: spaceSpecification.unit,
      },
    });
    changed = true;
  }
  if (canonicalJson(current.featureGraph) !== canonicalJson(spaceSpecification.featureGraph)) {
    current = await request(`/api/models/${encodeURIComponent(current.id)}/features`, {
      method: "PUT",
      body: { expectedRevision: current.revision, featureGraph: spaceSpecification.featureGraph },
    });
    changed = true;
  }
  if (changed) replaced.push({ id: current.id, name: current.name, revision: current.revision, features: current.featureGraph.features.length, references: current.featureGraph.references?.length ?? 0 });
  else skipped.push(spaceSpecification.name);
}

const playgroundSpecification = createInteractionPlaygroundModel({
  roomId: room.id,
  deskId: desk.id,
  monitorId: monitor.id,
  chairId: chair.id,
  snackCabinetId: snackCabinet.id,
});
const existingPlayground = sourceByName.get(playgroundSpecification.name);
if (!existingPlayground) {
  const playground = await request("/api/models", { method: "POST", body: playgroundSpecification });
  created.push({ id: playground.id, name: playground.name, features: 0, references: playground.featureGraph.references?.length ?? 0 });
} else {
  let current = existingPlayground;
  let changed = false;
  if (current.kind !== (playgroundSpecification.kind ?? "asset") || current.description !== playgroundSpecification.description || current.unit !== playgroundSpecification.unit) {
    current = await request(`/api/models/${encodeURIComponent(current.id)}`, {
      method: "PATCH",
      body: {
        expectedRevision: current.revision,
        kind: playgroundSpecification.kind ?? "asset",
        description: playgroundSpecification.description,
        unit: playgroundSpecification.unit,
      },
    });
    changed = true;
  }
  if (canonicalJson(current.featureGraph) !== canonicalJson(playgroundSpecification.featureGraph)) {
    current = await request(`/api/models/${encodeURIComponent(current.id)}/features`, {
      method: "PUT",
      body: { expectedRevision: current.revision, featureGraph: playgroundSpecification.featureGraph },
    });
    changed = true;
  }
  if (changed) replaced.push({ id: current.id, name: current.name, revision: current.revision, features: 0, references: current.featureGraph.references?.length ?? 0 });
  else skipped.push(playgroundSpecification.name);
}

process.stdout.write(`${JSON.stringify({ project: "赛博工厂", created, replaced, skipped }, null, 2)}\n`);
