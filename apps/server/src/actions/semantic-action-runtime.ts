import {
  InvalidSemanticActionError,
  SemanticActionIdempotencyConflictError,
  SemanticActionRevisionConflictError,
  canTransitionSemanticAction,
  createSemanticActionRuntimeState,
  fingerprintSemanticActionRequest,
  isSemanticActionTerminal,
  semanticActionCommitTime,
  validateSemanticActionDefinition,
  type RuntimeJsonObject,
  type RuntimeJsonValue,
  type SemanticActionAdvanceResult,
  type SemanticActionCancellationRequest,
  type SemanticActionCancellationResult,
  type SemanticActionDefinition,
  type SemanticActionEffectEventInput,
  type SemanticActionEffectResult,
  type SemanticActionEvent,
  type SemanticActionInstance,
  type SemanticActionPolicyDecision,
  type SemanticActionRequest,
  type SemanticActionRuntimeState,
  type SemanticActionStatus,
  type SemanticActionSubmissionResult,
} from "@solidloom/shared";

export interface SemanticActionPolicyEvaluator {
  evaluate(input: {
    readonly request: SemanticActionRequest;
    readonly definition: SemanticActionDefinition;
    readonly state: SemanticActionRuntimeState;
  }): SemanticActionPolicyDecision;
}

export interface SemanticActionParameterValidator {
  validate(input: {
    readonly schema: SemanticActionDefinition["parametersSchema"];
    readonly parameters: RuntimeJsonObject;
  }): { readonly valid: boolean; readonly errors: readonly string[] };
}

export interface SemanticActionEffectAdapter {
  commit(input: {
    readonly effectId: string;
    readonly action: SemanticActionInstance;
    readonly definition: SemanticActionDefinition;
    readonly state: SemanticActionRuntimeState;
  }): SemanticActionEffectResult;
  compensate(input: {
    readonly effectId: string;
    readonly action: SemanticActionInstance;
    readonly definition: SemanticActionDefinition;
    readonly state: SemanticActionRuntimeState;
  }): SemanticActionEffectResult;
}

interface WorkingState {
  actions: SemanticActionInstance[];
  events: SemanticActionEvent[];
  nextActionSequence: number;
  nextEventSequence: number;
}

interface Milestone {
  readonly actionId: string;
  readonly actionSequence: number;
  readonly type: "commit" | "complete" | "timeout";
  readonly atSimulationTimeMs: number;
}

const MILESTONE_RANK: Readonly<Record<Milestone["type"], number>> = {
  commit: 0,
  complete: 1,
  timeout: 2,
};
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9-]*)+$/;

function assertRevision(state: SemanticActionRuntimeState, expectedRevision: number) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new InvalidSemanticActionError("expectedRevision must be a non-negative safe integer.");
  }
  if (state.revision !== expectedRevision) {
    throw new SemanticActionRevisionConflictError(expectedRevision, state.revision);
  }
}

function assertSimulationTime(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidSemanticActionError(`${name} must be a non-negative safe integer.`);
  }
}

function cloneJsonValue(value: unknown, ancestors: Set<object>): RuntimeJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "object") throw new InvalidSemanticActionError("Action data must be JSON serializable.");
  if (ancestors.has(value)) throw new InvalidSemanticActionError("Action data cannot contain circular references.");
  ancestors.add(value);
  if (Array.isArray(value)) {
    const result = Object.freeze(value.map((item) => cloneJsonValue(item, ancestors)));
    ancestors.delete(value);
    return result;
  }
  const result: Record<string, RuntimeJsonValue> = {};
  Object.entries(value).forEach(([key, item]) => {
    result[key] = cloneJsonValue(item, ancestors);
  });
  ancestors.delete(value);
  return Object.freeze(result);
}

function cloneJsonObject(value: RuntimeJsonObject): RuntimeJsonObject {
  return cloneJsonValue(value, new Set()) as RuntimeJsonObject;
}

