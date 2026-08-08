import {
  createCyberOfficeSpaceModel,
  createInteractionPlaygroundModel,
  cyberFactoryModelModules,
} from "@solidloom/shared";
import { readdir } from "node:fs/promises";

const domainModelsUrl = new URL("../domain-packages/cyber-factory/models/", import.meta.url);

function collectModelModules(value, modules) {
  if (Array.isArray(value)) {
    for (const item of value) collectModelModules(item, modules);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (
    typeof value.id === "string"
    && (value.source === "asset" || value.source === "factory")
    && (value.status === "available" || value.status === "planned")
    && typeof value.createModel === "function"
  ) {
    modules.set(value.id, value);
  }
}

async function discoverDomainModelModules() {
  const modules = new Map(cyberFactoryModelModules.map((module) => [module.id, module]));
  const entries = await readdir(domainModelsUrl, { withFileTypes: true });
  for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
    try {
      const namespace = await import(new URL(`${entry.name}/index.ts`, domainModelsUrl).href);
      for (const value of Object.values(namespace)) collectModelModules(value, modules);
    } catch (error) {
      throw new Error(`无法加载领域模型目录 ${entry.name}：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return [...modules.values()];
}

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

function hasLegacyWarehouseStackerOrientation(model) {
  if (model?.name !== "参数化巷道堆垛机") return false;
  // 旧修订把立柱和载货台放在货架背面，货叉同时朝外伸出。
  // 只识别这一组完整特征，避免种子同步覆盖用户后续修改过的模型。
  const featureById = new Map(
    (model.featureGraph?.features ?? []).map((feature) => [feature.id, feature]),
  );
  const mast = featureById.get("warehouse-stacker-single-mast");
  const carriageBack = featureById.get("warehouse-stacker-carriage-back");
  const forkCrosshead = featureById.get("warehouse-stacker-fork-crosshead");
  const leftFork = featureById.get("warehouse-stacker-left-fork");
  return (
    mast?.position?.[2] < 0
    && carriageBack?.position?.[2] < 0
    && forkCrosshead?.position?.[2] < 0
    && leftFork?.position?.[2] > 0
  );
}

function preserveImportedAvatarSkin(specification, existing) {
  if (!existing || specification.name !== "原创方块角色") return specification;
  const importedSkin = existing.featureGraph.features
    .map((feature) => feature.appearance?.voxelSkin)
    .find((skin) => typeof skin?.url === "string" && !skin.url.startsWith("builtin:"));
  if (!importedSkin) return specification;
  return {
    ...specification,
    featureGraph: {
      ...specification.featureGraph,
      features: specification.featureGraph.features.map((feature) => {
        if (!feature.appearance?.voxelSkin) return feature;
        return {
          ...feature,
          appearance: {
            ...feature.appearance,
            voxelSkin: {
              ...feature.appearance.voxelSkin,
              model: importedSkin.model,
              url: importedSkin.url,
            },
          },
        };
      }),
    },
  };
}

const health = await request("/api/health");
if (health.status !== "ok") throw new Error("SolidLoom 本地服务尚未就绪。");

const existingModels = await request("/api/models");
const existingByName = new Map(existingModels.items.map((item) => [item.name, item]));
const replaceExisting = process.argv.includes("--replace");
const created = [];
const replaced = [];
const skipped = [];
const modelModules = await discoverDomainModelModules();
const availableModels = modelModules.filter((module) => module.status === "available");
const plannedModels = modelModules.filter((module) => module.status === "planned").map((module) => module.id);
const availableSpecifications = new Map();
for (const module of availableModels) {
  const specification = module.createModel();
  availableSpecifications.set(specification.name, specification);
}

const legacyStacker = existingByName.get("参数化巷道堆垛机（规划中）");
if (replaceExisting && legacyStacker && !existingByName.has("参数化巷道堆垛机")) {
  const specification = availableSpecifications.get("参数化巷道堆垛机");
  if (specification) {
    const migrated = await request(`/api/models/${encodeURIComponent(legacyStacker.id)}`, {
      method: "PATCH",
      body: {
        expectedRevision: legacyStacker.revision,
        kind: specification.kind ?? "asset",
        name: specification.name,
        description: specification.description,
        unit: specification.unit,
      },
    });
    existingByName.delete(legacyStacker.name);
    existingByName.set(migrated.name, migrated);
  }
}

for (const sourceSpecification of [...availableSpecifications.values()].reverse()) {
  const existing = existingByName.get(sourceSpecification.name);
  const specification = preserveImportedAvatarSkin(sourceSpecification, existing);
  const requiresKnownMigration = hasLegacyWarehouseStackerOrientation(existing);
  if (existing && !replaceExisting && !requiresKnownMigration) {
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
const coffeeMachine = sourceByName.get("参数化咖啡机");
const waterDispenser = sourceByName.get("参数化下置桶饮水机");
const lounge = sourceByName.get("现代休息区资产套件");
const warehouseRack = sourceByName.get("参数化仓储货架");
const warehouseStackerCrane = sourceByName.get("参数化巷道堆垛机");
const warehousePallet = sourceByName.get("参数化仓储托盘");
const warehouseTote = sourceByName.get("参数化仓储周转箱");
const warehouseCart = sourceByName.get("参数化仓储推车");
if (!room || !desk || !monitor || !laptop || !chair || !snackCabinet || !coffeeMachine || !waterDispenser || !lounge || !warehouseRack || !warehouseStackerCrane || !warehousePallet || !warehouseTote || !warehouseCart) {
  throw new Error("创建场景前必须先存在房间、办公资产、补给设备、休息区和可用仓储物流模型。");
}

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
  coffeeMachineId: coffeeMachine.id,
  loungeId: lounge.id,
  snackCabinetId: snackCabinet.id,
  waterDispenserId: waterDispenser.id,
  warehouseCartId: warehouseCart.id,
  warehousePalletId: warehousePallet.id,
  warehouseRackId: warehouseRack.id,
  warehouseStackerCraneId: warehouseStackerCrane.id,
  warehouseToteId: warehouseTote.id,
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

process.stdout.write(`${JSON.stringify({
  project: "赛博工厂",
  discovered: modelModules.map((module) => ({ id: module.id, source: module.source, status: module.status })),
  planned: plannedModels,
  created,
  replaced,
  skipped,
}, null, 2)}\n`);
