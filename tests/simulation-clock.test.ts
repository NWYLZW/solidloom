import {
  InvalidSimulationScheduleError,
  InvalidSimulationTimeError,
  SimulationRevisionConflictError,
  applySimulationScheduleMutation,
  createFixedSimulationClock,
  createSimulationScheduleState,
  dispatchSimulationSchedules,
  recoverFixedSimulationClock,
  setFixedSimulationTimeScale,
  type FixedSimulationClockConfig,
  type FixedSimulationClockState,
  type SimulationScheduleInput,
  type SimulationScheduleMutation,
  type SimulationScheduleState,
} from "@solidloom/shared";
import { FixedSimulationRun } from "../apps/server/src/runs/fixed-simulation-run.js";
import { DeterministicSimulationScheduler } from "../apps/server/src/scheduler/deterministic-scheduler.js";
import { describe, expect, it } from "vitest";

const baseConfig: FixedSimulationClockConfig = {
  fixedStepMs: 100,
  timeScale: 1,
  maxCatchUpTicks: 20,
  recoveryPolicy: { mode: "freeze" },
};

function advanceAtFrames(frameTimes: readonly number[]) {
  const run = new FixedSimulationRun({ runId: "run-a", observedWallTimeMs: 0, config: baseConfig });
  const ticks = [];
  for (const frameTime of frameTimes) {
    const result = run.advance(frameTime, run.clock.revision);
    ticks.push(...result.ticks);
  }
  return { clock: run.clock, ticks };
}

function putSchedule(
  state: SimulationScheduleState,
  input: SimulationScheduleInput,
  mutationId = `put-${input.id}`,
) {
  return applySimulationScheduleMutation(state, {
    id: mutationId,
    runId: state.runId,
    expectedRevision: state.revision,
    issuedAtSimulationTimeMs: state.dispatchedThroughTimeMs,
    operation: "schedule.put",
    schedule: input,
  });
}

function scheduleInput(
  id: string,
  overrides: Partial<SimulationScheduleInput> = {},
): SimulationScheduleInput {
  return {
    id,
    purpose: "custom",
    handlerId: "sample.handler",
    payload: { value: id },
    firstDueTimeMs: 100,
    intervalMs: null,
    occurrenceLimit: null,
    priority: 0,
    ...overrides,
  };
}