function freezeAction(action: SemanticActionInstance): SemanticActionInstance {
  return Object.freeze({
    ...action,
    subject: action.subject ? Object.freeze({ ...action.subject }) : null,
    target: action.target ? Object.freeze({
      ...action.target,
      scope: Object.freeze({ ...action.target.scope }),
    }) : null,
    parameters: action.parameters,
    channelKeys: Object.freeze([...action.channelKeys]),
    failure: action.failure ? Object.freeze({ ...action.failure }) : null,
    transitions: Object.freeze(action.transitions.map((transition) => Object.freeze({ ...transition }))),
  });
}

function lifecycleEventType(status: SemanticActionStatus) {
  return `action.${status}` as const;
}

function appendLifecycleEvent(
  working: WorkingState,
  state: SemanticActionRuntimeState,
  action: SemanticActionInstance,
  atSimulationTimeMs: number,
  reason: string | null,
) {
  const sequence = working.nextEventSequence;
  working.nextEventSequence += 1;
  const payload: RuntimeJsonObject = reason === null
    ? { status: action.status }
    : { status: action.status, reason };
  working.events.push(Object.freeze({
    id: `${action.id}:event:${sequence}`,
    sequence,
    runId: state.runId,
    actionId: action.id,
    kind: "lifecycle",
    type: lifecycleEventType(action.status),
    atSimulationTimeMs,
    payload: Object.freeze(payload),
  }));
}

function appendCompensatedEvent(
  working: WorkingState,
  state: SemanticActionRuntimeState,
  action: SemanticActionInstance,
  atSimulationTimeMs: number,
) {
  const sequence = working.nextEventSequence;
  working.nextEventSequence += 1;
  working.events.push(Object.freeze({
    id: `${action.id}:event:${sequence}`,
    sequence,
    runId: state.runId,
    actionId: action.id,
    kind: "lifecycle",
    type: "action.compensated",
    atSimulationTimeMs,
    payload: Object.freeze({ status: action.status }),
  }));
}

function appendDomainEvents(
  working: WorkingState,
  state: SemanticActionRuntimeState,
  action: SemanticActionInstance,
  atSimulationTimeMs: number,
  events: readonly SemanticActionEffectEventInput[],
) {
  const prepared = events.map((event) => {
    if (!EVENT_TYPE_PATTERN.test(event.type)) {
      throw new InvalidSemanticActionError("Effect event type must be a namespaced ID.");
    }
    return { type: event.type, payload: cloneJsonObject(event.payload) };
  });
  prepared.forEach((event) => {
    const sequence = working.nextEventSequence;
    working.nextEventSequence += 1;
    working.events.push(Object.freeze({
      id: `${action.id}:event:${sequence}`,
      sequence,
      runId: state.runId,
      actionId: action.id,
      kind: "domain",
      type: event.type,
      atSimulationTimeMs,
      payload: event.payload,
    }));
  });
}

function transitionAction(
  action: SemanticActionInstance,
  to: SemanticActionStatus,
  atSimulationTimeMs: number,
  reason: string | null,
  failure: { readonly code: string; readonly message: string } | null = null,
): SemanticActionInstance {
  if (!canTransitionSemanticAction(action.status, to)) {
    throw new InvalidSemanticActionError(`Cannot transition action ${action.id} from ${action.status} to ${to}.`);
  }
  return freezeAction({
    ...action,
    status: to,
    startedAtSimulationTimeMs: to === "running" ? atSimulationTimeMs : action.startedAtSimulationTimeMs,
    committedAtSimulationTimeMs: to === "committed" ? atSimulationTimeMs : action.committedAtSimulationTimeMs,
    endedAtSimulationTimeMs: isSemanticActionTerminal(to) ? atSimulationTimeMs : action.endedAtSimulationTimeMs,
    failure,
    revision: action.revision + 1,
    transitions: [...action.transitions, { status: to, atSimulationTimeMs, reason }],
  });
}

function replaceAction(working: WorkingState, action: SemanticActionInstance) {
  const index = working.actions.findIndex(({ id }) => id === action.id);
  if (index < 0) working.actions.push(action);
  else working.actions[index] = action;
}

