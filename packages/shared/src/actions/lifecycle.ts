import {
  ACTION_RUNTIME_SCHEMA_VERSION,
  type SemanticActionDefinition,
  type SemanticActionInstance,
  type SemanticActionRequest,
  type SemanticActionRuntimeState,
  type SemanticActionStatus,
} from "./types.js";
import { RUNTIME_SCOPE_KINDS } from "../runtime/domain.js";

const TYPE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9-]*)+$/;
const TERMINAL_STATUSES: readonly SemanticActionStatus[] = ["completed", "cancelled", "failed"];

const TRANSITIONS: Readonly<Record<SemanticActionStatus, readonly SemanticActionStatus[]>> = {
  proposed: ["validated", "cancelled", "failed"],
  validated: ["running", "cancelled", "failed"],
  running: ["committed", "cancelled", "failed"],
  committed: ["completed", "cancelled", "failed"],
  completed: [],
  cancelled: [],
  failed: [],
};

export class InvalidSemanticActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSemanticActionError";
  }
}

export class SemanticActionRevisionConflictError extends Error {
  constructor(
    readonly expectedRevision: number,
    readonly currentRevision: number,
  ) {
    super(`Expected action runtime revision ${expectedRevision}, current revision is ${currentRevision}.`);
    this.name = "SemanticActionRevisionConflictError";
  }
}

export class SemanticActionIdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`Idempotency key ${idempotencyKey} was already used for a different semantic action request.`);
    this.name = "SemanticActionIdempotencyConflictError";
  }
}

export function isSemanticActionTerminal(status: SemanticActionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransitionSemanticAction(
  from: SemanticActionStatus,
  to: SemanticActionStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function getSemanticActionProgress(
  action: SemanticActionInstance,
  definition: SemanticActionDefinition,
  atSimulationTimeMs: number,
): number {
  if (action.startedAtSimulationTimeMs === null) return 0;
  if (action.status === "completed") return 1;
  const end = action.endedAtSimulationTimeMs ?? atSimulationTimeMs;
  if (definition.durationMs === 0) return end >= action.startedAtSimulationTimeMs ? 1 : 0;
  return Math.max(0, Math.min(1, (end - action.startedAtSimulationTimeMs) / definition.durationMs));
}

export function semanticActionCommitTime(
  action: SemanticActionInstance,
  definition: SemanticActionDefinition,
): number {
  if (action.startedAtSimulationTimeMs === null) throw new InvalidSemanticActionError("Action has not started.");
  if (definition.commitPoint.mode === "on-start") return action.startedAtSimulationTimeMs;
  if (definition.commitPoint.mode === "on-completion") {
    return action.startedAtSimulationTimeMs + definition.durationMs;
  }
  return action.startedAtSimulationTimeMs + definition.durationMs * definition.commitPoint.progress;
}

function assertNonNegativeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidSemanticActionError(`${name} must be a non-negative safe integer.`);
  }
}

function assertTypeId(value: string, name: string) {
  if (!TYPE_ID_PATTERN.test(value)) throw new InvalidSemanticActionError(`${name} must be a namespaced ID.`);
}

function assertUniqueStrings(values: readonly string[], name: string, typeIds = false) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (!value) throw new InvalidSemanticActionError(`${name}[${index}] must not be empty.`);
    if (typeIds) assertTypeId(value, `${name}[${index}]`);
    if (seen.has(value)) throw new InvalidSemanticActionError(`${name} cannot contain duplicate values.`);
    seen.add(value);
  });
}

