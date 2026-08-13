import {
  DECLARATIVE_RULE_SCHEMA_VERSION,
  DEFAULT_RULE_EXECUTION_LIMITS,
  DeclarativeRuntimeIdempotencyConflictError,
  DeclarativeRuntimeOperationError,
  DeclarativeRuntimeRevisionConflictError,
  RuleExecutionBudgetExceededError,
  canonicalDeclarativeRequest,
  cloneRuntimeJsonObject,
  evaluateRuleCondition,
  validateDeclarativeProcessDefinitions,
  type DeclarativeProcessDefinition,
  type DeclarativeProcessRuntimeState,
  type ProcessAdvanceResult,
  type ProcessAuditEntry,
  type ProcessCommandRequest,
  type ProcessIdempotencyRecord,
  type ProcessInstance,
  type ProcessMutationResult,
  type ProcessRuntimeContext,
  type ProcessStageDefinition,
  type ProcessStageVisit,
  type ProcessStartRequest,
  type ProcessTransitionDefinition,
  type ResolvedDeclarativeEffect,
  type RuleExecutionLimits,
  type RuleExpressionContext,
  type RuleFieldCatalog,
  type RuntimeJsonObject,
} from "@solidloom/shared";
import {
  resolveDeclarativeEffects,
  type DeclarativeEffectCommitAdapter,
} from "../rules/declarative-rule-runtime.js";

const TYPE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9-]*)+$/;

export interface DeclarativeProcessRuntimeOptions {
  readonly runId: string;
  readonly definitions: readonly DeclarativeProcessDefinition[];
  readonly fieldCatalog: RuleFieldCatalog;
  readonly initialSimulationTimeMs?: number;
  readonly limits?: RuleExecutionLimits;
  readonly effectAdapter?: DeclarativeEffectCommitAdapter;
  readonly initialState?: DeclarativeProcessRuntimeState;
}

interface WorkingMutation {
  process: ProcessInstance;
  readonly effects: ResolvedDeclarativeEffect[];
  readonly audit: ProcessAuditEntry[];
  nextAuditSequence: number;
}

function assertSafeTime(value: number, path: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DeclarativeRuntimeOperationError("invalid-time", `${path} 必须是非负安全整数`);
  }
}

function assertRevision(actualRevision: number, expectedRevision: number) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new DeclarativeRuntimeOperationError("invalid-revision", "expectedRevision 必须是非负安全整数");
  }
  if (actualRevision !== expectedRevision) {
    throw new DeclarativeRuntimeRevisionConflictError(expectedRevision, actualRevision);
  }
}

function freezeVisit(visit: ProcessStageVisit): ProcessStageVisit {
  return Object.freeze({ ...visit });
}

function freezeProcess(process: ProcessInstance): ProcessInstance {
  return Object.freeze({
    ...process,
    participants: Object.freeze(process.participants.map((participant) => Object.freeze({ ...participant }))),
    variables: cloneRuntimeJsonObject(process.variables),
    failure: process.failure ? Object.freeze({ ...process.failure }) : null,
    stageVisits: Object.freeze(process.stageVisits.map(freezeVisit)),
  });
}

function freezeAudit(entry: ProcessAuditEntry): ProcessAuditEntry {
  return Object.freeze({ ...entry, effectIds: Object.freeze([...entry.effectIds]) });
}

function freezeState(state: DeclarativeProcessRuntimeState): DeclarativeProcessRuntimeState {
  return Object.freeze({
    ...state,
    processes: Object.freeze(state.processes.map(freezeProcess)),
    idempotencyRecords: Object.freeze(state.idempotencyRecords.map((record) => Object.freeze({ ...record }))),
    audit: Object.freeze(state.audit.map(freezeAudit)),
  });
}

function createInitialState(runId: string, simulationTimeMs: number): DeclarativeProcessRuntimeState {
  if (!runId) throw new DeclarativeRuntimeOperationError("invalid-run", "runId 不能为空");
  assertSafeTime(simulationTimeMs, "initialSimulationTimeMs");
  return freezeState({
    schemaVersion: DECLARATIVE_RULE_SCHEMA_VERSION,
    runId,
    revision: 0,
    simulationTimeMs,
    nextProcessSequence: 0,
    nextAuditSequence: 0,
    processes: [],
    idempotencyRecords: [],
    audit: [],
  });
}

