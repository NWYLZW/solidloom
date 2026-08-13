import {
  DEFAULT_RULE_EXECUTION_LIMITS,
  DeclarativeRuntimeIdempotencyConflictError,
  DeclarativeRuntimeOperationError,
  DeclarativeRuntimeRevisionConflictError,
  RuleContractValidationError,
  RuleExecutionBudgetExceededError,
  evaluateRuleExpression,
  validateDeclarativeProcessDefinitions,
  validateDeclarativeRuleDefinitions,
  type DeclarativeEffectTemplate,
  type DeclarativeProcessDefinition,
  type DeclarativeRuleDefinition,
  type ProcessCommandRequest,
  type ProcessRuntimeContext,
  type ProcessStartRequest,
  type ResolvedDeclarativeEffect,
  type RuleDispatchContext,
  type RuleDispatchTrigger,
  type RuleExpression,
  type RuleExpressionRoot,
  type RuleFieldCatalog,
  type RuntimeJsonObject,
  type RuntimeJsonValue,
} from "@solidloom/shared";
import {
  DeclarativeRuleRuntime,
  type DeclarativeEffectCommitAdapter,
} from "../apps/server/src/rules/declarative-rule-runtime.js";
import { DeclarativeProcessRuntime } from "../apps/server/src/processes/declarative-process-runtime.js";
import { describe, expect, it, vi } from "vitest";

const literal = (value: RuntimeJsonValue): RuleExpression => ({ kind: "literal", value });
const field = (root: RuleExpressionRoot, path: string): RuleExpression => ({
  kind: "path",
  root,
  path: path.split("."),
});

const fieldCatalog: RuleFieldCatalog = Object.freeze({
  event: Object.freeze([
    "id",
    "kind",
    "typeId",
    "scheduleId",
    "simulationTimeMs",
    "payload",
    "payload.amount",
    "payload.entityId",
    "payload.nextType",
    "payload.score",
  ]),
  state: Object.freeze(["approved", "enabled"]),
  process: Object.freeze(["id", "definitionId", "status", "currentStageId", "elapsedMs"]),
  variables: Object.freeze(["rate", "scopeId"]),
});

const dispatchContext: RuleDispatchContext = Object.freeze({
  state: Object.freeze({ enabled: true }),
  process: Object.freeze({}),
  variables: Object.freeze({ rate: 2, scopeId: "scope-main" }),
});

function effect(
  id: string,
  kind: DeclarativeEffectTemplate["kind"],
  arguments_: Readonly<Record<string, RuleExpression>>,
): DeclarativeEffectTemplate {
  return { id, kind, arguments: arguments_ };
}

function rule(
  id: string,
  trigger: DeclarativeRuleDefinition["trigger"],
  effects: readonly DeclarativeEffectTemplate[],
  overrides: Partial<DeclarativeRuleDefinition> = {},
): DeclarativeRuleDefinition {
  return {
    id,
    domainPackageId: "sample-domain",
    displayName: id,
    description: "声明式测试规则。",
    revision: 1,
    status: "available",
    priority: 0,
    trigger,
    condition: null,
    effects,
    maxFiringsPerDispatch: 8,
    ...overrides,
  };
}

function eventTrigger(id: string, typeId: string, payload: RuntimeJsonObject = {}): RuleDispatchTrigger {
  return {
    kind: "event",
    id,
    idempotencyKey: `key-${id}`,
    runId: "run-rules",
    typeId,
    simulationTimeMs: 10,
    payload,
  };
}

function recordingAdapter() {
  const batches: ResolvedDeclarativeEffect[][] = [];
  const adapter: DeclarativeEffectCommitAdapter = {
    commitAtomic: vi.fn(({ effects }) => {
      batches.push([...effects]);
    }),
  };
  return { adapter, batches };
}

function metricEffect(id: string, metricTypeId: string, delta: RuleExpression): DeclarativeEffectTemplate {
  return effect(id, "metric.increment", {
    metricTypeId: literal(metricTypeId),
    scopeId: field("variables", "scopeId"),
    delta,
  });
}

