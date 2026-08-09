import { InvalidResourceLedgerRequestError } from "./errors.js";
import type { ResourceLedgerBatchRequest } from "./types.js";

function canonicalJson(value: unknown, ancestors: Set<object>): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== "object") {
    throw new InvalidResourceLedgerRequestError("Resource batch must contain only JSON-serializable values.");
  }
  if (ancestors.has(value)) throw new InvalidResourceLedgerRequestError("Resource batch cannot contain circular references.");
  ancestors.add(value);
  if (Array.isArray(value)) {
    const result = `[${value.map((item) => canonicalJson(item, ancestors)).join(",")}]`;
    ancestors.delete(value);
    return result;
  }
  const result = `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item, ancestors)}`)
    .join(",")}}`;
  ancestors.delete(value);
  return result;
}

export function fingerprintResourceLedgerBatch(request: ResourceLedgerBatchRequest): string {
  const { expectedRevision: _expectedRevision, ...semanticRequest } = request;
  return canonicalJson(semanticRequest, new Set());
}

export function resourceAmountToUnits(amount: number, precision: number, name = "amount"): number {
  if (!Number.isFinite(amount)) throw new InvalidResourceLedgerRequestError(`${name} must be finite.`);
  if (!Number.isSafeInteger(precision) || precision < 0 || precision > 12) {
    throw new InvalidResourceLedgerRequestError("Resource precision must be an integer between 0 and 12.");
  }
  const factor = 10 ** precision;
  const scaled = amount * factor;
  const rounded = Math.round(scaled);
  const tolerance = Math.max(1, Math.abs(scaled)) * Number.EPSILON * 8;
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > tolerance) {
    throw new InvalidResourceLedgerRequestError(`${name} exceeds the resource precision or safe quantity range.`);
  }
  return rounded;
}

export function resourceUnitsToAmount(units: number, precision: number): number {
  if (!Number.isSafeInteger(units)) throw new InvalidResourceLedgerRequestError("Resource units must be a safe integer.");
  return units / (10 ** precision);
}
