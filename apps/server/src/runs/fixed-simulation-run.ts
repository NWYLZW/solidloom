import {
  advanceFixedSimulationClock,
  createFixedSimulationClock,
  pauseFixedSimulationClock,
  recoverFixedSimulationClock,
  resumeFixedSimulationClock,
  setFixedSimulationTimeScale,
  setSimulationRecoveryPolicy,
  type FixedSimulationClockConfig,
  type FixedSimulationClockState,
  type SimulationClockAdvance,
  type SimulationRecoveryPolicy,
} from "@solidloom/shared";

export class FixedSimulationRun {
  #clock: FixedSimulationClockState;

  constructor(input: {
    readonly runId: string;
    readonly observedWallTimeMs: number;
    readonly config: FixedSimulationClockConfig;
  } | FixedSimulationClockState) {
    this.#clock = "schemaVersion" in input ? input : createFixedSimulationClock(input);
  }

  get clock(): FixedSimulationClockState {
    return this.#clock;
  }

  advance(observedWallTimeMs: number, expectedRevision: number): SimulationClockAdvance {
    const result = advanceFixedSimulationClock(this.#clock, observedWallTimeMs, expectedRevision);
    this.#clock = result.clock;
    return result;
  }

  pause(observedWallTimeMs: number, expectedRevision: number): SimulationClockAdvance {
    const result = pauseFixedSimulationClock(this.#clock, observedWallTimeMs, expectedRevision);
    this.#clock = result.clock;
    return result;
  }

  resume(observedWallTimeMs: number, expectedRevision: number): FixedSimulationClockState {
    this.#clock = resumeFixedSimulationClock(this.#clock, observedWallTimeMs, expectedRevision);
    return this.#clock;
  }

  recover(observedWallTimeMs: number, expectedRevision: number): SimulationClockAdvance {
    const result = recoverFixedSimulationClock(this.#clock, observedWallTimeMs, expectedRevision);
    this.#clock = result.clock;
    return result;
  }

  setTimeScale(
    timeScale: number,
    observedWallTimeMs: number,
    expectedRevision: number,
  ): SimulationClockAdvance {
    const result = setFixedSimulationTimeScale(this.#clock, timeScale, observedWallTimeMs, expectedRevision);
    this.#clock = result.clock;
    return result;
  }

  setRecoveryPolicy(
    recoveryPolicy: SimulationRecoveryPolicy,
    expectedRevision: number,
  ): FixedSimulationClockState {
    this.#clock = setSimulationRecoveryPolicy(this.#clock, recoveryPolicy, expectedRevision);
    return this.#clock;
  }
}