describe("declarative rule expressions and runtime", () => {
  it("evaluates only the bounded AST and rejects undeclared or prototype fields", () => {
    const expression: RuleExpression = {
      kind: "all",
      operands: [
        { kind: "compare", operator: "gte", left: field("event", "payload.amount"), right: literal(3) },
        { kind: "not", operand: { kind: "compare", operator: "eq", left: field("state", "enabled"), right: literal(false) } },
      ],
    };
    expect(evaluateRuleExpression(expression, {
      event: { payload: { amount: 4 } },
      state: { enabled: true },
      process: {},
      variables: {},
    }, 32)).toBe(true);

    const unsafeRule = rule("sample.unsafe", { kind: "event", typeId: "sample.trigger" }, [
      metricEffect("metric", "sample.metric", field("event", "payload.secret")),
    ]);
    expect(() => validateDeclarativeRuleDefinitions([unsafeRule], fieldCatalog)).toThrowError(
      expect.objectContaining<Partial<RuleContractValidationError>>({
        issues: expect.arrayContaining([expect.objectContaining({ code: "unsafe-field" })]),
      }),
    );

    const prototypeRule = rule("sample.prototype", { kind: "event", typeId: "sample.trigger" }, [
      metricEffect("metric", "sample.metric", { kind: "path", root: "event", path: ["__proto__"] }),
    ]);
    expect(() => validateDeclarativeRuleDefinitions([prototypeRule], fieldCatalog)).toThrow(RuleContractValidationError);

    const unsafeWrite = rule("sample.unsafe-write", { kind: "event", typeId: "sample.trigger" }, [
      effect("write", "component.set", {
        entityId: literal("entity-a"),
        componentTypeId: literal("sample.component"),
        fieldPath: literal("__proto__.value"),
        value: literal(1),
      }),
    ]);
    expect(() => validateDeclarativeRuleDefinitions([unsafeWrite], fieldCatalog)).toThrowError(
      expect.objectContaining<Partial<RuleContractValidationError>>({
        issues: expect.arrayContaining([expect.objectContaining({ code: "unsafe-field" })]),
      }),
    );
  });

  it("supports factory, family, sect and country definitions without adding domain fields to the platform", () => {
    const examples: readonly {
      readonly definition: DeclarativeRuleDefinition;
      readonly trigger: RuleDispatchTrigger;
      readonly expectedKind: DeclarativeEffectTemplate["kind"];
    }[] = [
      {
        definition: rule("factory.record-output", { kind: "event", typeId: "factory.shift-finished" }, [
          metricEffect("output", "factory.output", field("event", "payload.amount")),
        ], {
          condition: { kind: "compare", operator: "gt", left: field("event", "payload.amount"), right: literal(0) },
        }),
        trigger: eventTrigger("factory-event", "factory.shift-finished", { amount: 12 }),
        expectedKind: "metric.increment",
      },
      {
        definition: rule("family.raise-standing", { kind: "event", typeId: "family.milestone-reached" }, [
          effect("standing", "component.increment", {
            entityId: field("event", "payload.entityId"),
            componentTypeId: literal("family.standing"),
            fieldPath: literal("value"),
            delta: field("event", "payload.score"),
          }),
        ]),
        trigger: eventTrigger("family-event", "family.milestone-reached", { entityId: "member-a", score: 3 }),
        expectedKind: "component.increment",
      },
      {
        definition: rule("sect.cultivation-cycle", { kind: "schedule", scheduleId: "sect.cultivation-tick" }, [
          metricEffect("progress", "sect.progress", field("variables", "rate")),
        ]),
        trigger: {
          kind: "schedule",
          id: "sect-tick",
          idempotencyKey: "key-sect-tick",
          runId: "run-rules",
          scheduleId: "sect.cultivation-tick",
          simulationTimeMs: 10,
          payload: {},
        },
        expectedKind: "metric.increment",
      },
      {
        definition: rule("country.create-program", { kind: "event", typeId: "country.policy-approved" }, [
          effect("program", "entity.create", {
            entityTypeId: literal("country.program"),
            entityId: field("event", "payload.entityId"),
            components: literal({}),
          }),
        ]),
        trigger: eventTrigger("country-event", "country.policy-approved", { entityId: "program-a" }),
        expectedKind: "entity.create",
      },
    ];

    examples.forEach(({ definition, trigger, expectedKind }) => {
      const recorder = recordingAdapter();
      const runtime = new DeclarativeRuleRuntime({
        runId: "run-rules",
        definitions: [definition],
        fieldCatalog,
        effectAdapter: recorder.adapter,
      });
      const result = runtime.dispatch(trigger, 0, dispatchContext);
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0]?.kind).toBe(expectedKind);
      expect(result.audit).toEqual([expect.objectContaining({ outcome: "fired" })]);
      expect(recorder.adapter.commitAtomic).toHaveBeenCalledTimes(1);
    });
  });

  it("plans cascaded emitted events and commits the complete effect list once", () => {
    const first = rule("sample.first", { kind: "event", typeId: "sample.started" }, [
      effect("next", "event.emit", { typeId: literal("sample.followed"), payload: literal({ amount: 5 }) }),
    ]);
    const second = rule("sample.second", { kind: "event", typeId: "sample.followed" }, [
      metricEffect("record", "sample.total", field("event", "payload.amount")),
    ]);
    const recorder = recordingAdapter();
    const runtime = new DeclarativeRuleRuntime({
      runId: "run-rules",
      definitions: [second, first],
      fieldCatalog,
      effectAdapter: recorder.adapter,
    });
    const result = runtime.dispatch(eventTrigger("cascade", "sample.started"), 0, dispatchContext);
    expect(result.effects.map(({ kind }) => kind)).toEqual(["event.emit", "metric.increment"]);
    expect(result.audit.map(({ ruleDefinitionId }) => ruleDefinitionId)).toEqual(["sample.first", "sample.second"]);
    expect(recorder.batches).toHaveLength(1);
    expect(recorder.batches[0]).toHaveLength(2);
  });

  it("rejects static event cycles and stops dynamic cycles before committing effects", () => {
    const first = rule("loop.first", { kind: "event", typeId: "loop.a" }, [
      effect("emit-b", "event.emit", { typeId: literal("loop.b"), payload: literal({}) }),
    ]);
    const second = rule("loop.second", { kind: "event", typeId: "loop.b" }, [
      effect("emit-a", "event.emit", { typeId: literal("loop.a"), payload: literal({}) }),
    ]);
    expect(() => validateDeclarativeRuleDefinitions([first, second], fieldCatalog)).toThrowError(
      expect.objectContaining<Partial<RuleContractValidationError>>({
        issues: expect.arrayContaining([expect.objectContaining({ code: "cycle" })]),
      }),
    );

    const dynamic = rule("loop.dynamic", { kind: "event", typeId: "loop.dynamic-event" }, [
      effect("emit", "event.emit", {
        typeId: field("event", "payload.nextType"),
        payload: field("event", "payload"),
      }),
    ], { maxFiringsPerDispatch: 3 });
    const recorder = recordingAdapter();
    const runtime = new DeclarativeRuleRuntime({
      runId: "run-rules",
      definitions: [dynamic],
      fieldCatalog,
      effectAdapter: recorder.adapter,
      limits: { ...DEFAULT_RULE_EXECUTION_LIMITS, maxCascadeDepth: 2, maxRuleFirings: 3 },
    });
    expect(() => runtime.dispatch(eventTrigger("dynamic", "loop.dynamic-event", {
      nextType: "loop.dynamic-event",
    }), 0, dispatchContext)).toThrow(RuleExecutionBudgetExceededError);
    expect(recorder.adapter.commitAtomic).not.toHaveBeenCalled();
    expect(runtime.state.revision).toBe(0);
  });

  it("uses revision control and idempotency before executing an atomic batch", () => {
    const recorder = recordingAdapter();
    const runtime = new DeclarativeRuleRuntime({
      runId: "run-rules",
      definitions: [rule("sample.once", { kind: "event", typeId: "sample.trigger" }, [
        metricEffect("metric", "sample.metric", literal(1)),
      ])],
      fieldCatalog,
      effectAdapter: recorder.adapter,
    });
    const original = eventTrigger("once", "sample.trigger");
    expect(runtime.dispatch(original, 0, dispatchContext).replayed).toBe(false);
    expect(runtime.dispatch(original, 0, dispatchContext).replayed).toBe(true);
    expect(recorder.adapter.commitAtomic).toHaveBeenCalledTimes(1);
    expect(() => runtime.dispatch({ ...original, typeId: "sample.changed" }, 0, dispatchContext))
      .toThrow(DeclarativeRuntimeIdempotencyConflictError);
    expect(() => runtime.dispatch(eventTrigger("stale", "sample.trigger"), 0, dispatchContext))
      .toThrow(DeclarativeRuntimeRevisionConflictError);
  });

  it("keeps planned rules unavailable and requires an adapter for available effects", () => {
    const planned = rule("sample.planned", { kind: "event", typeId: "sample.trigger" }, [
      metricEffect("metric", "sample.metric", literal(1)),
    ], { status: "planned" });
    const plannedRuntime = new DeclarativeRuleRuntime({ runId: "run-rules", definitions: [planned], fieldCatalog });
    const skipped = plannedRuntime.dispatch(eventTrigger("planned", "sample.trigger"), 0, dispatchContext);
    expect(skipped.effects).toEqual([]);
    expect(skipped.audit[0]?.outcome).toBe("planned-skipped");

    const availableRuntime = new DeclarativeRuleRuntime({
      runId: "run-rules",
      definitions: [{ ...planned, id: "sample.available", status: "available" }],
      fieldCatalog,
    });
    expect(() => availableRuntime.dispatch(eventTrigger("available", "sample.trigger"), 0, dispatchContext))
      .toThrowError(expect.objectContaining({ code: "effect-adapter-required" }));
    expect(availableRuntime.state.revision).toBe(0);
  });

  it("does not publish runtime state when the atomic effect adapter fails", () => {
    const adapter: DeclarativeEffectCommitAdapter = {
      commitAtomic: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
    };
    const runtime = new DeclarativeRuleRuntime({
      runId: "run-rules",
      definitions: [rule("sample.atomic", { kind: "event", typeId: "sample.trigger" }, [
        metricEffect("metric", "sample.metric", literal(1)),
      ])],
      fieldCatalog,
      effectAdapter: adapter,
    });
    expect(() => runtime.dispatch(eventTrigger("atomic", "sample.trigger"), 0, dispatchContext))
      .toThrow("storage unavailable");
    expect(runtime.state).toMatchObject({ revision: 0, audit: [], dispatches: [] });
  });
});

