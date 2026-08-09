import {
  ACTION_RUNTIME_SCHEMA_VERSION,
  InvalidSemanticActionError,
  SemanticActionIdempotencyConflictError,
  SemanticActionRevisionConflictError,
  getSemanticActionProgress,
  type SemanticActionDefinition,
  type SemanticActionRequest,
} from "@solidloom/shared";
import {
  SemanticActionRuntime,
  type SemanticActionEffectAdapter,
  type SemanticActionPolicyEvaluator,
} from "../apps/server/src/actions/semantic-action-runtime.js";
import { FixedSimulationRun } from "../apps/server/src/runs/fixed-simulation-run.js";
import { describe, expect, it, vi } from "vitest";

function definition(
  id: string,
  overrides: Partial<SemanticActionDefinition> = {},
): SemanticActionDefinition {
  return {
    id,
    domainPackageId: "sample-package",
    displayName: id,
    description: "通用语义动作定义。",
    revision: 1,
    status: "available",
    parametersSchema: { type: "object" },
    subject: { required: true, entityTypeIds: ["sample.actor"] },
    target: { required: false, scopeKinds: ["entity", "run"], entityTypeIds: [] },
    preconditions: [],
    requiredCapabilities: [],
    channels: [{ id: "sample.activity", scope: "subject" }],
    durationMs: 1_000,
    timeoutMs: null,
    commitPoint: { mode: "at-progress", progress: 0.5 },
    commitEffectId: "sample.commit",
    cancellation: { beforeCommit: "allow", afterCommit: { mode: "reject" } },
    ...overrides,
  };
}

function request(
  actionId: string,
  overrides: Partial<SemanticActionRequest> = {},
): SemanticActionRequest {
  return {
    actionId,
    runId: "run-actions",
    definitionId: "sample.action",
    subject: { id: "entity-a", typeId: "sample.actor" },
    target: null,
    parameters: { value: 1 },
    idempotencyKey: `key-${actionId}`,
    expectedRevision: 0,
    proposedAtSimulationTimeMs: 0,
    ...overrides,
  };
}

function effectAdapter() {
  const commits: string[] = [];
  const compensations: string[] = [];
  const adapter: SemanticActionEffectAdapter = {
    commit: ({ action, effectId }) => {
      commits.push(action.id);
      return { events: [{ type: "sample.effect-committed", payload: { actionId: action.id, effectId } }] };
    },
    compensate: ({ action, effectId }) => {
      compensations.push(action.id);
      return { events: [{ type: "sample.effect-compensated", payload: { actionId: action.id, effectId } }] };
    },
  };
  return { adapter, commits, compensations };
}

