import { RUNTIME_QUERY_SCHEMA_VERSION } from "./types.js";

interface RuntimeQueryCursorPayload {
  readonly version: typeof RUNTIME_QUERY_SCHEMA_VERSION;
  readonly kind: "entities" | "metrics";
  readonly runId: string;
  readonly baseRevision: number;
  readonly queryFingerprint: string;
  readonly lastItemKey: string;
}

export interface RuntimeQueryCursorInspection {
  readonly kind: "entities" | "metrics";
  readonly runId: string;
  readonly baseRevision: number;
}

export class RuntimeQueryCursorError extends Error {
  readonly code: "invalid-cursor" | "cursor-mismatch" | "cursor-stale";

  constructor(code: RuntimeQueryCursorError["code"], message: string) {
    super(message);
    this.name = "RuntimeQueryCursorError";
    this.code = code;
  }
}

function encodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeUtf8(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isCursorPayload(value: unknown): value is RuntimeQueryCursorPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const candidate = value as Partial<Record<keyof RuntimeQueryCursorPayload, unknown>>;
  return (
    candidate.version === RUNTIME_QUERY_SCHEMA_VERSION
    && (candidate.kind === "entities" || candidate.kind === "metrics")
    && typeof candidate.runId === "string"
    && candidate.runId.length > 0
    && Number.isInteger(candidate.baseRevision)
    && (candidate.baseRevision as number) >= 0
    && typeof candidate.queryFingerprint === "string"
    && typeof candidate.lastItemKey === "string"
  );
}

function parseCursor(cursor: string): RuntimeQueryCursorPayload {
  try {
    const value = JSON.parse(decodeUtf8(cursor)) as unknown;
    if (!isCursorPayload(value)) throw new Error("shape");
    return value;
  } catch {
    throw new RuntimeQueryCursorError("invalid-cursor", "查询游标无效或已损坏");
  }
}

export function createRuntimeQueryCursor(payload: RuntimeQueryCursorPayload): string {
  return encodeUtf8(JSON.stringify(payload));
}

export function inspectRuntimeQueryCursor(cursor: string): RuntimeQueryCursorInspection {
  const { kind, runId, baseRevision } = parseCursor(cursor);
  return { kind, runId, baseRevision };
}

export function resolveRuntimeQueryCursor(
  cursor: string,
  expected: Omit<RuntimeQueryCursorPayload, "version" | "lastItemKey">,
): string {
  const payload = parseCursor(cursor);
  if (payload.kind !== expected.kind || payload.runId !== expected.runId) {
    throw new RuntimeQueryCursorError("cursor-mismatch", "查询游标不属于当前查询目标");
  }
  if (payload.queryFingerprint !== expected.queryFingerprint) {
    throw new RuntimeQueryCursorError("cursor-mismatch", "查询定义已改变，不能继续使用旧游标");
  }
  if (payload.baseRevision !== expected.baseRevision) {
    throw new RuntimeQueryCursorError("cursor-stale", "查询快照修订已改变，请从第一页重新开始");
  }
  return payload.lastItemKey;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
}

export function fingerprintRuntimeQuery(value: unknown): string {
  const source = JSON.stringify(canonicalize(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