export function validateSemanticActionDefinition(definition: SemanticActionDefinition): void {
  assertTypeId(definition.id, "definition.id");
  if (!definition.domainPackageId || !definition.displayName || !definition.description) {
    throw new InvalidSemanticActionError("Definition metadata must not be empty.");
  }
  assertNonNegativeInteger(definition.revision, "definition.revision");
  if (definition.status !== "available" && definition.status !== "planned") {
    throw new InvalidSemanticActionError("definition.status must be available or planned.");
  }
  if (typeof definition.parametersSchema !== "object" || definition.parametersSchema === null) {
    throw new InvalidSemanticActionError("definition.parametersSchema must be an object.");
  }
  canonicalJson(definition.parametersSchema, new Set());
  if (definition.parametersSchema.type !== undefined && definition.parametersSchema.type !== "object") {
    throw new InvalidSemanticActionError("definition.parametersSchema must describe an object.");
  }
  if (typeof definition.subject.required !== "boolean" || typeof definition.target.required !== "boolean") {
    throw new InvalidSemanticActionError("Subject and target required flags must be boolean.");
  }
  assertUniqueStrings(definition.subject.entityTypeIds, "definition.subject.entityTypeIds", true);
  assertUniqueStrings(definition.target.entityTypeIds, "definition.target.entityTypeIds", true);
  assertUniqueStrings(definition.requiredCapabilities, "definition.requiredCapabilities", true);
  const scopeKinds = new Set(definition.target.scopeKinds);
  if (scopeKinds.size !== definition.target.scopeKinds.length) {
    throw new InvalidSemanticActionError("definition.target.scopeKinds cannot contain duplicates.");
  }
  definition.target.scopeKinds.forEach((kind) => {
    if (!RUNTIME_SCOPE_KINDS.includes(kind)) {
      throw new InvalidSemanticActionError(`Unsupported target scope kind ${String(kind)}.`);
    }
  });
  definition.preconditions.forEach((expression, index) => {
    if (expression.language !== "solidloom-expression-v1" || !expression.source) {
      throw new InvalidSemanticActionError(`definition.preconditions[${index}] must be a supported expression.`);
    }
  });
  const channelIds = definition.channels.map(({ id }) => id);
  assertUniqueStrings(channelIds, "definition.channels", true);
  definition.channels.forEach((channel) => {
    if (channel.scope !== "run" && channel.scope !== "subject") {
      throw new InvalidSemanticActionError(`Unsupported action channel scope ${String(channel.scope)}.`);
    }
    if (channel.scope === "subject" && !definition.subject.required) {
      throw new InvalidSemanticActionError("A subject-scoped channel requires a subject.");
    }
  });
  assertNonNegativeInteger(definition.durationMs, "definition.durationMs");
  if (definition.timeoutMs !== null) assertNonNegativeInteger(definition.timeoutMs, "definition.timeoutMs");
  if (definition.commitPoint.mode === "at-progress"
    && (!Number.isFinite(definition.commitPoint.progress)
      || definition.commitPoint.progress <= 0
      || definition.commitPoint.progress >= 1)) {
    throw new InvalidSemanticActionError("at-progress commit progress must be greater than 0 and less than 1.");
  }
  if (definition.commitPoint.mode !== "on-start"
    && definition.commitPoint.mode !== "at-progress"
    && definition.commitPoint.mode !== "on-completion") {
    throw new InvalidSemanticActionError(`Unsupported commit point ${String((definition.commitPoint as { mode?: unknown }).mode)}.`);
  }
  if (definition.commitEffectId !== null) assertTypeId(definition.commitEffectId, "definition.commitEffectId");
  if (definition.cancellation.beforeCommit !== "allow" && definition.cancellation.beforeCommit !== "reject") {
    throw new InvalidSemanticActionError("Unsupported before-commit cancellation policy.");
  }
  if (definition.cancellation.afterCommit.mode !== "reject"
    && definition.cancellation.afterCommit.mode !== "compensate") {
    throw new InvalidSemanticActionError("Unsupported after-commit cancellation policy.");
  }
  if (definition.cancellation.afterCommit.mode === "compensate") {
    assertTypeId(definition.cancellation.afterCommit.effectId, "definition.cancellation.afterCommit.effectId");
  }
}

function canonicalJson(value: unknown, ancestors: Set<object>): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== "object") {
    throw new InvalidSemanticActionError("Action request must contain only JSON-serializable values.");
  }
  if (ancestors.has(value)) throw new InvalidSemanticActionError("Action request cannot contain circular references.");
  ancestors.add(value);
  if (Array.isArray(value)) {
    const serialized = `[${value.map((item) => canonicalJson(item, ancestors)).join(",")}]`;
    ancestors.delete(value);
    return serialized;
  }
  if (typeof value === "object") {
    const serialized = `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item, ancestors)}`)
      .join(",")}}`;
    ancestors.delete(value);
    return serialized;
  }
  throw new InvalidSemanticActionError("Action request must contain only JSON-serializable values.");
}

export function fingerprintSemanticActionRequest(request: SemanticActionRequest): string {
  const { expectedRevision: _expectedRevision, ...semanticRequest } = request;
  return canonicalJson(semanticRequest, new Set());
}

export function createSemanticActionRuntimeState(
  runId: string,
  simulationTimeMs = 0,
): SemanticActionRuntimeState {
  if (!runId) throw new InvalidSemanticActionError("runId must not be empty.");
  assertNonNegativeInteger(simulationTimeMs, "simulationTimeMs");
  return Object.freeze({
    schemaVersion: ACTION_RUNTIME_SCHEMA_VERSION,
    runId,
    revision: 0,
    simulationTimeMs,
    nextActionSequence: 0,
    nextEventSequence: 0,
    actions: Object.freeze([]),
    idempotencyRecords: Object.freeze([]),
    events: Object.freeze([]),
  });
}