describe("semantic action runtime", () => {
  it("uses one caller-neutral request for validation, progress, commit and completion", () => {
    const effects = effectAdapter();
    const actionDefinition = definition("sample.action");
    const runtime = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [actionDefinition],
      effectAdapter: effects.adapter,
    });
    const serializedRequest = JSON.parse(JSON.stringify(request("action-a"))) as SemanticActionRequest;
    const submitted = runtime.submit(serializedRequest);
    expect(submitted.state.schemaVersion).toBe(ACTION_RUNTIME_SCHEMA_VERSION);
    expect(submitted.action.status).toBe("running");
    expect(submitted.events.filter(({ kind }) => kind === "lifecycle").map(({ type }) => type)).toEqual([
      "action.proposed",
      "action.validated",
      "action.running",
    ]);
    expect(effects.commits).toEqual([]);

    runtime.advance(400, runtime.state.revision);
    expect(getSemanticActionProgress(runtime.state.actions[0]!, actionDefinition, runtime.state.simulationTimeMs)).toBe(0.4);
    const committed = runtime.advance(500, runtime.state.revision);
    expect(committed.state.actions[0]?.status).toBe("committed");
    expect(committed.events.map(({ type }) => type)).toEqual(["sample.effect-committed", "action.committed"]);
    expect(effects.commits).toEqual(["action-a"]);

    runtime.advance(1_000, runtime.state.revision);
    const completed = runtime.state.actions[0]!;
    expect(completed.status).toBe("completed");
    expect(completed.transitions.map(({ status }) => status)).toEqual([
      "proposed",
      "validated",
      "running",
      "committed",
      "completed",
    ]);
    expect(getSemanticActionProgress(completed, actionDefinition, 1_000)).toBe(1);
  });

  it("replays an idempotent request after time advances without committing twice", () => {
    const effects = effectAdapter();
    const runtime = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [definition("sample.action", {
        durationMs: 0,
        commitPoint: { mode: "on-start" },
      })],
      effectAdapter: effects.adapter,
    });
    const original = request("action-once");
    const first = runtime.submit(original);
    expect(first.action.status).toBe("completed");
    runtime.advance(100, runtime.state.revision);
    const replay = runtime.submit(original);
    expect(replay.replayed).toBe(true);
    expect(replay.state).toBe(runtime.state);
    expect(replay.events).toEqual([]);
    expect(effects.commits).toEqual(["action-once"]);

    expect(() => runtime.submit({
      ...original,
      parameters: { value: 2 },
    })).toThrow(SemanticActionIdempotencyConflictError);
  });

  it("resolves channel conflicts deterministically and releases terminal channels", () => {
    const runtime = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [definition("sample.action", { commitEffectId: null, durationMs: 100 })],
    });
    expect(runtime.submit(request("first")).action.status).toBe("running");
    const conflict = runtime.submit(request("conflict", { expectedRevision: runtime.state.revision }));
    expect(conflict.action).toMatchObject({ status: "failed", failure: { code: "channel-conflict" } });
    const independent = runtime.submit(request("independent", {
      expectedRevision: runtime.state.revision,
      subject: { id: "entity-b", typeId: "sample.actor" },
    }));
    expect(independent.action.status).toBe("running");
    runtime.advance(100, runtime.state.revision);
    expect(runtime.state.actions.filter(({ status }) => status === "completed")).toHaveLength(2);
    expect(runtime.submit(request("after-release", {
      expectedRevision: runtime.state.revision,
      proposedAtSimulationTimeMs: 100,
    })).action.status).toBe("running");
  });

  it("configures cancellation independently before and after the commit point", () => {
    const allow = definition("sample.allow", { commitEffectId: null });
    const reject = definition("sample.reject", {
      commitEffectId: null,
      channels: [],
      cancellation: { beforeCommit: "reject", afterCommit: { mode: "reject" } },
    });
    const runtime = new SemanticActionRuntime({ runId: "run-actions", definitions: [allow, reject] });
    runtime.submit(request("allow", { definitionId: allow.id }));
    const cancelled = runtime.cancel({
      actionId: "allow",
      runId: "run-actions",
      expectedRevision: runtime.state.revision,
      requestedAtSimulationTimeMs: 0,
      reason: "request-withdrawn",
    });
    expect(cancelled).toMatchObject({ accepted: true, action: { status: "cancelled" } });

    runtime.submit(request("reject", {
      definitionId: reject.id,
      expectedRevision: runtime.state.revision,
    }));
    const rejected = runtime.cancel({
      actionId: "reject",
      runId: "run-actions",
      expectedRevision: runtime.state.revision,
      requestedAtSimulationTimeMs: 0,
      reason: "request-withdrawn",
    });
    expect(rejected).toMatchObject({ accepted: false, rejectionReason: "before-commit-rejected" });
    expect(rejected.action.status).toBe("running");
  });

  it("rejects or explicitly compensates cancellation after commit", () => {
    const effects = effectAdapter();
    const reject = definition("sample.reject-after", {
      channels: [],
      commitPoint: { mode: "on-start" },
    });
    const compensate = definition("sample.compensate-after", {
      channels: [],
      commitPoint: { mode: "on-start" },
      cancellation: {
        beforeCommit: "allow",
        afterCommit: { mode: "compensate", effectId: "sample.compensate" },
      },
    });
    const runtime = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [reject, compensate],
      effectAdapter: effects.adapter,
    });
    expect(runtime.submit(request("reject-after", { definitionId: reject.id })).action.status).toBe("committed");
    expect(runtime.cancel({
      actionId: "reject-after",
      runId: "run-actions",
      expectedRevision: runtime.state.revision,
      requestedAtSimulationTimeMs: 0,
      reason: "late-request",
    })).toMatchObject({ accepted: false, rejectionReason: "after-commit-rejected" });

    expect(runtime.submit(request("compensate-after", {
      definitionId: compensate.id,
      expectedRevision: runtime.state.revision,
    })).action.status).toBe("committed");
    const result = runtime.cancel({
      actionId: "compensate-after",
      runId: "run-actions",
      expectedRevision: runtime.state.revision,
      requestedAtSimulationTimeMs: 0,
      reason: "late-request",
    });
    expect(result.action).toMatchObject({ status: "cancelled", compensatedAtSimulationTimeMs: 0 });
    expect(result.events.map(({ type }) => type)).toEqual([
      "sample.effect-compensated",
      "action.compensated",
      "action.cancelled",
    ]);
    expect(effects.compensations).toEqual(["compensate-after"]);
    expect(runtime.cancel({
      actionId: "compensate-after",
      runId: "run-actions",
      expectedRevision: runtime.state.revision,
      requestedAtSimulationTimeMs: 0,
      reason: "duplicate",
    }).accepted).toBe(false);
    expect(effects.compensations).toEqual(["compensate-after"]);
  });

  it("orders commit, completion and timeout milestones deterministically", () => {
    const effects = effectAdapter();
    const runtime = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [
        definition("sample.timeout-before-commit", {
          channels: [],
          durationMs: 100,
          timeoutMs: 50,
          commitPoint: { mode: "at-progress", progress: 0.8 },
        }),
        definition("sample.timeout-after-commit", {
          channels: [],
          durationMs: 100,
          timeoutMs: 50,
          commitPoint: { mode: "on-start" },
        }),
        definition("sample.complete-at-deadline", {
          channels: [],
          durationMs: 50,
          timeoutMs: 50,
          commitPoint: { mode: "on-completion" },
        }),
      ],
      effectAdapter: effects.adapter,
    });
    runtime.submit(request("before", { definitionId: "sample.timeout-before-commit" }));
    runtime.submit(request("after", {
      definitionId: "sample.timeout-after-commit",
      expectedRevision: runtime.state.revision,
    }));
    runtime.submit(request("deadline", {
      definitionId: "sample.complete-at-deadline",
      expectedRevision: runtime.state.revision,
    }));
    runtime.advance(100, runtime.state.revision);
    expect(runtime.state.actions.map(({ id, status, failure }) => [id, status, failure?.code])).toEqual([
      ["before", "failed", "timeout"],
      ["after", "failed", "timeout"],
      ["deadline", "completed", undefined],
    ]);
    expect(effects.commits).toEqual(["after", "deadline"]);
  });

  it("fails planned or unevaluable policies without presenting them as available", () => {
    const planned = definition("sample.planned", { status: "planned", channels: [] });
    const guarded = definition("sample.guarded", {
      channels: [],
      preconditions: [{ language: "solidloom-expression-v1", source: "subject.exists" }],
      requiredCapabilities: ["sample.invoke"],
    });
    const runtime = new SemanticActionRuntime({ runId: "run-actions", definitions: [planned, guarded] });
    expect(runtime.submit(request("planned", { definitionId: planned.id })).action)
      .toMatchObject({ status: "failed", failure: { code: "definition-planned" } });
    expect(runtime.submit(request("guarded", {
      definitionId: guarded.id,
      expectedRevision: runtime.state.revision,
    })).action).toMatchObject({ status: "failed", failure: { code: "policy-evaluator-unavailable" } });

    const deny: SemanticActionPolicyEvaluator = {
      evaluate: () => ({
        allowed: false,
        failures: [{ requirementId: "sample.invoke", kind: "permission", message: "denied" }],
      }),
    };
    const denied = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [guarded],
      policyEvaluator: deny,
    });
    expect(denied.submit(request("denied", { definitionId: guarded.id })).action)
      .toMatchObject({ status: "failed", failure: { code: "policy-denied" } });
  });

  it("turns commit or compensation adapter failures into deterministic terminal results", () => {
    const adapter: SemanticActionEffectAdapter = {
      commit: ({ action }) => {
        if (action.id === "bad-commit") throw new Error("boom");
        return { events: [] };
      },
      compensate: () => {
        throw new Error("boom");
      },
    };
    const commitDefinition = definition("sample.action", { commitPoint: { mode: "on-start" } });
    const safeDefinition = definition("sample.safe", {
      commitEffectId: null,
      commitPoint: { mode: "on-completion" },
    });
    const compensateDefinition = definition("sample.compensate", {
      channels: [],
      commitPoint: { mode: "on-start" },
      cancellation: {
        beforeCommit: "allow",
        afterCommit: { mode: "compensate", effectId: "sample.compensate" },
      },
    });
    const runtime = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [commitDefinition, safeDefinition, compensateDefinition],
      effectAdapter: adapter,
    });
    expect(runtime.submit(request("bad-commit")).action)
      .toMatchObject({ status: "failed", failure: { code: "commit-failed" } });
    expect(runtime.submit(request("safe", {
      definitionId: safeDefinition.id,
      expectedRevision: runtime.state.revision,
    })).action.status).toBe("running");
    expect(runtime.submit(request("compensate", {
      definitionId: compensateDefinition.id,
      subject: { id: "entity-b", typeId: "sample.actor" },
      expectedRevision: runtime.state.revision,
    })).action.status).toBe("committed");
    const failed = runtime.cancel({
      actionId: "compensate",
      runId: "run-actions",
      expectedRevision: runtime.state.revision,
      requestedAtSimulationTimeMs: 0,
      reason: "late-request",
    });
    expect(failed).toMatchObject({
      accepted: false,
      rejectionReason: "compensation-failed",
      action: { status: "failed", failure: { code: "compensation-failed" } },
    });
  });

  it("rejects stale writes and cyclic parameters before mutating state", () => {
    const runtime = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [definition("sample.action", { commitEffectId: null })],
    });
    expect(() => runtime.submit(request("stale", { expectedRevision: 1 })))
      .toThrow(SemanticActionRevisionConflictError);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => runtime.submit(request("cyclic", { parameters: cyclic as never })))
      .toThrow(InvalidSemanticActionError);
    expect(runtime.state.actions).toEqual([]);
    expect(runtime.state.revision).toBe(0);
  });

  it("validates policy adapter calls through the same action entry", () => {
    const evaluate = vi.fn(() => ({ allowed: true, failures: [] }));
    const guarded = definition("sample.guarded", {
      channels: [],
      commitEffectId: null,
      durationMs: 0,
      commitPoint: { mode: "on-start" },
      requiredCapabilities: ["sample.invoke"],
    });
    const runtime = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [guarded],
      policyEvaluator: { evaluate },
    });
    expect(runtime.submit(request("allowed", { definitionId: guarded.id })).action.status).toBe("completed");
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it("requires an explicit adapter for constrained parameter schemas", () => {
    const constrained = definition("sample.constrained", {
      channels: [],
      commitEffectId: null,
      parametersSchema: {
        type: "object",
        required: ["value"],
        properties: { value: { type: "number", minimum: 1 } },
      },
    });
    const missing = new SemanticActionRuntime({ runId: "run-actions", definitions: [constrained] });
    expect(missing.submit(request("missing-validator", { definitionId: constrained.id })).action)
      .toMatchObject({ status: "failed", failure: { code: "parameter-validator-unavailable" } });

    const invalid = new SemanticActionRuntime({
      runId: "run-actions",
      definitions: [constrained],
      parameterValidator: {
        validate: ({ parameters }) => ({
          valid: typeof parameters.value === "number" && parameters.value >= 1,
          errors: ["value must be at least 1"],
        }),
      },
    });
    expect(invalid.submit(request("invalid-parameters", {
      definitionId: constrained.id,
      parameters: { value: 0 },
    })).action).toMatchObject({ status: "failed", failure: { code: "invalid-parameters" } });
  });

  it("derives identical action results from #20 fixed ticks across render frame partitions", () => {
    const runWithFrames = (frameTimes: readonly number[]) => {
      const effects = effectAdapter();
      const clock = new FixedSimulationRun({
        runId: "run-actions",
        observedWallTimeMs: 0,
        config: {
          fixedStepMs: 100,
          timeScale: 1,
          maxCatchUpTicks: 20,
          recoveryPolicy: { mode: "freeze" },
        },
      });
      const actions = new SemanticActionRuntime({
        runId: "run-actions",
        definitions: [definition("sample.action", { durationMs: 300 })],
        effectAdapter: effects.adapter,
      });
      actions.submit(request("fixed-time"));
      frameTimes.forEach((wallTimeMs) => {
        const advanced = clock.advance(wallTimeMs, clock.clock.revision);
        advanced.ticks.forEach((tick) => actions.advance(tick.endedAtMs, actions.state.revision));
      });
      return {
        action: actions.state.actions[0],
        eventTypes: actions.state.events.map(({ type }) => type),
        commits: effects.commits,
      };
    };
    expect(runWithFrames([20, 40, 60, 80, 100, 200, 300])).toEqual(runWithFrames([300]));
  });
});