function activeChannelConflict(
  actions: readonly SemanticActionInstance[],
  channelKeys: readonly string[],
) {
  const keys = new Set(channelKeys);
  return actions
    .filter(({ status }) => status === "running" || status === "committed")
    .sort((left, right) => left.sequence - right.sequence)
    .find((action) => action.channelKeys.some((key) => keys.has(key)));
}

function channelKeysFor(definition: SemanticActionDefinition, request: SemanticActionRequest) {
  return definition.channels.map((channel) => {
    if (channel.scope === "run") return `run:${request.runId}:${channel.id}`;
    if (!request.subject) throw new InvalidSemanticActionError(`Channel ${channel.id} requires an action subject.`);
    return `subject:${request.subject.id}:${channel.id}`;
  }).sort();
}

function requestFailure(
  definition: SemanticActionDefinition,
  request: SemanticActionRequest,
): { readonly code: string; readonly message: string } | null {
  if (definition.status !== "available") {
    return { code: "definition-planned", message: `Action definition ${definition.id} is planned, not available.` };
  }
  if (definition.subject.required && request.subject === null) {
    return { code: "subject-required", message: "This action requires a subject." };
  }
  if (request.subject && definition.subject.entityTypeIds.length > 0
    && !definition.subject.entityTypeIds.includes(request.subject.typeId)) {
    return { code: "subject-type", message: `Subject type ${request.subject.typeId} is not allowed.` };
  }
  if (definition.target.required && request.target === null) {
    return { code: "target-required", message: "This action requires a target." };
  }
  if (request.target) {
    if (request.target.scope.runId !== request.runId) {
      return { code: "target-scope", message: "Target scope belongs to another run." };
    }
    if (definition.target.scopeKinds.length > 0
      && !definition.target.scopeKinds.includes(request.target.scope.kind)) {
      return { code: "target-scope", message: `Target scope ${request.target.scope.kind} is not allowed.` };
    }
    if (definition.target.entityTypeIds.length > 0 && !request.target.entityTypeId) {
      return { code: "target-type", message: "Target entity type is required by this action definition." };
    }
    if (request.target.entityTypeId && definition.target.entityTypeIds.length > 0
      && !definition.target.entityTypeIds.includes(request.target.entityTypeId)) {
      return { code: "target-type", message: `Target entity type ${request.target.entityTypeId} is not allowed.` };
    }
  }
  return null;
}

function freezeState(
  base: SemanticActionRuntimeState,
  working: WorkingState,
  simulationTimeMs: number,
  idempotencyRecords = base.idempotencyRecords,
): SemanticActionRuntimeState {
  return Object.freeze({
    ...base,
    revision: base.revision + 1,
    simulationTimeMs,
    nextActionSequence: working.nextActionSequence,
    nextEventSequence: working.nextEventSequence,
    actions: Object.freeze([...working.actions]),
    idempotencyRecords: Object.freeze([...idempotencyRecords]),
    events: Object.freeze([...working.events]),
  });
}

function nextMilestone(
  actions: readonly SemanticActionInstance[],
  definitions: ReadonlyMap<string, SemanticActionDefinition>,
  throughSimulationTimeMs: number,
): Milestone | undefined {
  const milestones: Milestone[] = [];
  actions.forEach((action) => {
    if (action.status !== "running" && action.status !== "committed") return;
    const definition = definitions.get(action.definitionId);
    if (!definition || action.startedAtSimulationTimeMs === null) return;
    if (action.status === "running") {
      const commitAt = semanticActionCommitTime(action, definition);
      if (commitAt <= throughSimulationTimeMs) {
        milestones.push({ actionId: action.id, actionSequence: action.sequence, type: "commit", atSimulationTimeMs: commitAt });
      }
    }
    const completedAt = action.startedAtSimulationTimeMs + definition.durationMs;
    if (completedAt <= throughSimulationTimeMs) {
      milestones.push({ actionId: action.id, actionSequence: action.sequence, type: "complete", atSimulationTimeMs: completedAt });
    }
    if (definition.timeoutMs !== null) {
      const timeoutAt = action.startedAtSimulationTimeMs + definition.timeoutMs;
      if (timeoutAt <= throughSimulationTimeMs) {
        milestones.push({ actionId: action.id, actionSequence: action.sequence, type: "timeout", atSimulationTimeMs: timeoutAt });
      }
    }
  });
  return milestones.sort((left, right) => (
    left.atSimulationTimeMs - right.atSimulationTimeMs
      || left.actionSequence - right.actionSequence
      || MILESTONE_RANK[left.type] - MILESTONE_RANK[right.type]
  ))[0];
}

