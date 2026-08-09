import type { RuntimeJsonObject } from "../runtime/domain.js";

export const SIMULATION_SCHEMA_VERSION = 1 as const;
export const SIMULATION_CLOCK_STATUSES = ["running", "paused"] as const;
export const SIMULATION_RECOVERY_MODES = ["freeze", "catch-up"] as const;
export const SIMULATION_SCHEDULE_PURPOSES = ["state-update", "timeout", "process", "custom"] as const;
export const SIMULATION_SCHEDULE_STATUSES = ["scheduled", "cancelled", "completed"] as const;

export type SimulationClockStatus = (typeof SIMULATION_CLOCK_STATUSES)[number];
export type SimulationRecoveryMode = (typeof SIMULATION_RECOVERY_MODES)[number];
export type SimulationSchedulePurpose = (typeof SIMULATION_SCHEDULE_PURPOSES)[number];
export type SimulationScheduleStatus = (typeof SIMULATION_SCHEDULE_STATUSES)[number];

export type SimulationRecoveryPolicy = (
  | { readonly mode: "freeze" }
  | { readonly mode: "catch-up"; readonly maxElapsedMs: number }
);

export interface FixedSimulationClockConfig {
  readonly fixedStepMs: number;
  readonly timeScale: number;
  readonly maxCatchUpTicks: number;
  readonly recoveryPolicy: SimulationRecoveryPolicy;
}

export interface FixedSimulationClockState {
  readonly schemaVersion: typeof SIMULATION_SCHEMA_VERSION;
  readonly runId: string;
  readonly revision: number;
  readonly status: SimulationClockStatus;
  readonly config: FixedSimulationClockConfig;
  readonly simulationTimeMs: number;
  readonly tickIndex: number;
  readonly accumulatorMs: number;
  readonly observedWallTimeMs: number;
}

export interface SimulationTick {
  readonly runId: string;
  readonly index: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly deltaMs: number;
}

export interface SimulationClockAdvance {
  readonly clock: FixedSimulationClockState;
  readonly ticks: readonly SimulationTick[];
  readonly acceptedWallElapsedMs: number;
  readonly ignoredWallElapsedMs: number;
  readonly droppedScaledTimeMs: number;
}

export interface SimulationScheduleInput {
  readonly id: string;
  readonly purpose: SimulationSchedulePurpose;
  readonly handlerId: string;
  readonly payload: RuntimeJsonObject;
  readonly firstDueTimeMs: number;
  readonly intervalMs: number | null;
  readonly occurrenceLimit: number | null;
  readonly priority: number;
}

export interface SimulationScheduleEntry {
  readonly id: string;
  readonly purpose: SimulationSchedulePurpose;
  readonly handlerId: string;
  readonly payload: RuntimeJsonObject;
  readonly nextDueTimeMs: number;
  readonly intervalMs: number | null;
  readonly occurrenceLimit: number | null;
  readonly occurrencesDispatched: number;
  readonly priority: number;
  readonly sequence: number;
  readonly status: SimulationScheduleStatus;
  readonly revision: number;
}

export interface SimulationScheduleState {
  readonly schemaVersion: typeof SIMULATION_SCHEMA_VERSION;
  readonly runId: string;
  readonly revision: number;
  readonly dispatchedThroughTimeMs: number;
  readonly nextSequence: number;
  readonly entries: readonly SimulationScheduleEntry[];
}

interface SimulationScheduleMutationBase {
  readonly id: string;
  readonly runId: string;
  readonly expectedRevision: number;
  readonly issuedAtSimulationTimeMs: number;
}

export type SimulationScheduleMutation = (
  | SimulationScheduleMutationBase & {
    readonly operation: "schedule.put";
    readonly schedule: SimulationScheduleInput;
  }
  | SimulationScheduleMutationBase & {
    readonly operation: "schedule.cancel";
    readonly scheduleId: string;
  }
  | SimulationScheduleMutationBase & {
    readonly operation: "schedule.delete";
    readonly scheduleId: string;
  }
);

export interface SimulationScheduledDispatch {
  readonly scheduleId: string;
  readonly purpose: SimulationSchedulePurpose;
  readonly handlerId: string;
  readonly payload: RuntimeJsonObject;
  readonly occurrence: number;
  readonly dueTimeMs: number;
}

export interface SimulationScheduleDispatchResult {
  readonly schedule: SimulationScheduleState;
  readonly dispatches: readonly SimulationScheduledDispatch[];
  readonly hasBacklog: boolean;
}
