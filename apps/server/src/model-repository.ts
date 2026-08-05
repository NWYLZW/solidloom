import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  CreateModelInput,
  FeatureGraph,
  ModelList,
  ModelRecord,
  ReplaceFeatureGraphInput,
  UpdateModelInput,
} from "@solidloom/shared";

interface ModelRow {
  id: string;
  kind: ModelRecord["kind"];
  name: string;
  description: string;
  unit: ModelRecord["unit"];
  revision: number;
  feature_graph: string;
  created_at: string;
  updated_at: string;
}

export class RevisionConflictError extends Error {
  constructor(
    public readonly expectedRevision: number,
    public readonly actualRevision: number,
  ) {
    super(`Expected revision ${expectedRevision}, but the current revision is ${actualRevision}.`);
    this.name = "RevisionConflictError";
  }
}

function defaultFeatureGraph(): FeatureGraph {
  return {
    version: 1,
    groups: [],
    features: [
      {
        id: randomUUID(),
        name: "基础实体",
        type: "box",
        operation: "add",
        position: [0, 12, 0],
        rotation: [0, 0, 0],
        parameters: { width: 48, depth: 32, height: 24 },
      },
    ],
  };
}

function toModel(row: ModelRow): ModelRecord {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    unit: row.unit,
    revision: row.revision,
    featureGraph: JSON.parse(row.feature_graph) as FeatureGraph,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ModelRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath = ":memory:") {
    if (databasePath !== ":memory:") mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec("PRAGMA foreign_keys = ON");
    if (databasePath !== ":memory:") this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL DEFAULT 'asset' CHECK (kind IN ('asset', 'scene')),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        unit TEXT NOT NULL CHECK (unit IN ('mm', 'cm', 'in')),
        revision INTEGER NOT NULL CHECK (revision >= 1),
        feature_graph TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS models_updated_at_index ON models(updated_at DESC);
    `);
    const columns = this.database.prepare("PRAGMA table_info(models)").all() as unknown as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "kind")) {
      this.database.exec("ALTER TABLE models ADD COLUMN kind TEXT NOT NULL DEFAULT 'asset' CHECK (kind IN ('asset', 'scene'))");
    }
  }

  close(): void {
    this.database.close();
  }

  list(): ModelList {
    const rows = this.database
      .prepare("SELECT * FROM models ORDER BY updated_at DESC, created_at DESC")
      .all() as unknown as ModelRow[];
    return { items: rows.map(toModel), total: rows.length };
  }

  get(modelId: string): ModelRecord | null {
    const row = this.database.prepare("SELECT * FROM models WHERE id = ?").get(modelId) as ModelRow | undefined;
    return row ? toModel(row) : null;
  }

  create(input: CreateModelInput): ModelRecord {
    const now = new Date().toISOString();
    const model: ModelRecord = {
      id: randomUUID(),
      kind: input.kind ?? "asset",
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      unit: input.unit ?? "mm",
      revision: 1,
      featureGraph: input.featureGraph ?? defaultFeatureGraph(),
      createdAt: now,
      updatedAt: now,
    };
    this.database.prepare(`
      INSERT INTO models (id, kind, name, description, unit, revision, feature_graph, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      model.id,
      model.kind,
      model.name,
      model.description,
      model.unit,
      model.revision,
      JSON.stringify(model.featureGraph),
      model.createdAt,
      model.updatedAt,
    );
    return model;
  }

  update(modelId: string, input: UpdateModelInput): ModelRecord | null {
    const current = this.get(modelId);
    if (!current) return null;
    if (current.revision !== input.expectedRevision) {
      throw new RevisionConflictError(input.expectedRevision, current.revision);
    }

    const updated: ModelRecord = {
      ...current,
      kind: input.kind ?? current.kind,
      name: input.name?.trim() ?? current.name,
      description: input.description?.trim() ?? current.description,
      unit: input.unit ?? current.unit,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    const result = this.database.prepare(`
      UPDATE models
      SET kind = ?, name = ?, description = ?, unit = ?, revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?
    `).run(
      updated.kind,
      updated.name,
      updated.description,
      updated.unit,
      updated.revision,
      updated.updatedAt,
      modelId,
      current.revision,
    );
    if (Number(result.changes) === 0) {
      const latest = this.get(modelId);
      throw new RevisionConflictError(input.expectedRevision, latest?.revision ?? current.revision);
    }
    return updated;
  }

  replaceFeatureGraph(modelId: string, input: ReplaceFeatureGraphInput): ModelRecord | null {
    const current = this.get(modelId);
    if (!current) return null;
    if (current.revision !== input.expectedRevision) {
      throw new RevisionConflictError(input.expectedRevision, current.revision);
    }

    const updated: ModelRecord = {
      ...current,
      featureGraph: input.featureGraph,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    const result = this.database.prepare(`
      UPDATE models
      SET feature_graph = ?, revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?
    `).run(
      JSON.stringify(updated.featureGraph),
      updated.revision,
      updated.updatedAt,
      modelId,
      current.revision,
    );
    if (Number(result.changes) === 0) {
      const latest = this.get(modelId);
      throw new RevisionConflictError(input.expectedRevision, latest?.revision ?? current.revision);
    }
    return updated;
  }

  delete(modelId: string, expectedRevision: number): boolean {
    const current = this.get(modelId);
    if (!current) return false;
    if (current.revision !== expectedRevision) {
      throw new RevisionConflictError(expectedRevision, current.revision);
    }
    const result = this.database
      .prepare("DELETE FROM models WHERE id = ? AND revision = ?")
      .run(modelId, expectedRevision);
    if (Number(result.changes) === 0) {
      const latest = this.get(modelId);
      if (latest) throw new RevisionConflictError(expectedRevision, latest.revision);
      return false;
    }
    return true;
  }
}