export class SemanticActionRuntime {
  readonly #definitions: ReadonlyMap<string, SemanticActionDefinition>;
  readonly #policyEvaluator: SemanticActionPolicyEvaluator | undefined;
  readonly #parameterValidator: SemanticActionParameterValidator | undefined;
  readonly #effectAdapter: SemanticActionEffectAdapter | undefined;
  #state: SemanticActionRuntimeState;

  constructor(input: {
    readonly runId?: string;
    readonly state?: SemanticActionRuntimeState;
    readonly definitions: readonly SemanticActionDefinition[];
    readonly policyEvaluator?: SemanticActionPolicyEvaluator;
    readonly parameterValidator?: SemanticActionParameterValidator;
    readonly effectAdapter?: SemanticActionEffectAdapter;
  }) {
    if (!input.state && !input.runId) throw new InvalidSemanticActionError("runId is required for a new action runtime.");
    input.definitions.forEach(validateSemanticActionDefinition);
    const definitionIds = new Set<string>();
    input.definitions.forEach(({ id }) => {
      if (definitionIds.has(id)) throw new InvalidSemanticActionError(`Duplicate action definition ${id}.`);
      definitionIds.add(id);
    });
    this.#definitions = new Map(input.definitions.map((definition) => [definition.id, definition]));
    this.#state = input.state ?? createSemanticActionRuntimeState(input.runId!);
    this.#policyEvaluator = input.policyEvaluator;
    this.#parameterValidator = input.parameterValidator;
    this.#effectAdapter = input.effectAdapter;
  }

  get state(): SemanticActionRuntimeState {
    return this.#state;
  }