function processContext(
  process: ProcessInstance,
  external: ProcessRuntimeContext,
  atSimulationTimeMs: number,
): RuleExpressionContext {
  const currentVisit = process.stageVisits.at(-1);
  const elapsedMs = currentVisit
    ? Math.max(0, atSimulationTimeMs - currentVisit.enteredAtSimulationTimeMs - process.accumulatedPausedMs)
    : 0;
  const participants: Record<string, RuntimeJsonObject> = {};
  process.participants.forEach((participant) => {
    participants[participant.slotId] = Object.freeze({
      entityId: participant.entityId,
      entityTypeId: participant.entityTypeId,
    });
  });
  return Object.freeze({
    event: external.event,
    state: external.state,
    process: Object.freeze({
      id: process.id,
      definitionId: process.definitionId,
      status: process.status,
      currentStageId: process.currentStageId,
      elapsedMs,
      participants: Object.freeze(participants),
    }),
    variables: process.variables,
  });
}

function stageById(definition: DeclarativeProcessDefinition, stageId: string): ProcessStageDefinition {
  const stage = definition.stages.find(({ id }) => id === stageId);
  if (!stage) throw new DeclarativeRuntimeOperationError("unknown-stage", `流程阶段 ${stageId} 不存在`);
  return stage;
}