describe("fixed simulation clock", () => {
  it("produces the same domain ticks for different client frame rates", () => {
    const highFrequencyFrames = Array.from({ length: 50 }, (_, index) => (index + 1) * 20);
    const lowFrequencyFrames = [250, 500, 750, 1_000];
    const highFrequency = advanceAtFrames(highFrequencyFrames);
    const lowFrequency = advanceAtFrames(lowFrequencyFrames);

    expect(highFrequency.clock.simulationTimeMs).toBe(1_000);
    expect(lowFrequency.clock.simulationTimeMs).toBe(1_000);
    expect(highFrequency.clock.tickIndex).toBe(10);
    expect(lowFrequency.clock.tickIndex).toBe(10);
    expect(highFrequency.ticks.map(({ index, endedAtMs }) => [index, endedAtMs])).toEqual(
      lowFrequency.ticks.map(({ index, endedAtMs }) => [index, endedAtMs]),
    );
  });

  it("normalizes fractional scale accumulation across frame partitions", () => {
    const config = { ...baseConfig, timeScale: 0.1 };
    const highFrequency = new FixedSimulationRun({ runId: "run-a", observedWallTimeMs: 0, config });
    for (let wallTimeMs = 1; wallTimeMs <= 1_000; wallTimeMs += 1) {
      highFrequency.advance(wallTimeMs, highFrequency.clock.revision);
    }
    const lowFrequency = new FixedSimulationRun({ runId: "run-a", observedWallTimeMs: 0, config });
    lowFrequency.advance(1_000, 0);
    expect(highFrequency.clock.simulationTimeMs).toBe(100);
    expect(highFrequency.clock.simulationTimeMs).toBe(lowFrequency.clock.simulationTimeMs);
    expect(highFrequency.clock.accumulatorMs).toBe(lowFrequency.clock.accumulatorMs);
  });

  it("applies time scale at an observed boundary and excludes paused wall time", () => {
    const run = new FixedSimulationRun({ runId: "run-a", observedWallTimeMs: 0, config: baseConfig });
    expect(run.advance(250, 0).ticks).toHaveLength(2);
    expect(run.setTimeScale(2, 300, run.clock.revision).ticks).toHaveLength(1);
    expect(run.advance(400, run.clock.revision).ticks).toHaveLength(2);
    const paused = run.pause(450, run.clock.revision);
    expect(paused.ticks).toHaveLength(1);
    expect(run.clock.status).toBe("paused");
    expect(run.advance(10_000, run.clock.revision).ticks).toEqual([]);
    expect(run.clock.simulationTimeMs).toBe(600);

    run.resume(10_000, run.clock.revision);
    expect(run.advance(10_050, run.clock.revision).ticks).toHaveLength(1);
    expect(run.clock.simulationTimeMs).toBe(700);
  });

  it("supports frozen and bounded offline recovery with a catch-up ceiling", () => {
    const frozen = createFixedSimulationClock({
      runId: "run-freeze",
      observedWallTimeMs: 0,
      config: baseConfig,
    });
    const frozenRecovery = recoverFixedSimulationClock(frozen, 10_000, 0);
    expect(frozenRecovery.ticks).toEqual([]);
    expect(frozenRecovery.ignoredWallElapsedMs).toBe(10_000);
    expect(frozenRecovery.clock.observedWallTimeMs).toBe(10_000);

    const catchUp = createFixedSimulationClock({
      runId: "run-catch-up",
      observedWallTimeMs: 0,
      config: {
        ...baseConfig,
        maxCatchUpTicks: 3,
        recoveryPolicy: { mode: "catch-up", maxElapsedMs: 500 },
      },
    });
    const catchUpRecovery = recoverFixedSimulationClock(catchUp, 10_000, 0);
    expect(catchUpRecovery.ticks).toHaveLength(3);
    expect(catchUpRecovery.acceptedWallElapsedMs).toBe(500);
    expect(catchUpRecovery.ignoredWallElapsedMs).toBe(9_500);
    expect(catchUpRecovery.droppedScaledTimeMs).toBe(200);
    expect(catchUpRecovery.clock.simulationTimeMs).toBe(300);
  });

  it("rejects stale revisions, backwards time and unsafe scale values", () => {
    const clock = createFixedSimulationClock({ runId: "run-a", observedWallTimeMs: 100, config: baseConfig });
    expect(() => setFixedSimulationTimeScale(clock, 2, 100, 1)).toThrow(SimulationRevisionConflictError);
    expect(() => setFixedSimulationTimeScale(clock, 2, 99, 0)).toThrow(InvalidSimulationTimeError);
    expect(() => setFixedSimulationTimeScale(clock, 100, 100, 0)).toThrow(InvalidSimulationTimeError);
  });
});

