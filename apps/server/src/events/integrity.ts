import { createHash } from "node:crypto";
import type { RuntimeJsonValue } from "@solidloom/shared";

export class RuntimeSerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeSerializationError";
  }
}

function normalizeJson(value: unknown, ancestors: Set<object>): RuntimeJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object") {
    throw new RuntimeSerializationError("运行数据必须是可序列化的 JSON 值。");
  }
  if (ancestors.has(value)) throw new RuntimeSerializationError("运行数据不能包含循环引用。");
  ancestors.add(value);
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeJson(item, ancestors));
    ancestors.delete(value);
    return normalized;
  }
  const normalized: Record<string, RuntimeJsonValue> = {};
  Object.keys(value).sort().forEach((key) => {
    const item = (value as Record<string, unknown>)[key];
    if (item === undefined) throw new RuntimeSerializationError(`运行数据字段 ${key} 不能为 undefined。`);
    normalized[key] = normalizeJson(item, ancestors);
  });
  ancestors.delete(value);
  return normalized;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value, new Set()));
}

export function cloneRuntimeJson<Value extends RuntimeJsonValue>(value: Value): Value {
  return JSON.parse(canonicalJson(value)) as Value;
}

export function runtimeChecksum(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