function processDefinition(overrides: Partial<DeclarativeProcessDefinition> = {}): DeclarativeProcessDefinition {
  return {
    id: "sample.process",
    domainPackageId: "sample-domain",
    displayName: "示例流程",
    description: "通用长流程测试定义。",
    revision: 1,
    status: "available",
    participantSlots: [{ id: "actor", required: true, entityTypeIds: ["sample.actor"] }],
    initialStageId: "queued",
    stages: [
      {
        id: "queued",
        kind: "active",
        enterCondition: null,
        exitCondition: null,
        timeoutMs: 100,
        enterEffects: [],
        exitEffects: [],
        timeoutEffects: [],
        compensationEffects: [metricEffect("undo-queued", "sample.reserved", literal(-1))],
      },
      {
        id: "working",
        kind: "active",
        enterCondition: null,
        exitCondition: field("state", "approved"),
        timeoutMs: null,
        enterEffects: [metricEffect("started", "sample.started", literal(1))],
        exitEffects: [],
        timeoutEffects: [],
        compensationEffects: [metricEffect("undo-working", "sample.started", literal(-1))],
      },
      {
        id: "done",
        kind: "completed",
        enterCondition: null,
        exitCondition: null,
        timeoutMs: null,
        enterEffects: [metricEffect("completed", "sample.completed", literal(1))],
        exitEffects: [],
        timeoutEffects: [],
        compensationEffects: [],
      },
      {
        id: "failed",
        kind: "failed",
        enterCondition: null,
        exitCondition: null,
        timeoutMs: null,
        enterEffects: [],
        exitEffects: [],
        timeoutEffects: [],
        compensationEffects: [],
      },
    ],
    transitions: [
      { id: "begin", fromStageId: "queued", toStageId: "working", trigger: "manual", priority: 0, condition: null, effects: [] },
      { id: "finish", fromStageId: "working", toStageId: "done", trigger: "condition", priority: 0, condition: field("state", "approved"), effects: [] },
      { id: "queue-timeout", fromStageId: "queued", toStageId: "failed", trigger: "timeout", priority: 0, condition: null, effects: [] },
    ],
    maxTransitionsPerAdvance: 8,
    ...overrides,
  };
}