describe("deterministic simulation scheduler", () => {
  it("orders one-time and recurring dispatches by time, priority, sequence and stable ID", () => {
    let state = createSimulationScheduleState("run-a");
    state = putSchedule(state, scheduleInput("first"));
    state = putSchedule(state, scheduleInput("priority", { priority: 10 }));
    state = putSchedule(state, scheduleInput("recurring", {
      firstDueTimeMs: 50,
      intervalMs: 50,
      occurrenceLimit: 3,
    }));

    const result = dispatchSimulationSchedules(state, 150, state.revision);
    expect(result.dispatches.map(({ scheduleId, occurrence, dueTimeMs }) => (
      `${scheduleId}:${occurrence}@${dueTimeMs}`
    ))).toEqual([
      "recurring:1@50",
      "priority:1@100",
      "first:1@100",
      "recurring:2@100",
      "recurring:3@150",
    ]);
    expect(result.schedule.entries.every(({ status }) => status === "completed")).toBe(true);
  });

  it("replays to byte-equivalent state and dispatch order", () => {
    const build = () => {
      let state = createSimulationScheduleState("run-replay");
      state = putSchedule(state, scheduleInput("b", { firstDueTimeMs: 20 }), "mutation-1");
      state = putSchedule(state, scheduleInput("a", { firstDueTimeMs: 20 }), "mutation-2");
      return dispatchSimulationSchedules(state, 20, state.revision);
    };
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("bounds dispatch work while preserving due backlog for the next call", () => {
    let state = createSimulationScheduleState("run-a");
    state = putSchedule(state, scheduleInput("pulse", {
      firstDueTimeMs: 0,
      intervalMs: 1,
      occurrenceLimit: null,
    }));
    const first = dispatchSimulationSchedules(state, 10, state.revision, 3);
    expect(first.dispatches.map(({ dueTimeMs }) => dueTimeMs)).toEqual([0, 1, 2]);
    expect(first.hasBacklog).toBe(true);
    const second = dispatchSimulationSchedules(first.schedule, 10, first.schedule.revision, 3);
    expect(second.dispatches.map(({ dueTimeMs }) => dueTimeMs)).toEqual([3, 4, 5]);
  });

  it("supports generic state updates, timeouts and process schedules without domain fields", () => {
    let state = createSimulationScheduleState("run-a");
    const purposes = ["state-update", "timeout", "process"] as const;
    purposes.forEach((purpose, index) => {
      state = putSchedule(state, scheduleInput(`task-${index}`, {
        purpose,
        handlerId: `sample.${purpose}`,
        payload: { referenceId: `ref-${index}` },
        firstDueTimeMs: 10,
      }));
    });
    const result = dispatchSimulationSchedules(state, 10, state.revision);
    expect(result.dispatches.map(({ purpose }) => purpose).sort()).toEqual([...purposes].sort());
  });

  it("requires revisioned mutations and can cancel pending work", () => {
    const scheduler = new DeterministicSimulationScheduler("run-a");
    const input = scheduleInput("pending");
    const put: SimulationScheduleMutation = {
      id: "mutation-put",
      runId: "run-a",
      expectedRevision: 0,
      issuedAtSimulationTimeMs: 0,
      operation: "schedule.put",
      schedule: input,
    };
    scheduler.apply(put);
    expect(() => scheduler.apply(put)).toThrow(SimulationRevisionConflictError);
    scheduler.apply({
      id: "mutation-cancel",
      runId: "run-a",
      expectedRevision: scheduler.schedule.revision,
      issuedAtSimulationTimeMs: 0,
      operation: "schedule.cancel",
      scheduleId: "pending",
    });
    expect(scheduler.dispatch(1_000, scheduler.schedule.revision).dispatches).toEqual([]);
  });

  it("rejects invalid recurrence and scheduler time travel", () => {
    expect(() => putSchedule(
      createSimulationScheduleState("run-a"),
      scheduleInput("invalid", { intervalMs: null, occurrenceLimit: 2 }),
    )).toThrow(InvalidSimulationScheduleError);
    expect(() => dispatchSimulationSchedules(
      createSimulationScheduleState("run-a", 100),
      99,
      0,
    )).toThrow(InvalidSimulationTimeError);
  });

  it("copies JSON payloads and rejects circular data", () => {
    const payload = { nested: { value: 1 } };
    let state = putSchedule(createSimulationScheduleState("run-a"), scheduleInput("copy", { payload }));
    payload.nested.value = 2;
    const result = dispatchSimulationSchedules(state, 100, state.revision);
    expect(result.dispatches[0]?.payload).toEqual({ nested: { value: 1 } });

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => {
      state = putSchedule(state, scheduleInput("circular", { payload: circular as never }));
    }).toThrow(InvalidSimulationScheduleError);
  });
});
