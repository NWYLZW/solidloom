import {
  SIMULATION_SCHEMA_VERSION,
  type FixedSimulationClockConfig,
  type FixedSimulationClockState,
  type SimulationClockAdvance,
  type SimulationRecoveryPolicy,
  type SimulationTick,
} from "./types.js";

const MIN_FIXED_STEP_MS = 1;
const MAX_FIXED_STEP_MS = 60_000;
const MIN_TIME_SCALE = 0.01;
const MAX_TIME_SCALE = 64;
const MAX_CATCH_UP_TICKS = 10_000;
const SIMULATION_TIME_PRECISION = 1_000_000_000;

export class SimulationRevisionConflictError extends Error {
  constructor(
    readonly expectedRevision: number,
    readonly currentRevision: number,
  ) {
    super(`Expected simulation revision ${expectedRevision}, current revision is ${currentRevision}.`);
    this.name = "SimulationRevisionConflictError";
  }
}

export class InvalidSimulationTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSimulationTimeError";
  }
}

function nonNegativeInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidSimulationTimeError(`${name} must be a non-negative safe integer.`);
  }
}

function validateRecoveryPolicy(policy: SimulationRecoveryPolicy) {
  if (policy.mode === "catch-up") {
    nonNegativeInteger(policy.maxElapsedMs, "recoveryPolicy.maxElapsedMs");
  }
}

export function validateFixedSimulationClockConfig(config: FixedSimulationClockConfig): void {
  if (!Number.isSafeInteger(config.fixedStepMs)
    || config.fixedStepMs < MIN_FIXED_STEP_MS
    || config.fixedStepMs > MAX_FIXED_STEP_MS) {
    throw new InvalidSimulationTimeError(`fixedStepMs must be an integer from ${MIN_FIXED_STEP_MS} to ${MAX_FIXED_STEP_MS}.`);
  }
  if (!Number.isFinite(config.timeScale)
    || config.timeScale < MIN_TIME_SCALE
    || config.timeScale > MAX_TIME_SCALE) {
    throw new InvalidSimulationTimeError(`timeScale must be from ${MIN_TIME_SCALE} to ${MAX_TIME_SCALE}.`);
  }
  if (!Number.isSafeInteger(config.maxCatchUpTicks)
    || config.maxCatchUpTicks < 1
    || config.maxCatchUpTicks > MAX_CATCH_UP_TICKS) {
    throw new InvalidSimulationTimeError(`maxCatchUpTicks must be an integer from 1 to ${MAX_CATCH_UP_TICKS}.`);
  }
  validateRecoveryPolicy(config.recoveryPolicy);
}

function assertRevision(clock: FixedSimulationClockState, expectedRevision: number) {
  nonNegativeInteger(expectedRevision, "expectedRevision");
  if (clock.revision !== expectedRevision) {
    throw new SimulationRevisionConflictError(expectedRevision, clock.revision);
  }
}

function assertWallTime(clock: FixedSimulationClockState, observedWallTimeMs: number) {
  nonNegativeInteger(observedWallTimeMs, "observedWallTimeMs");
  if (observedWallTimeMs < clock.observedWallTimeMs) {
    throw new InvalidSimulationTimeError("observedWallTimeMs cannot move backwards.");
  }
}

function stableMilliseconds(value: number) {
  return Math.round(value * SIMULATION_TIME_PRECISION) / SIMULATION_TIME_PRECISION;
}

export function createFixedSimulationClock(input: {
  readonly runId: string;
  readonly observedWallTimeMs: number;
  readonly config: FixedSimulationClockConfig;
  readonly status?: "running" | "paused";
  readonly simulationTimeMs?: number;
  readonly tickIndex?: number;
}): FixedSimulationClockState {
  if (!input.runId) throw new InvalidSimulationTimeError("runId must not be empty.");
  nonNegativeInteger(input.observedWallTimeMs, "observedWallTimeMs");
  nonNegativeInteger(input.simulationTimeMs ?? 0, "simulationTimeMs");
  nonNegativeInteger(input.tickIndex ?? 0, "tickIndex");
  validateFixedSimulationClockConfig(input.config);
  return Object.freeze({
    schemaVersion: SIMULATION_SCHEMA_VERSION,
    runId: input.runId,
    revision: 0,
    status: input.status ?? "running",
    config: Object.freeze({ ...input.config, recoveryPolicy: Object.freeze({ ...input.config.recoveryPolicy }) }),
    simulationTimeMs: input.simulationTimeMs ?? 0,
    tickIndex: input.tickIndex ?? 0,
    accumulatorMs: 0,
    observedWallTimeMs: input.observedWallTimeMs,
  });
}

function advanceByElapsed(
  clock: FixedSimulationClockState,
  acceptedWallElapsedMs: number,
  observedWallTimeMs: number,
): SimulationClockAdvance {
  const scaledElapsedMs = stableMilliseconds(acceptedWallElapsedMs * clock.config.timeScale);
  const accumulatedMs = stableMilliseconds(clock.accumulatorMs + scaledElapsedMs);
  const maximumBacklogMs = clock.config.fixedStepMs * clock.config.maxCatchUpTicks;
  const acceptedScaledTimeMs = Math.min(accumulatedMs, maximumBacklogMs);
  const droppedScaledTimeMs = stableMilliseconds(Math.max(0, accumulatedMs - acceptedScaledTimeMs));
  const tickCount = Math.floor(acceptedScaledTimeMs / clock.config.fixedStepMs);
  const accumulatorMs = stableMilliseconds(acceptedScaledTimeMs - tickCount * clock.config.fixedStepMs);
  const ticks: SimulationTick[] = [];
  for (let offset = 0; offset < tickCount; offset += 1) {
    const index = clock.tickIndex + offset + 1;
    const startedAtMs = clock.simulationTimeMs + offset * clock.config.fixedStepMs;
    ticks.push(Object.freeze({
      runId: clock.runId,
      index,
      startedAtMs,
      endedAtMs: startedAtMs + clock.config.fixedStepMs,
      deltaMs: clock.config.fixedStepMs,
    }));
  }
  const nextClock: FixedSimulationClockState = Object.freeze({
    ...clock,
    revision: clock.revision + 1,
    simulationTimeMs: clock.simulationTimeMs + tickCount * clock.config.fixedStepMs,
    tickIndex: clock.tickIndex + tickCount,
    accumulatorMs,
    observedWallTimeMs,
  });
  return Object.freeze({
    clock: nextClock,
    ticks: Object.freeze(ticks),
    acceptedWallElapsedMs,
    ignoredWallElapsedMs: 0,
    droppedScaledTimeMs,
  });
}