const processContextValue = (approved: boolean): ProcessRuntimeContext => ({ event: {}, state: { approved } });

function startRequest(overrides: Partial<ProcessStartRequest> = {}): ProcessStartRequest {
  return {
    processId: "process-a",
    runId: "run-processes",
    definitionId: "sample.process",
    participants: [{ slotId: "actor", entityId: "actor-a", entityTypeId: "sample.actor" }],
    variables: { scopeId: "scope-main", rate: 1 },
    idempotencyKey: "start-process-a",
    expectedRevision: 0,
    requestedAtSimulationTimeMs: 0,
    ...overrides,
  };
}

function command(
  kind: ProcessCommandRequest["kind"],
  runtime: DeclarativeProcessRuntime,
  overrides: Partial<ProcessCommandRequest> = {},
): ProcessCommandRequest {
  return {
    commandId: `${kind}-${runtime.state.revision}`,
    kind,
    processId: "process-a",
    runId: "run-processes",
    idempotencyKey: `${kind}-key-${runtime.state.revision}`,
    expectedRevision: runtime.state.revision,
    requestedAtSimulationTimeMs: runtime.state.simulationTimeMs,
    reason: `${kind}-requested`,
    transitionId: kind === "transition" ? "begin" : null,
    ...overrides,
  };
}