  submit(request: SemanticActionRequest): SemanticActionSubmissionResult {
    if (request.runId !== this.#state.runId) throw new InvalidSemanticActionError("Request belongs to another run.");
    if (!request.actionId || !request.idempotencyKey) {
      throw new InvalidSemanticActionError("actionId and idempotencyKey must not be empty.");
    }
    assertSimulationTime(request.proposedAtSimulationTimeMs, "proposedAtSimulationTimeMs");
    const fingerprint = fingerprintSemanticActionRequest(request);
    const existingRecord = this.#state.idempotencyRecords.find(({ key }) => key === request.idempotencyKey);
    if (existingRecord) {
      if (existingRecord.requestFingerprint !== fingerprint) {
        throw new SemanticActionIdempotencyConflictError(request.idempotencyKey);
      }
      const existingAction = this.#state.actions.find(({ id }) => id === existingRecord.actionId);
      if (!existingAction) throw new InvalidSemanticActionError("Idempotency record references a missing action.");
      return Object.freeze({ state: this.#state, action: existingAction, events: Object.freeze([]), replayed: true });
    }
    if (request.proposedAtSimulationTimeMs !== this.#state.simulationTimeMs) {
      throw new InvalidSemanticActionError("Action requests must use the current authoritative simulation time.");
    }
    assertRevision(this.#state, request.expectedRevision);
    if (this.#state.actions.some(({ id }) => id === request.actionId)) {
      throw new InvalidSemanticActionError(`Action ID ${request.actionId} already exists.`);
    }
    const definition = this.#definitions.get(request.definitionId);
    if (!definition) throw new InvalidSemanticActionError(`Action definition ${request.definitionId} was not found.`);
    if (!Number.isSafeInteger(request.proposedAtSimulationTimeMs + definition.durationMs)
      || (definition.timeoutMs !== null
        && !Number.isSafeInteger(request.proposedAtSimulationTimeMs + definition.timeoutMs))) {
      throw new InvalidSemanticActionError("Action milestones exceed the safe simulation time range.");
    }
    const eventStart = this.#state.events.length;
    const working: WorkingState = {
      actions: [...this.#state.actions],
      events: [...this.#state.events],
      nextActionSequence: this.#state.nextActionSequence + 1,
      nextEventSequence: this.#state.nextEventSequence,
    };
    let action = freezeAction({
      id: request.actionId,
      sequence: this.#state.nextActionSequence,
      runId: request.runId,
      definitionId: definition.id,
      definitionRevision: definition.revision,
      subject: request.subject,
      target: request.target,
      parameters: cloneJsonObject(request.parameters),
      idempotencyKey: request.idempotencyKey,
      requestFingerprint: fingerprint,
      status: "proposed",
      channelKeys: [],
      proposedAtSimulationTimeMs: request.proposedAtSimulationTimeMs,
      startedAtSimulationTimeMs: null,
      committedAtSimulationTimeMs: null,
      endedAtSimulationTimeMs: null,
      compensatedAtSimulationTimeMs: null,
      failure: null,
      revision: 0,
      transitions: [{ status: "proposed", atSimulationTimeMs: request.proposedAtSimulationTimeMs, reason: null }],
    });
    replaceAction(working, action);
    appendLifecycleEvent(working, this.#state, action, request.proposedAtSimulationTimeMs, null);

    let failure = requestFailure(definition, request);
    if (!failure) {
      const schemaKeys = Object.keys(definition.parametersSchema).filter((key) => ![
        "$id",
        "$schema",
        "$comment",
        "title",
        "description",
        "type",
      ].includes(key));
      const requiresParameterValidator = schemaKeys.length > 0;
      if (requiresParameterValidator && !this.#parameterValidator) {
        failure = {
          code: "parameter-validator-unavailable",
          message: "The configured parameter schema requires a validator adapter.",
        };
      } else if (this.#parameterValidator) {
        try {
          const validation = this.#parameterValidator.validate({
            schema: definition.parametersSchema,
            parameters: request.parameters,
          });
          if (!validation.valid) {
            failure = {
              code: "invalid-parameters",
              message: validation.errors.join("; ") || "Action parameters are invalid.",
            };
          }
        } catch {
          failure = { code: "parameter-validation-failed", message: "Action parameter validation failed." };
        }
      }
    }
    if (!failure) {
      const needsPolicy = definition.preconditions.length > 0 || definition.requiredCapabilities.length > 0;
      if (needsPolicy && !this.#policyEvaluator) {
        failure = { code: "policy-evaluator-unavailable", message: "Action policy requirements cannot be evaluated." };
      } else if (this.#policyEvaluator) {
        try {
          const decision = this.#policyEvaluator.evaluate({ request, definition, state: this.#state });
          if (!decision.allowed) {
            const detail = decision.failures.map(({ requirementId, message }) => `${requirementId}: ${message}`).join("; ");
            failure = { code: "policy-denied", message: detail || "Action policy denied the request." };
          }
        } catch {
          failure = { code: "policy-evaluation-failed", message: "Action policy evaluation failed." };
        }
      }
    }

    if (failure) {
      action = transitionAction(action, "failed", request.proposedAtSimulationTimeMs, failure.code, failure);
      replaceAction(working, action);
      appendLifecycleEvent(working, this.#state, action, request.proposedAtSimulationTimeMs, failure.code);
    } else {
      action = freezeAction({ ...action, channelKeys: channelKeysFor(definition, request) });
      action = transitionAction(action, "validated", request.proposedAtSimulationTimeMs, null);
      replaceAction(working, action);
      appendLifecycleEvent(working, this.#state, action, request.proposedAtSimulationTimeMs, null);
      const conflict = activeChannelConflict(this.#state.actions, action.channelKeys);
      if (conflict) {
        failure = { code: "channel-conflict", message: `Action channel is occupied by ${conflict.id}.` };
        action = transitionAction(action, "failed", request.proposedAtSimulationTimeMs, failure.code, failure);
        replaceAction(working, action);
        appendLifecycleEvent(working, this.#state, action, request.proposedAtSimulationTimeMs, failure.code);
      } else {
        action = transitionAction(action, "running", request.proposedAtSimulationTimeMs, null);
        replaceAction(working, action);
        appendLifecycleEvent(working, this.#state, action, request.proposedAtSimulationTimeMs, null);
        this.#processMilestones(working, request.proposedAtSimulationTimeMs);
        action = working.actions.find(({ id }) => id === action.id)!;
      }
    }

    const nextState = freezeState(this.#state, working, this.#state.simulationTimeMs, [
      ...this.#state.idempotencyRecords,
      Object.freeze({ key: request.idempotencyKey, actionId: action.id, requestFingerprint: fingerprint }),
    ]);
    this.#state = nextState;
    return Object.freeze({
      state: nextState,
      action,
      events: Object.freeze(nextState.events.slice(eventStart)),
      replayed: false,
    });
  }

  advance(throughSimulationTimeMs: number, expectedRevision: number): SemanticActionAdvanceResult {
    assertRevision(this.#state, expectedRevision);
    assertSimulationTime(throughSimulationTimeMs, "throughSimulationTimeMs");
    if (throughSimulationTimeMs < this.#state.simulationTimeMs) {
      throw new InvalidSemanticActionError("Action runtime time cannot move backwards.");
    }
    if (throughSimulationTimeMs === this.#state.simulationTimeMs) {
      return Object.freeze({ state: this.#state, events: Object.freeze([]) });
    }
    const eventStart = this.#state.events.length;
    const working: WorkingState = {
      actions: [...this.#state.actions],
      events: [...this.#state.events],
      nextActionSequence: this.#state.nextActionSequence,
      nextEventSequence: this.#state.nextEventSequence,
    };
    this.#processMilestones(working, throughSimulationTimeMs);
    this.#state = freezeState(this.#state, working, throughSimulationTimeMs);
    return Object.freeze({
      state: this.#state,
      events: Object.freeze(this.#state.events.slice(eventStart)),
    });
  }

  cancel(request: SemanticActionCancellationRequest): SemanticActionCancellationResult {
    if (request.runId !== this.#state.runId) throw new InvalidSemanticActionError("Cancellation belongs to another run.");
    assertRevision(this.#state, request.expectedRevision);
    assertSimulationTime(request.requestedAtSimulationTimeMs, "requestedAtSimulationTimeMs");
    if (request.requestedAtSimulationTimeMs !== this.#state.simulationTimeMs) {
      throw new InvalidSemanticActionError("Cancellation must use the current authoritative simulation time.");
    }
    if (!request.reason) throw new InvalidSemanticActionError("Cancellation reason must not be empty.");
    const existing = this.#state.actions.find(({ id }) => id === request.actionId);
    if (!existing) throw new InvalidSemanticActionError(`Action ${request.actionId} was not found.`);
    if (isSemanticActionTerminal(existing.status)) {
      return Object.freeze({
        state: this.#state,
        action: existing,
        events: Object.freeze([]),
        accepted: false,
        rejectionReason: "action-terminal",
      });
    }
    const definition = this.#definitions.get(existing.definitionId)!;
    const afterCommit = existing.status === "committed";
    if ((!afterCommit && definition.cancellation.beforeCommit === "reject")
      || (afterCommit && definition.cancellation.afterCommit.mode === "reject")) {
      return Object.freeze({
        state: this.#state,
        action: existing,
        events: Object.freeze([]),
        accepted: false,
        rejectionReason: afterCommit ? "after-commit-rejected" : "before-commit-rejected",
      });
    }
    const eventStart = this.#state.events.length;
    const working: WorkingState = {
      actions: [...this.#state.actions],
      events: [...this.#state.events],
      nextActionSequence: this.#state.nextActionSequence,
      nextEventSequence: this.#state.nextEventSequence,
    };
    let action = existing;
    if (afterCommit && definition.cancellation.afterCommit.mode === "compensate") {
      if (!this.#effectAdapter) {
        const failure = { code: "compensation-adapter-unavailable", message: "No compensation adapter is configured." };
        action = transitionAction(action, "failed", request.requestedAtSimulationTimeMs, failure.code, failure);
        replaceAction(working, action);
        appendLifecycleEvent(working, this.#state, action, request.requestedAtSimulationTimeMs, failure.code);
        this.#state = freezeState(this.#state, working, this.#state.simulationTimeMs);
        return Object.freeze({
          state: this.#state,
          action,
          events: Object.freeze(this.#state.events.slice(eventStart)),
          accepted: false,
          rejectionReason: failure.code,
        });
      }
      try {
        const effect = this.#effectAdapter.compensate({
          effectId: definition.cancellation.afterCommit.effectId,
          action,
          definition,
          state: this.#state,
        });
        appendDomainEvents(working, this.#state, action, request.requestedAtSimulationTimeMs, effect.events);
        action = freezeAction({
          ...action,
          compensatedAtSimulationTimeMs: request.requestedAtSimulationTimeMs,
          revision: action.revision + 1,
        });
        replaceAction(working, action);
        appendCompensatedEvent(working, this.#state, action, request.requestedAtSimulationTimeMs);
      } catch {
        const failure = { code: "compensation-failed", message: "The configured compensation effect failed." };
        action = transitionAction(action, "failed", request.requestedAtSimulationTimeMs, failure.code, failure);
        replaceAction(working, action);
        appendLifecycleEvent(working, this.#state, action, request.requestedAtSimulationTimeMs, failure.code);
        this.#state = freezeState(this.#state, working, this.#state.simulationTimeMs);
        return Object.freeze({
          state: this.#state,
          action,
          events: Object.freeze(this.#state.events.slice(eventStart)),
          accepted: false,
          rejectionReason: failure.code,
        });
      }
    }
    action = transitionAction(action, "cancelled", request.requestedAtSimulationTimeMs, request.reason);
    replaceAction(working, action);
    appendLifecycleEvent(working, this.#state, action, request.requestedAtSimulationTimeMs, request.reason);
    this.#state = freezeState(this.#state, working, this.#state.simulationTimeMs);
    return Object.freeze({
      state: this.#state,
      action,
      events: Object.freeze(this.#state.events.slice(eventStart)),
      accepted: true,
      rejectionReason: null,
    });
  }

  #processMilestones(working: WorkingState, throughSimulationTimeMs: number) {
    let milestone = nextMilestone(working.actions, this.#definitions, throughSimulationTimeMs);
    while (milestone) {
      let action = working.actions.find(({ id }) => id === milestone!.actionId)!;
      const definition = this.#definitions.get(action.definitionId)!;
      if (milestone.type === "commit") {
        try {
          if (definition.commitEffectId !== null) {
            if (!this.#effectAdapter) throw new Error("effect-adapter-unavailable");
            const effect = this.#effectAdapter.commit({
              effectId: definition.commitEffectId,
              action,
              definition,
              state: this.#state,
            });
            appendDomainEvents(working, this.#state, action, milestone.atSimulationTimeMs, effect.events);
          }
          action = transitionAction(action, "committed", milestone.atSimulationTimeMs, null);
          replaceAction(working, action);
          appendLifecycleEvent(working, this.#state, action, milestone.atSimulationTimeMs, null);
        } catch {
          const failure = { code: "commit-failed", message: "The configured commit effect failed." };
          action = transitionAction(action, "failed", milestone.atSimulationTimeMs, failure.code, failure);
          replaceAction(working, action);
          appendLifecycleEvent(working, this.#state, action, milestone.atSimulationTimeMs, failure.code);
        }
      } else if (milestone.type === "complete") {
        action = transitionAction(action, "completed", milestone.atSimulationTimeMs, null);
        replaceAction(working, action);
        appendLifecycleEvent(working, this.#state, action, milestone.atSimulationTimeMs, null);
      } else {
        const failure = { code: "timeout", message: "Action exceeded its configured timeout." };
        action = transitionAction(action, "failed", milestone.atSimulationTimeMs, failure.code, failure);
        replaceAction(working, action);
        appendLifecycleEvent(working, this.#state, action, milestone.atSimulationTimeMs, failure.code);
      }
      milestone = nextMilestone(working.actions, this.#definitions, throughSimulationTimeMs);
    }
  }
}
