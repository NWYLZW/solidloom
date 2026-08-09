import {
  SIMULATION_SCHEDULE_PURPOSES,
  SIMULATION_SCHEMA_VERSION,
  type SimulationScheduleDispatchResult,
  type SimulationScheduledDispatch,
  type SimulationScheduleEntry,
  type SimulationScheduleInput,
  type SimulationScheduleMutation,
  type SimulationScheduleState,
} from "./types.js";
import { InvalidSimulationTimeError, SimulationRevisionConflictError } from "./clock.js";
import type { RuntimeJsonObject, RuntimeJsonValue } from "../runtime/domain.js";

const HANDLER_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9-]*)+$/;

export class InvalidSimulationScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSimulationScheduleError";
  }
}

export class SimulationScheduleNotFoundError extends Error {
  constructor(readonly scheduleId: string) {
    super(`Simulation schedule ${scheduleId} was not found.`);
    this.name = "SimulationScheduleNotFoundError";
  }
}

function nonNegativeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidSimulationScheduleError(`${name} must be a non-negative safe integer.`);
  }
}

function assertRevision(schedule: SimulationScheduleState, expectedRevision: number) {
  nonNegativeInteger(expectedRevision, "expectedRevision");
  if (schedule.revision !== expectedRevision) {
    throw new SimulationRevisionConflictError(expectedRevision, schedule.revision);
  }
}

function assertRunId(schedule: SimulationScheduleState, runId: string) {
  if (runId !== schedule.runId) {
    throw new InvalidSimulationScheduleError(`Mutation runId ${runId} does not match ${schedule.runId}.`);
  }
}

function cloneJsonValue(value: unknown, ancestors: Set<object>): RuntimeJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object") {
    throw new InvalidSimulationScheduleError("schedule.payload must contain only JSON-serializable values.");
  }
  if (ancestors.has(value)) {
    throw new InvalidSimulationScheduleError("schedule.payload cannot contain circular references.");
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    const result = Object.freeze(value.map((item) => cloneJsonValue(item, ancestors)));
    ancestors.delete(value);
    return result;
  }
  const result: Record<string, RuntimeJsonValue> = {};
  for (const [key, item] of Object.entries(value)) result[key] = cloneJsonValue(item, ancestors);
  ancestors.delete(value);
  return Object.freeze(result);
}

function cloneJsonObject(value: unknown): RuntimeJsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidSimulationScheduleError("schedule.payload must be a JSON-serializable object.");
  }
  return cloneJsonValue(value, new Set()) as RuntimeJsonObject;
}

export function validateSimulationScheduleInput(input: SimulationScheduleInput): void {
  if (!input.id) throw new InvalidSimulationScheduleError("schedule.id must not be empty.");
  if (!SIMULATION_SCHEDULE_PURPOSES.includes(input.purpose)) {
    throw new InvalidSimulationScheduleError(`Unsupported schedule purpose ${String(input.purpose)}.`);
  }
  if (!HANDLER_ID_PATTERN.test(input.handlerId)) {
    throw new InvalidSimulationScheduleError("schedule.handlerId must be a namespaced ID.");
  }
  cloneJsonObject(input.payload);
  nonNegativeInteger(input.firstDueTimeMs, "schedule.firstDueTimeMs");
  if (input.intervalMs !== null && (!Number.isSafeInteger(input.intervalMs) || input.intervalMs <= 0)) {
    throw new InvalidSimulationScheduleError("schedule.intervalMs must be null or a positive safe integer.");
  }
  if (input.occurrenceLimit !== null
    && (!Number.isSafeInteger(input.occurrenceLimit) || input.occurrenceLimit <= 0)) {
    throw new InvalidSimulationScheduleError("schedule.occurrenceLimit must be null or a positive safe integer.");
  }
  if (input.intervalMs === null && input.occurrenceLimit !== null && input.occurrenceLimit !== 1) {
    throw new InvalidSimulationScheduleError("A one-time schedule can only have an occurrenceLimit of 1 or null.");
  }
  if (!Number.isSafeInteger(input.priority)) {
    throw new InvalidSimulationScheduleError("schedule.priority must be a safe integer.");
  }
}

export function createSimulationScheduleState(
  runId: string,
  initialSimulationTimeMs = 0,
): SimulationScheduleState {
  if (!runId) throw new InvalidSimulationScheduleError("runId must not be empty.");
  nonNegativeInteger(initialSimulationTimeMs, "initialSimulationTimeMs");
  return Object.freeze({
    schemaVersion: SIMULATION_SCHEMA_VERSION,
    runId,
    revision: 0,
    dispatchedThroughTimeMs: initialSimulationTimeMs,
    nextSequence: 0,
    entries: Object.freeze([]),
  });
}

function freezeEntry(entry: SimulationScheduleEntry): SimulationScheduleEntry {
  return Object.freeze({ ...entry, payload: Object.freeze({ ...entry.payload }) });
}

function entryFromInput(
  input: SimulationScheduleInput,
  sequence: number,
  revision: number,
): SimulationScheduleEntry {
  return freezeEntry({
    id: input.id,
    purpose: input.purpose,
    handlerId: input.handlerId,
    payload: cloneJsonObject(input.payload),
    nextDueTimeMs: input.firstDueTimeMs,
    intervalMs: input.intervalMs,
    occurrenceLimit: input.occurrenceLimit,
    occurrencesDispatched: 0,
    priority: input.priority,
    sequence,
    status: "scheduled",
    revision,
  });
}