function transitionOrder(left: ProcessTransitionDefinition, right: ProcessTransitionDefinition) {
  return right.priority - left.priority || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function appendAudit(
  working: WorkingMutation,
  input: Omit<ProcessAuditEntry, "sequence">,
) {
  working.audit.push(freezeAudit({ sequence: working.nextAuditSequence, ...input }));
  working.nextAuditSequence += 1;
}

function resolveEffects(
  working: WorkingMutation,
  definition: DeclarativeProcessDefinition,
  templates: ProcessStageDefinition["enterEffects"],
  sourceTriggerId: string,
  context: RuleExpressionContext,
  limits: RuleExecutionLimits,
) {
  const effects = resolveDeclarativeEffects({
    templates,
    sourceKind: "process",
    sourceDefinitionId: definition.id,
    sourceInstanceId: working.process.id,
    sourceTriggerId,
    context,
    maxEvaluationSteps: limits.maxEvaluationSteps,
  });
  if (working.effects.length + effects.length > limits.maxEffects) {
    throw new RuleExecutionBudgetExceededError("maxEffects");
  }
  working.effects.push(...effects);
  return effects;
}

function updateCurrentVisit(
  process: ProcessInstance,
  update: (visit: ProcessStageVisit) => ProcessStageVisit,
): readonly ProcessStageVisit[] {
  if (process.stageVisits.length === 0) {
    throw new DeclarativeRuntimeOperationError("invalid-process-state", "流程缺少当前阶段访问记录");
  }
  const lastIndex = process.stageVisits.length - 1;
  return process.stageVisits.map((visit, index) => index === lastIndex ? freezeVisit(update(visit)) : visit);
}

function compensate(
  working: WorkingMutation,
  definition: DeclarativeProcessDefinition,
  external: ProcessRuntimeContext,
  atSimulationTimeMs: number,
  sourceTriggerId: string,
  limits: RuleExecutionLimits,
) {
  let process = working.process;
  const visits = [...process.stageVisits];
  for (let index = visits.length - 1; index >= 0; index -= 1) {
    const visit = visits[index]!;
    const stage = stageById(definition, visit.stageId);
    if (stage.kind !== "active" || visit.compensatedAtSimulationTimeMs !== null) continue;
    const context = processContext(process, external, atSimulationTimeMs);
    const effects = resolveEffects(
      working,
      definition,
      stage.compensationEffects,
      `${sourceTriggerId}:compensate:${visit.sequence}`,
      context,
      limits,
    );
    visits[index] = freezeVisit({ ...visit, compensatedAtSimulationTimeMs: atSimulationTimeMs });
    appendAudit(working, {
      processId: process.id,
      type: "stage-compensated",
      stageId: visit.stageId,
      atSimulationTimeMs,
      reason: "reverse-order-compensation",
      effectIds: effects.map(({ id }) => id),
    });
  }
  process = freezeProcess({ ...process, stageVisits: visits });
  working.process = process;
}

function terminalFailure(
  working: WorkingMutation,
  definition: DeclarativeProcessDefinition,
  external: ProcessRuntimeContext,
  atSimulationTimeMs: number,
  sourceTriggerId: string,
  code: string,
  message: string,
  auditType: "process-failed" | "process-cancelled",
  limits: RuleExecutionLimits,
) {
  working.process = freezeProcess({
    ...working.process,
    status: auditType === "process-cancelled" ? "cancelled" : "failed",
    endedAtSimulationTimeMs: atSimulationTimeMs,
    pausedAtSimulationTimeMs: null,
    failure: auditType === "process-cancelled" ? null : Object.freeze({ code, message }),
    stageVisits: updateCurrentVisit(working.process, (visit) => ({
      ...visit,
      exitedAtSimulationTimeMs: visit.exitedAtSimulationTimeMs ?? atSimulationTimeMs,
    })),
  });
  compensate(working, definition, external, atSimulationTimeMs, sourceTriggerId, limits);
  appendAudit(working, {
    processId: working.process.id,
    type: auditType,
    stageId: working.process.currentStageId,
    atSimulationTimeMs,
    reason: message,
    effectIds: [],
  });
}

function applyTransition(
  working: WorkingMutation,
  definition: DeclarativeProcessDefinition,
  transition: ProcessTransitionDefinition,
  external: ProcessRuntimeContext,
  atSimulationTimeMs: number,
  sourceTriggerId: string,
  limits: RuleExecutionLimits,
  options: { readonly enforceExitCondition: boolean; readonly includeTimeoutEffects: boolean },
) {
  const sourceStage = stageById(definition, working.process.currentStageId);
  const beforeContext = processContext(working.process, external, atSimulationTimeMs);
  if (options.enforceExitCondition
    && !evaluateRuleCondition(sourceStage.exitCondition, beforeContext, limits.maxEvaluationSteps)) {
    throw new DeclarativeRuntimeOperationError("stage-exit-condition", `阶段 ${sourceStage.id} 尚不允许退出`);
  }
  if (!evaluateRuleCondition(transition.condition, beforeContext, limits.maxEvaluationSteps)) {
    throw new DeclarativeRuntimeOperationError("transition-condition", `转移 ${transition.id} 条件不满足`);
  }

  const effectStart = working.effects.length;
  if (options.includeTimeoutEffects) {
    resolveEffects(working, definition, sourceStage.timeoutEffects, `${sourceTriggerId}:timeout`, beforeContext, limits);
  }
  resolveEffects(working, definition, sourceStage.exitEffects, `${sourceTriggerId}:exit`, beforeContext, limits);
  resolveEffects(working, definition, transition.effects, `${sourceTriggerId}:transition`, beforeContext, limits);
  working.process = freezeProcess({
    ...working.process,
    stageVisits: updateCurrentVisit(working.process, (visit) => ({
      ...visit,
      exitedAtSimulationTimeMs: atSimulationTimeMs,
    })),
  });
  appendAudit(working, {
    processId: working.process.id,
    type: "stage-exited",
    stageId: sourceStage.id,
    atSimulationTimeMs,
    reason: transition.id,
    effectIds: working.effects.slice(effectStart).map(({ id }) => id),
  });

  const targetStage = stageById(definition, transition.toStageId);
  const nextVisitSequence = (working.process.stageVisits.at(-1)?.sequence ?? -1) + 1;
  working.process = freezeProcess({
    ...working.process,
    currentStageId: targetStage.id,
    status: targetStage.kind === "active" ? "running" : targetStage.kind,
    accumulatedPausedMs: 0,
    pausedAtSimulationTimeMs: null,
    stageVisits: [...working.process.stageVisits, freezeVisit({
      sequence: nextVisitSequence,
      stageId: targetStage.id,
      enteredAtSimulationTimeMs: atSimulationTimeMs,
      exitedAtSimulationTimeMs: targetStage.kind === "active" ? null : atSimulationTimeMs,
      compensatedAtSimulationTimeMs: null,
    })],
  });
  const enterContext = processContext(working.process, external, atSimulationTimeMs);
  if (!evaluateRuleCondition(targetStage.enterCondition, enterContext, limits.maxEvaluationSteps)) {
    throw new DeclarativeRuntimeOperationError("stage-enter-condition", `阶段 ${targetStage.id} 进入条件不满足`);
  }
  const enterEffects = resolveEffects(
    working,
    definition,
    targetStage.enterEffects,
    `${sourceTriggerId}:enter`,
    enterContext,
    limits,
  );
  appendAudit(working, {
    processId: working.process.id,
    type: "stage-entered",
    stageId: targetStage.id,
    atSimulationTimeMs,
    reason: transition.id,
    effectIds: enterEffects.map(({ id }) => id),
  });

  if (targetStage.kind === "completed") {
    working.process = freezeProcess({
      ...working.process,
      status: "completed",
      endedAtSimulationTimeMs: atSimulationTimeMs,
    });
    appendAudit(working, {
      processId: working.process.id,
      type: "process-completed",
      stageId: targetStage.id,
      atSimulationTimeMs,
      reason: transition.id,
      effectIds: [],
    });
  } else if (targetStage.kind === "failed") {
    working.process = freezeProcess({
      ...working.process,
      status: "failed",
      endedAtSimulationTimeMs: atSimulationTimeMs,
      failure: Object.freeze({ code: "failure-stage", message: `流程进入失败阶段 ${targetStage.id}` }),
    });
    compensate(working, definition, external, atSimulationTimeMs, sourceTriggerId, limits);
    appendAudit(working, {
      processId: working.process.id,
      type: "process-failed",
      stageId: targetStage.id,
      atSimulationTimeMs,
      reason: transition.id,
      effectIds: [],
    });
  }
}

function requestFingerprint(value: ProcessStartRequest | ProcessCommandRequest) {
  const { expectedRevision: _expectedRevision, ...semanticRequest } = value;
  return canonicalDeclarativeRequest(semanticRequest);
}

function idempotencyReplay(
  state: DeclarativeProcessRuntimeState,
  idempotencyKey: string,
  fingerprint: string,
): ProcessIdempotencyRecord | null {
  const existing = state.idempotencyRecords.find((record) => record.idempotencyKey === idempotencyKey);
  if (!existing) return null;
  if (existing.fingerprint !== fingerprint) throw new DeclarativeRuntimeIdempotencyConflictError(idempotencyKey);
  return existing;
}

function ensureAtCurrentTime(state: DeclarativeProcessRuntimeState, requestedAtSimulationTimeMs: number) {
  assertSafeTime(requestedAtSimulationTimeMs, "requestedAtSimulationTimeMs");
  if (requestedAtSimulationTimeMs !== state.simulationTimeMs) {
    throw new DeclarativeRuntimeOperationError(
      "simulation-time-mismatch",
      `流程命令时间必须等于当前仿真时间 ${state.simulationTimeMs}`,
    );
  }
}

export class DeclarativeProcessRuntime {
  readonly #definitions: ReadonlyMap<string, DeclarativeProcessDefinition>;
  readonly #limits: RuleExecutionLimits;
  readonly #effectAdapter: DeclarativeEffectCommitAdapter | undefined;
  #state: DeclarativeProcessRuntimeState;

  constructor(options: DeclarativeProcessRuntimeOptions) {
    this.#limits = Object.freeze({ ...(options.limits ?? DEFAULT_RULE_EXECUTION_LIMITS) });
    validateDeclarativeProcessDefinitions(options.definitions, options.fieldCatalog, this.#limits);
    this.#definitions = new Map(options.definitions.map((definition) => [definition.id, definition]));
    this.#effectAdapter = options.effectAdapter;
    this.#state = options.initialState
      ? freezeState(options.initialState)
      : createInitialState(options.runId, options.initialSimulationTimeMs ?? 0);
    if (this.#state.runId !== options.runId) {
      throw new DeclarativeRuntimeOperationError("run-mismatch", "初始流程状态不属于当前 runId");
    }
  }

  get state(): DeclarativeProcessRuntimeState {
    return this.#state;
  }

  #definition(definitionId: string): DeclarativeProcessDefinition {
    const definition = this.#definitions.get(definitionId);
    if (!definition) throw new DeclarativeRuntimeOperationError("unknown-process-definition", `流程定义 ${definitionId} 不存在`);
    if (definition.status !== "available") {
      throw new DeclarativeRuntimeOperationError("process-definition-planned", `流程定义 ${definitionId} 仍为 planned`);
    }
    return definition;
  }

  #commitEffects(effects: readonly ResolvedDeclarativeEffect[]) {
    if (effects.length === 0) return;
    if (!this.#effectAdapter) {
      throw new DeclarativeRuntimeOperationError(
        "effect-adapter-required",
        "流程效果需要原子提交适配器；未接入的能力不能视为已执行",
      );
    }
    this.#effectAdapter.commitAtomic({ runId: this.#state.runId, effects: Object.freeze([...effects]) });
  }

  start(request: ProcessStartRequest, external: ProcessRuntimeContext): ProcessMutationResult {
    if (!request.idempotencyKey || !request.processId) {
      throw new DeclarativeRuntimeOperationError("invalid-process-request", "processId 和幂等键不能为空");
    }
    if (request.runId !== this.#state.runId) throw new DeclarativeRuntimeOperationError("run-mismatch", "请求不属于当前运行实例");
    const fingerprint = requestFingerprint(request);
    const replay = idempotencyReplay(this.#state, request.idempotencyKey, fingerprint);
    if (replay) {
      const process = this.#state.processes.find(({ id }) => id === replay.processId)!;
      return Object.freeze({ state: this.#state, process, effects: Object.freeze([]), audit: Object.freeze([]), replayed: true });
    }
    assertRevision(this.#state.revision, request.expectedRevision);
    ensureAtCurrentTime(this.#state, request.requestedAtSimulationTimeMs);
    if (this.#state.processes.some(({ id }) => id === request.processId)) {
      throw new DeclarativeRuntimeOperationError("duplicate-process", `流程实例 ${request.processId} 已存在`);
    }
    const definition = this.#definition(request.definitionId);
    const assignments = new Map<string, ProcessStartRequest["participants"][number]>();
    request.participants.forEach((participant) => {
      if (!participant.slotId || !participant.entityId || !TYPE_ID_PATTERN.test(participant.entityTypeId)) {
        throw new DeclarativeRuntimeOperationError(
          "invalid-participant",
          "参与者必须包含非空槽位、实体 ID 和带命名空间的实体类型 ID",
        );
      }
      if (assignments.has(participant.slotId)) {
        throw new DeclarativeRuntimeOperationError("duplicate-participant", `参与槽位 ${participant.slotId} 被重复赋值`);
      }
      const slot = definition.participantSlots.find(({ id }) => id === participant.slotId);
      if (!slot) throw new DeclarativeRuntimeOperationError("unknown-participant-slot", `参与槽位 ${participant.slotId} 不存在`);
      if (slot.entityTypeIds.length > 0 && !slot.entityTypeIds.includes(participant.entityTypeId)) {
        throw new DeclarativeRuntimeOperationError("participant-type", `参与槽位 ${participant.slotId} 不接受 ${participant.entityTypeId}`);
      }
      assignments.set(participant.slotId, participant);
    });
    definition.participantSlots.forEach((slot) => {
      if (slot.required && !assignments.has(slot.id)) {
        throw new DeclarativeRuntimeOperationError("missing-participant", `缺少必需参与槽位 ${slot.id}`);
      }
    });

    const stage = stageById(definition, definition.initialStageId);
    const process = freezeProcess({
      id: request.processId,
      sequence: this.#state.nextProcessSequence,
      runId: request.runId,
      definitionId: definition.id,
      definitionRevision: definition.revision,
      status: "running",
      currentStageId: stage.id,
      participants: request.participants,
      variables: cloneRuntimeJsonObject(request.variables),
      startedAtSimulationTimeMs: request.requestedAtSimulationTimeMs,
      endedAtSimulationTimeMs: null,
      pausedAtSimulationTimeMs: null,
      accumulatedPausedMs: 0,
      failure: null,
      stageVisits: [freezeVisit({
        sequence: 0,
        stageId: stage.id,
        enteredAtSimulationTimeMs: request.requestedAtSimulationTimeMs,
        exitedAtSimulationTimeMs: null,
        compensatedAtSimulationTimeMs: null,
      })],
      revision: 0,
    });
    const working: WorkingMutation = {
      process,
      effects: [],
      audit: [],
      nextAuditSequence: this.#state.nextAuditSequence,
    };
    const context = processContext(process, external, request.requestedAtSimulationTimeMs);
    if (!evaluateRuleCondition(stage.enterCondition, context, this.#limits.maxEvaluationSteps)) {
      throw new DeclarativeRuntimeOperationError("stage-enter-condition", `初始阶段 ${stage.id} 进入条件不满足`);
    }
    const enterEffects = resolveEffects(
      working,
      definition,
      stage.enterEffects,
      `${request.processId}:start`,
      context,
      this.#limits,
    );
    appendAudit(working, {
      processId: request.processId,
      type: "process-started",
      stageId: stage.id,
      atSimulationTimeMs: request.requestedAtSimulationTimeMs,
      reason: null,
      effectIds: [],
    });
    appendAudit(working, {
      processId: request.processId,
      type: "stage-entered",
      stageId: stage.id,
      atSimulationTimeMs: request.requestedAtSimulationTimeMs,
      reason: "initial-stage",
      effectIds: enterEffects.map(({ id }) => id),
    });
    this.#commitEffects(working.effects);
    this.#state = freezeState({
      ...this.#state,
      revision: this.#state.revision + 1,
      nextProcessSequence: this.#state.nextProcessSequence + 1,
      nextAuditSequence: working.nextAuditSequence,
      processes: [...this.#state.processes, working.process],
      idempotencyRecords: [...this.#state.idempotencyRecords, Object.freeze({
        idempotencyKey: request.idempotencyKey,
        requestId: request.processId,
        fingerprint,
        processId: request.processId,
      })],
      audit: [...this.#state.audit, ...working.audit],
    });
    return Object.freeze({
      state: this.#state,
      process: this.#state.processes.at(-1)!,
      effects: Object.freeze(working.effects),
      audit: Object.freeze(working.audit),
      replayed: false,
    });
  }

  command(request: ProcessCommandRequest, external: ProcessRuntimeContext): ProcessMutationResult {
    if (!request.idempotencyKey || !request.commandId || !request.reason) {
      throw new DeclarativeRuntimeOperationError("invalid-process-command", "commandId、幂等键和 reason 不能为空");
    }
    if (request.runId !== this.#state.runId) throw new DeclarativeRuntimeOperationError("run-mismatch", "命令不属于当前运行实例");
    const fingerprint = requestFingerprint(request);
    const replay = idempotencyReplay(this.#state, request.idempotencyKey, fingerprint);
    if (replay) {
      const process = this.#state.processes.find(({ id }) => id === replay.processId)!;
      return Object.freeze({ state: this.#state, process, effects: Object.freeze([]), audit: Object.freeze([]), replayed: true });
    }
    assertRevision(this.#state.revision, request.expectedRevision);
    ensureAtCurrentTime(this.#state, request.requestedAtSimulationTimeMs);
    const processIndex = this.#state.processes.findIndex(({ id }) => id === request.processId);
    if (processIndex < 0) throw new DeclarativeRuntimeOperationError("unknown-process", `流程实例 ${request.processId} 不存在`);
    const process = this.#state.processes[processIndex]!;
    const definition = this.#definition(process.definitionId);
    const working: WorkingMutation = {
      process,
      effects: [],
      audit: [],
      nextAuditSequence: this.#state.nextAuditSequence,
    };
    const at = request.requestedAtSimulationTimeMs;

    switch (request.kind) {
      case "pause":
        if (process.status !== "running") throw new DeclarativeRuntimeOperationError("invalid-process-status", "只有 running 流程可以暂停");
        working.process = freezeProcess({ ...process, status: "paused", pausedAtSimulationTimeMs: at, revision: process.revision + 1 });
        appendAudit(working, { processId: process.id, type: "process-paused", stageId: process.currentStageId, atSimulationTimeMs: at, reason: request.reason, effectIds: [] });
        break;
      case "resume":
        if (process.status !== "paused" || process.pausedAtSimulationTimeMs === null) {
          throw new DeclarativeRuntimeOperationError("invalid-process-status", "只有 paused 流程可以恢复");
        }
        working.process = freezeProcess({
          ...process,
          status: "running",
          accumulatedPausedMs: process.accumulatedPausedMs + (at - process.pausedAtSimulationTimeMs),
          pausedAtSimulationTimeMs: null,
          revision: process.revision + 1,
        });
        appendAudit(working, { processId: process.id, type: "process-resumed", stageId: process.currentStageId, atSimulationTimeMs: at, reason: request.reason, effectIds: [] });
        break;
      case "cancel":
      case "fail":
        if (process.status !== "running" && process.status !== "paused") {
          throw new DeclarativeRuntimeOperationError("invalid-process-status", "只有活动流程可以取消或失败");
        }
        terminalFailure(
          working,
          definition,
          external,
          at,
          request.commandId,
          request.kind === "fail" ? "explicit-failure" : "cancelled",
          request.reason,
          request.kind === "fail" ? "process-failed" : "process-cancelled",
          this.#limits,
        );
        working.process = freezeProcess({ ...working.process, revision: process.revision + 1 });
        break;
      case "transition": { // Manual transitions still use the same declared exit/transition/entry conditions.
        if (process.status !== "running") throw new DeclarativeRuntimeOperationError("invalid-process-status", "只有 running 流程可以手动转移");
        if (!request.transitionId) throw new DeclarativeRuntimeOperationError("transition-required", "transition 命令必须提供 transitionId");
        const transition = definition.transitions.find(({ id }) => id === request.transitionId);
        if (!transition || transition.trigger !== "manual" || transition.fromStageId !== process.currentStageId) {
          throw new DeclarativeRuntimeOperationError("invalid-transition", `手动转移 ${request.transitionId} 不适用于当前阶段`);
        }
        applyTransition(working, definition, transition, external, at, request.commandId, this.#limits, {
          enforceExitCondition: true,
          includeTimeoutEffects: false,
        });
        working.process = freezeProcess({ ...working.process, revision: process.revision + 1 });
        break;
      }
    }

    this.#commitEffects(working.effects);
    const processes = [...this.#state.processes];
    processes[processIndex] = working.process;
    this.#state = freezeState({
      ...this.#state,
      revision: this.#state.revision + 1,
      nextAuditSequence: working.nextAuditSequence,
      processes,
      idempotencyRecords: [...this.#state.idempotencyRecords, Object.freeze({
        idempotencyKey: request.idempotencyKey,
        requestId: request.commandId,
        fingerprint,
        processId: request.processId,
      })],
      audit: [...this.#state.audit, ...working.audit],
    });
    return Object.freeze({
      state: this.#state,
      process: this.#state.processes[processIndex]!,
      effects: Object.freeze(working.effects),
      audit: Object.freeze(working.audit),
      replayed: false,
    });
  }

  advance(
    toSimulationTimeMs: number,
    expectedRevision: number,
    external: ProcessRuntimeContext,
  ): ProcessAdvanceResult {
    assertRevision(this.#state.revision, expectedRevision);
    assertSafeTime(toSimulationTimeMs, "toSimulationTimeMs");
    if (toSimulationTimeMs < this.#state.simulationTimeMs) {
      throw new DeclarativeRuntimeOperationError("time-reversal", "流程仿真时间不能倒退");
    }
    const processes = [...this.#state.processes];
    const allEffects: ResolvedDeclarativeEffect[] = [];
    const allAudit: ProcessAuditEntry[] = [];
    let nextAuditSequence = this.#state.nextAuditSequence;

    for (let index = 0; index < processes.length; index += 1) {
      const original = processes[index]!;
      if (original.status !== "running") continue;
      const definition = this.#definition(original.definitionId);
      const working: WorkingMutation = { process: original, effects: [], audit: [], nextAuditSequence };
      let transitionCount = 0;
      let changed = false;

      while (working.process.status === "running") {
        const stage = stageById(definition, working.process.currentStageId);
        const visit = working.process.stageVisits.at(-1)!;
        const dueAt = stage.timeoutMs === null
          ? null
          : visit.enteredAtSimulationTimeMs + stage.timeoutMs + working.process.accumulatedPausedMs;
        let transition: ProcessTransitionDefinition | undefined;
        let at = toSimulationTimeMs;
        let timeout = false;

        if (dueAt !== null && dueAt <= toSimulationTimeMs) {
          const timeoutContext = processContext(working.process, external, dueAt);
          transition = definition.transitions
            .filter((candidate) => candidate.fromStageId === stage.id && candidate.trigger === "timeout")
            .sort(transitionOrder)
            .find((candidate) => evaluateRuleCondition(candidate.condition, timeoutContext, this.#limits.maxEvaluationSteps));
          at = dueAt;
          timeout = true;
          if (!transition) {
            const context = processContext(working.process, external, dueAt);
            resolveEffects(working, definition, stage.timeoutEffects, `advance:${dueAt}:timeout`, context, this.#limits);
            terminalFailure(
              working,
              definition,
              external,
              dueAt,
              `advance:${dueAt}`,
              "stage-timeout",
              `阶段 ${stage.id} 超时`,
              "process-failed",
              this.#limits,
            );
            changed = true;
            break;
          }
        } else {
          const context = processContext(working.process, external, toSimulationTimeMs);
          const exitAllowed = evaluateRuleCondition(stage.exitCondition, context, this.#limits.maxEvaluationSteps);
          if (exitAllowed) {
            transition = definition.transitions
              .filter((candidate) => candidate.fromStageId === stage.id && candidate.trigger === "condition")
              .sort(transitionOrder)
              .find((candidate) => evaluateRuleCondition(candidate.condition, context, this.#limits.maxEvaluationSteps));
          }
        }
        if (!transition) break;
        transitionCount += 1;
        if (transitionCount > definition.maxTransitionsPerAdvance || transitionCount > this.#limits.maxRuleFirings) {
          throw new RuleExecutionBudgetExceededError(`process:${definition.id}:maxTransitionsPerAdvance`);
        }
        applyTransition(
          working,
          definition,
          transition,
          external,
          at,
          `advance:${toSimulationTimeMs}:${transitionCount}`,
          this.#limits,
          { enforceExitCondition: !timeout, includeTimeoutEffects: timeout },
        );
        changed = true;
      }

      if (changed) {
        processes[index] = freezeProcess({ ...working.process, revision: original.revision + 1 });
      }
      if (allEffects.length + working.effects.length > this.#limits.maxEffects) {
        throw new RuleExecutionBudgetExceededError("maxEffects");
      }
      allEffects.push(...working.effects);
      allAudit.push(...working.audit);
      nextAuditSequence = working.nextAuditSequence;
    }

    this.#commitEffects(allEffects);
    this.#state = freezeState({
      ...this.#state,
      revision: this.#state.revision + 1,
      simulationTimeMs: toSimulationTimeMs,
      nextAuditSequence,
      processes,
      audit: [...this.#state.audit, ...allAudit],
    });
    return Object.freeze({
      state: this.#state,
      effects: Object.freeze(allEffects),
      audit: Object.freeze(allAudit),
    });
  }
}