function unchanged(clock: FixedSimulationClockState): SimulationClockAdvance {
  return Object.freeze({
    clock,
    ticks: Object.freeze([]),
    acceptedWallElapsedMs: 0,
    ignoredWallElapsedMs: 0,
    droppedScaledTimeMs: 0,
  });
}

export function advanceFixedSimulationClock(
  clock: FixedSimulationClockState,
  observedWallTimeMs: number,
  expectedRevision: number,
): SimulationClockAdvance {
  assertRevision(clock, expectedRevision);
  assertWallTime(clock, observedWallTimeMs);
  if (clock.status === "paused" || observedWallTimeMs === clock.observedWallTimeMs) return unchanged(clock);
  return advanceByElapsed(clock, observedWallTimeMs - clock.observedWallTimeMs, observedWallTimeMs);
}

export function pauseFixedSimulationClock(
  clock: FixedSimulationClockState,
  observedWallTimeMs: number,
  expectedRevision: number,
): SimulationClockAdvance {
  assertRevision(clock, expectedRevision);
  assertWallTime(clock, observedWallTimeMs);
  if (clock.status === "paused") return unchanged(clock);
  const advanced = advanceByElapsed(clock, observedWallTimeMs - clock.observedWallTimeMs, observedWallTimeMs);
  return Object.freeze({
    ...advanced,
    clock: Object.freeze({ ...advanced.clock, status: "paused" as const }),
  });
}

export function resumeFixedSimulationClock(
  clock: FixedSimulationClockState,
  observedWallTimeMs: number,
  expectedRevision: number,
): FixedSimulationClockState {
  assertRevision(clock, expectedRevision);
  assertWallTime(clock, observedWallTimeMs);
  if (clock.status === "running") return clock;
  return Object.freeze({
    ...clock,
    revision: clock.revision + 1,
    status: "running",
    observedWallTimeMs,
  });
}

export function setFixedSimulationTimeScale(
  clock: FixedSimulationClockState,
  timeScale: number,
  observedWallTimeMs: number,
  expectedRevision: number,
): SimulationClockAdvance {
  assertRevision(clock, expectedRevision);
  assertWallTime(clock, observedWallTimeMs);
  validateFixedSimulationClockConfig({ ...clock.config, timeScale });
  const advanced = clock.status === "running"
    ? advanceByElapsed(clock, observedWallTimeMs - clock.observedWallTimeMs, observedWallTimeMs)
    : unchanged(clock);
  if (advanced.clock.config.timeScale === timeScale) return advanced;
  return Object.freeze({
    ...advanced,
    clock: Object.freeze({
      ...advanced.clock,
      revision: advanced.clock === clock ? clock.revision + 1 : advanced.clock.revision,
      config: Object.freeze({ ...advanced.clock.config, timeScale }),
    }),
  });
}

export function setSimulationRecoveryPolicy(
  clock: FixedSimulationClockState,
  recoveryPolicy: SimulationRecoveryPolicy,
  expectedRevision: number,
): FixedSimulationClockState {
  assertRevision(clock, expectedRevision);
  validateRecoveryPolicy(recoveryPolicy);
  if (JSON.stringify(clock.config.recoveryPolicy) === JSON.stringify(recoveryPolicy)) return clock;
  return Object.freeze({
    ...clock,
    revision: clock.revision + 1,
    config: Object.freeze({ ...clock.config, recoveryPolicy: Object.freeze({ ...recoveryPolicy }) }),
  });
}

export function recoverFixedSimulationClock(
  clock: FixedSimulationClockState,
  observedWallTimeMs: number,
  expectedRevision: number,
): SimulationClockAdvance {
  assertRevision(clock, expectedRevision);
  assertWallTime(clock, observedWallTimeMs);
  if (clock.status === "paused" || observedWallTimeMs === clock.observedWallTimeMs) return unchanged(clock);
  const wallElapsedMs = observedWallTimeMs - clock.observedWallTimeMs;
  if (clock.config.recoveryPolicy.mode === "freeze") {
    return Object.freeze({
      clock: Object.freeze({
        ...clock,
        revision: clock.revision + 1,
        observedWallTimeMs,
      }),
      ticks: Object.freeze([]),
      acceptedWallElapsedMs: 0,
      ignoredWallElapsedMs: wallElapsedMs,
      droppedScaledTimeMs: 0,
    });
  }
  const acceptedWallElapsedMs = Math.min(wallElapsedMs, clock.config.recoveryPolicy.maxElapsedMs);
  const advanced = advanceByElapsed(clock, acceptedWallElapsedMs, observedWallTimeMs);
  return Object.freeze({
    ...advanced,
    ignoredWallElapsedMs: wallElapsedMs - acceptedWallElapsedMs,
  });
}