export function applySimulationScheduleMutation(
  schedule: SimulationScheduleState,
  mutation: SimulationScheduleMutation,
): SimulationScheduleState {
  assertRevision(schedule, mutation.expectedRevision);
  assertRunId(schedule, mutation.runId);
  if (!mutation.id) throw new InvalidSimulationScheduleError("mutation.id must not be empty.");
  nonNegativeInteger(mutation.issuedAtSimulationTimeMs, "mutation.issuedAtSimulationTimeMs");
  const entries = [...schedule.entries];
  let nextSequence = schedule.nextSequence;

  if (mutation.operation === "schedule.put") {
    validateSimulationScheduleInput(mutation.schedule);
    const existingIndex = entries.findIndex(({ id }) => id === mutation.schedule.id);
    if (existingIndex < 0) {
      entries.push(entryFromInput(mutation.schedule, nextSequence, 0));
      nextSequence += 1;
    } else {
      const existing = entries[existingIndex]!;
      entries[existingIndex] = entryFromInput(mutation.schedule, existing.sequence, existing.revision + 1);
    }
  } else {
    if (!mutation.scheduleId) throw new InvalidSimulationScheduleError("mutation.scheduleId must not be empty.");
    const existingIndex = entries.findIndex(({ id }) => id === mutation.scheduleId);
    if (existingIndex < 0) throw new SimulationScheduleNotFoundError(mutation.scheduleId);
    if (mutation.operation === "schedule.delete") {
      entries.splice(existingIndex, 1);
    } else {
      const existing = entries[existingIndex]!;
      entries[existingIndex] = freezeEntry({
        ...existing,
        status: "cancelled",
        revision: existing.revision + 1,
      });
    }
  }

  return Object.freeze({
    ...schedule,
    revision: schedule.revision + 1,
    nextSequence,
    entries: Object.freeze(entries),
  });
}

function compareEntries(left: SimulationScheduleEntry, right: SimulationScheduleEntry): number {
  return left.nextDueTimeMs - right.nextDueTimeMs
    || right.priority - left.priority
    || left.sequence - right.sequence
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function nextDueEntry(entries: readonly SimulationScheduleEntry[], throughTimeMs: number) {
  return entries
    .filter(({ status, nextDueTimeMs }) => status === "scheduled" && nextDueTimeMs <= throughTimeMs)
    .sort(compareEntries)[0];
}

export function dispatchSimulationSchedules(
  schedule: SimulationScheduleState,
  throughTimeMs: number,
  expectedRevision: number,
  maxDispatches = 1_000,
): SimulationScheduleDispatchResult {
  assertRevision(schedule, expectedRevision);
  nonNegativeInteger(throughTimeMs, "throughTimeMs");
  if (throughTimeMs < schedule.dispatchedThroughTimeMs) {
    throw new InvalidSimulationTimeError("Scheduler time cannot move backwards.");
  }
  if (!Number.isSafeInteger(maxDispatches) || maxDispatches < 1 || maxDispatches > 100_000) {
    throw new InvalidSimulationScheduleError("maxDispatches must be an integer from 1 to 100000.");
  }
  const entries = [...schedule.entries];
  const dispatches: SimulationScheduledDispatch[] = [];
  while (dispatches.length < maxDispatches) {
    const due = nextDueEntry(entries, throughTimeMs);
    if (!due) break;
    const index = entries.findIndex(({ id }) => id === due.id);
    const occurrence = due.occurrencesDispatched + 1;
    dispatches.push(Object.freeze({
      scheduleId: due.id,
      purpose: due.purpose,
      handlerId: due.handlerId,
      payload: due.payload,
      occurrence,
      dueTimeMs: due.nextDueTimeMs,
    }));
    const reachedLimit = due.occurrenceLimit !== null && occurrence >= due.occurrenceLimit;
    const completed = due.intervalMs === null || reachedLimit;
    const nextDueTimeMs = completed ? due.nextDueTimeMs : due.nextDueTimeMs + due.intervalMs!;
    if (!Number.isSafeInteger(nextDueTimeMs)) {
      throw new InvalidSimulationScheduleError(`Schedule ${due.id} exceeds the safe simulation time range.`);
    }
    entries[index] = freezeEntry({
      ...due,
      occurrencesDispatched: occurrence,
      nextDueTimeMs,
      status: completed ? "completed" : "scheduled",
      revision: due.revision + 1,
    });
  }
  const hasBacklog = nextDueEntry(entries, throughTimeMs) !== undefined;
  if (dispatches.length === 0 && throughTimeMs === schedule.dispatchedThroughTimeMs) {
    return Object.freeze({ schedule, dispatches: Object.freeze([]), hasBacklog: false });
  }
  return Object.freeze({
    schedule: Object.freeze({
      ...schedule,
      revision: schedule.revision + 1,
      dispatchedThroughTimeMs: throughTimeMs,
      entries: Object.freeze(entries),
    }),
    dispatches: Object.freeze(dispatches),
    hasBacklog,
  });
}