describe("declarative long-process runtime", () => {
  it("starts, manually transitions, conditionally completes and records every stage", () => {
    const recorder = recordingAdapter();
    const runtime = new DeclarativeProcessRuntime({
      runId: "run-processes",
      definitions: [processDefinition()],
      fieldCatalog,
      effectAdapter: recorder.adapter,
    });
    expect(runtime.start(startRequest(), processContextValue(false)).process.status).toBe("running");
    const transitioned = runtime.command(command("transition", runtime), processContextValue(false));
    expect(transitioned.process.currentStageId).toBe("working");
    expect(transitioned.effects.map(({ kind }) => kind)).toEqual(["metric.increment"]);

    const completed = runtime.advance(10, runtime.state.revision, processContextValue(true));
    expect(completed.state.processes[0]).toMatchObject({ status: "completed", currentStageId: "done" });
    expect(completed.state.processes[0]?.stageVisits.map(({ stageId }) => stageId)).toEqual(["queued", "working", "done"]);
    expect(runtime.state.audit.map(({ type }) => type)).toEqual([
      "process-started",
      "stage-entered",
      "stage-exited",
      "stage-entered",
      "stage-exited",
      "stage-entered",
      "process-completed",
    ]);
  });

  it("does not consume timeout while paused and fails at the shifted deterministic deadline", () => {
    const recorder = recordingAdapter();
    const runtime = new DeclarativeProcessRuntime({
      runId: "run-processes",
      definitions: [processDefinition()],
      fieldCatalog,
      effectAdapter: recorder.adapter,
    });
    runtime.start(startRequest(), processContextValue(false));
    runtime.advance(40, runtime.state.revision, processContextValue(false));
    runtime.command(command("pause", runtime), processContextValue(false));
    runtime.advance(500, runtime.state.revision, processContextValue(false));
    expect(runtime.state.processes[0]?.status).toBe("paused");
    runtime.command(command("resume", runtime), processContextValue(false));
    runtime.advance(559, runtime.state.revision, processContextValue(false));
    expect(runtime.state.processes[0]?.status).toBe("running");
    runtime.advance(560, runtime.state.revision, processContextValue(false));
    expect(runtime.state.processes[0]).toMatchObject({
      status: "failed",
      currentStageId: "failed",
      endedAtSimulationTimeMs: 560,
    });
    expect(runtime.state.audit.map(({ type }) => type)).toContain("process-paused");
    expect(runtime.state.audit.map(({ type }) => type)).toContain("process-resumed");
  });

  it("compensates visited active stages in reverse order on explicit failure", () => {
    const recorder = recordingAdapter();
    const runtime = new DeclarativeProcessRuntime({
      runId: "run-processes",
      definitions: [processDefinition()],
      fieldCatalog,
      effectAdapter: recorder.adapter,
    });
    runtime.start(startRequest(), processContextValue(false));
    runtime.command(command("transition", runtime), processContextValue(false));
    const failed = runtime.command(command("fail", runtime), processContextValue(false));
    expect(failed.process.status).toBe("failed");
    expect(failed.effects.map(({ arguments: arguments_ }) => arguments_.delta)).toEqual([-1, -1]);
    expect(failed.effects.map(({ sourceTriggerId }) => sourceTriggerId)).toEqual([
      expect.stringContaining("compensate:1"),
      expect.stringContaining("compensate:0"),
    ]);
    expect(failed.audit.filter(({ type }) => type === "stage-compensated").map(({ stageId }) => stageId))
      .toEqual(["working", "queued"]);
  });

  it("makes process commands idempotent and revision controlled", () => {
    const recorder = recordingAdapter();
    const runtime = new DeclarativeProcessRuntime({
      runId: "run-processes",
      definitions: [processDefinition()],
      fieldCatalog,
      effectAdapter: recorder.adapter,
    });
    const started = runtime.start(startRequest(), processContextValue(false));
    expect(started.replayed).toBe(false);
    expect(runtime.start(startRequest(), processContextValue(false)).replayed).toBe(true);
    const transition = command("transition", runtime);
    runtime.command(transition, processContextValue(false));
    const batchCount = recorder.batches.length;
    expect(runtime.command(transition, processContextValue(false)).replayed).toBe(true);
    expect(recorder.batches).toHaveLength(batchCount);
    expect(() => runtime.command(command("pause", runtime, { expectedRevision: 0 }), processContextValue(false)))
      .toThrow(DeclarativeRuntimeRevisionConflictError);
  });

  it("rejects unconditional process loops, invalid participants and planned definitions", () => {
    const looping = processDefinition({
      transitions: [
        { id: "loop-a", fromStageId: "queued", toStageId: "working", trigger: "condition", priority: 0, condition: literal(true), effects: [] },
        { id: "loop-b", fromStageId: "working", toStageId: "queued", trigger: "condition", priority: 0, condition: literal(true), effects: [] },
      ],
    });
    expect(() => validateDeclarativeProcessDefinitions([looping], fieldCatalog)).toThrowError(
      expect.objectContaining<Partial<RuleContractValidationError>>({
        issues: expect.arrayContaining([expect.objectContaining({ code: "cycle" })]),
      }),
    );

    const runtime = new DeclarativeProcessRuntime({
      runId: "run-processes",
      definitions: [processDefinition()],
      fieldCatalog,
      effectAdapter: recordingAdapter().adapter,
    });
    expect(() => runtime.start(startRequest({
      participants: [{ slotId: "actor", entityId: "bad", entityTypeId: "sample.wrong" }],
    }), processContextValue(false))).toThrowError(expect.objectContaining({ code: "participant-type" }));

    const plannedRuntime = new DeclarativeProcessRuntime({
      runId: "run-processes",
      definitions: [processDefinition({ status: "planned" })],
      fieldCatalog,
    });
    expect(() => plannedRuntime.start(startRequest(), processContextValue(false)))
      .toThrowError(expect.objectContaining<Partial<DeclarativeRuntimeOperationError>>({ code: "process-definition-planned" }));
  });
});
