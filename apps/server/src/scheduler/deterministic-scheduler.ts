import {
  applySimulationScheduleMutation,
  createSimulationScheduleState,
  dispatchSimulationSchedules,
  type SimulationScheduleDispatchResult,
  type SimulationScheduleMutation,
  type SimulationScheduleState,
} from "@solidloom/shared";

export class DeterministicSimulationScheduler {
  #schedule: SimulationScheduleState;

  constructor(runIdOrState: string | SimulationScheduleState, initialSimulationTimeMs = 0) {
    this.#schedule = typeof runIdOrState === "string"
      ? createSimulationScheduleState(runIdOrState, initialSimulationTimeMs)
      : runIdOrState;
  }

  get schedule(): SimulationScheduleState {
    return this.#schedule;
  }

  apply(mutation: SimulationScheduleMutation): SimulationScheduleState {
    this.#schedule = applySimulationScheduleMutation(this.#schedule, mutation);
    return this.#schedule;
  }

  dispatch(
    throughTimeMs: number,
    expectedRevision: number,
    maxDispatches?: number,
  ): SimulationScheduleDispatchResult {
    const result = dispatchSimulationSchedules(
      this.#schedule,
      throughTimeMs,
      expectedRevision,
      maxDispatches,
    );
    this.#schedule = result.schedule;
    return result;
  }
}
