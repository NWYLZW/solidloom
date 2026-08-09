import {
  DECLARATIVE_RULE_SCHEMA_VERSION,
  DEFAULT_RULE_EXECUTION_LIMITS,
  DeclarativeRuntimeIdempotencyConflictError,
  DeclarativeRuntimeOperationError,
  DeclarativeRuntimeRevisionConflictError,
  RuleExecutionBudgetExceededError,
  canonicalDeclarativeRequest,
  cloneRuntimeJsonObject,
  cloneRuntimeJsonValue,
  evaluateRuleCondition,
  evaluateRuleExpression,
  validateDeclarativeRuleDefinitions,
  type DeclarativeEffectTemplate,
  type DeclarativeRuleDefinition,
  type DeclarativeRuleRuntimeState,
  type ResolvedDeclarativeEffect,
  type RuleAuditEntry,
  type RuleDispatchContext,
  type RuleDispatchResult,
  type RuleDispatchTrigger,
  type RuleExecutionLimits,
  type RuleExpressionContext,
  type RuleFieldCatalog,
} from "@solidloom/shared";

const TYPE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9-]*)+$/;
const FIELD_PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
const FORBIDDEN_FIELD_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export interface DeclarativeEffectCommitAdapter {
  commitAtomic(input: {
    readonly runId: string;
    readonly effects: readonly ResolvedDeclarativeEffect[];
  }): void;
}

export interface DeclarativeRuleRuntimeOptions {
  readonly runId: string;
  readonly definitions: readonly DeclarativeRuleDefinition[];
  readonly fieldCatalog: RuleFieldCatalog;
  readonly limits?: RuleExecutionLimits;
  readonly effectAdapter?: DeclarativeEffectCommitAdapter;
  readonly initialState?: DeclarativeRuleRuntimeState;
}

interface QueuedTrigger {
  readonly trigger: RuleDispatchTrigger;
  readonly depth: number;
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

function freezeAudit(entry: RuleAuditEntry): RuleAuditEntry {
  return Object.freeze({ ...entry, effectIds: Object.freeze([...entry.effectIds]) });
}

function freezeRuleState(state: DeclarativeRuleRuntimeState): DeclarativeRuleRuntimeState {
  return Object.freeze({
    ...state,
    dispatches: Object.freeze(state.dispatches.map((record) => Object.freeze({ ...record }))),
    audit: Object.freeze(state.audit.map(freezeAudit)),
  });
}

function createInitialState(runId: string): DeclarativeRuleRuntimeState {
  if (!runId) throw new DeclarativeRuntimeOperationError("invalid-run", "runId 不能为空");
  return freezeRuleState({
    schemaVersion: DECLARATIVE_RULE_SCHEMA_VERSION,
    runId,
    revision: 0,
    nextAuditSequence: 0,
    dispatches: [],
    audit: [],
  });
}

function eventContext(trigger: RuleDispatchTrigger): Readonly<Record<string, import("@solidloom/shared").RuntimeJsonValue>> {
  if (trigger.kind === "event") {
    return Object.freeze({
      id: trigger.id,
      idempotencyKey: trigger.idempotencyKey,
      runId: trigger.runId,
      kind: trigger.kind,
      typeId: trigger.typeId,
      simulationTimeMs: trigger.simulationTimeMs,
      payload: trigger.payload,
    });
  }
  return Object.freeze({
    id: trigger.id,
    idempotencyKey: trigger.idempotencyKey,
    runId: trigger.runId,
    kind: trigger.kind,
    scheduleId: trigger.scheduleId,
    simulationTimeMs: trigger.simulationTimeMs,
    payload: trigger.payload,
  });
}

function expressionContext(trigger: RuleDispatchTrigger, context: RuleDispatchContext): RuleExpressionContext {
  return Object.freeze({
    event: eventContext(trigger),
    state: context.state,
    process: context.process,
    variables: context.variables,
  });
}

function assertResolvedString(
  arguments_: import("@solidloom/shared").RuntimeJsonObject,
  name: string,
  options: { readonly typeId?: boolean; readonly fieldPath?: boolean } = {},
) {
  const value = arguments_[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new DeclarativeRuntimeOperationError("invalid-effect-argument", `效果参数 ${name} 必须是非空字符串`);
  }
  if (options.typeId && !TYPE_ID_PATTERN.test(value)) {
    throw new DeclarativeRuntimeOperationError("invalid-effect-argument", `效果参数 ${name} 必须是带命名空间的类型 ID`);
  }
  if (options.fieldPath && (!FIELD_PATH_PATTERN.test(value)
    || value.split(".").some((segment) => FORBIDDEN_FIELD_SEGMENTS.has(segment)))) {
    throw new DeclarativeRuntimeOperationError("invalid-effect-argument", `效果参数 ${name} 不是安全字段路径`);
  }
}

function assertResolvedNumber(
  arguments_: import("@solidloom/shared").RuntimeJsonObject,
  name: string,
  positive = false,
) {
  const value = arguments_[name];
  if (typeof value !== "number" || !Number.isFinite(value) || (positive && value <= 0)) {
    throw new DeclarativeRuntimeOperationError(
      "invalid-effect-argument",
      `效果参数 ${name} 必须是${positive ? "正" : "有限"}数值`,
    );
  }
}

function assertResolvedObject(arguments_: import("@solidloom/shared").RuntimeJsonObject, name: string) {
  const value = arguments_[name];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DeclarativeRuntimeOperationError("invalid-effect-argument", `效果参数 ${name} 必须是 JSON 对象`);
  }
}

function validateResolvedEffect(effect: ResolvedDeclarativeEffect) {
  const arguments_ = effect.arguments;
  switch (effect.kind) {
    case "component.set":
      assertResolvedString(arguments_, "entityId");
      assertResolvedString(arguments_, "componentTypeId", { typeId: true });
      assertResolvedString(arguments_, "fieldPath", { fieldPath: true });
      break;
    case "component.increment":
      assertResolvedString(arguments_, "entityId");
      assertResolvedString(arguments_, "componentTypeId", { typeId: true });
      assertResolvedString(arguments_, "fieldPath", { fieldPath: true });
      assertResolvedNumber(arguments_, "delta");
      break;
    case "relation.add":
      assertResolvedString(arguments_, "relationTypeId", { typeId: true });
      assertResolvedString(arguments_, "sourceEntityId");
      assertResolvedString(arguments_, "targetEntityId");
      assertResolvedObject(arguments_, "attributes");
      break;
    case "relation.remove":
      assertResolvedString(arguments_, "relationId");
      break;
    case "resource.reserve":
      assertResolvedString(arguments_, "accountId");
      assertResolvedNumber(arguments_, "amount", true);
      assertResolvedString(arguments_, "reservationId");
      break;
    case "resource.commit":
    case "resource.release":
      assertResolvedString(arguments_, "accountId");
      assertResolvedString(arguments_, "reservationId");
      break;
    case "resource.transfer":
      assertResolvedString(arguments_, "sourceAccountId");
      assertResolvedString(arguments_, "targetAccountId");
      assertResolvedNumber(arguments_, "amount", true);
      break;
    case "metric.increment":
      assertResolvedString(arguments_, "metricTypeId", { typeId: true });
      assertResolvedString(arguments_, "scopeId");
      assertResolvedNumber(arguments_, "delta");
      break;
    case "process.start":
      assertResolvedString(arguments_, "definitionId", { typeId: true });
      assertResolvedString(arguments_, "processId");
      assertResolvedObject(arguments_, "variables");
      break;
    case "process.pause":
    case "process.cancel":
      assertResolvedString(arguments_, "processId");
      assertResolvedString(arguments_, "reason");
      break;
    case "entity.create":
      assertResolvedString(arguments_, "entityTypeId", { typeId: true });
      assertResolvedString(arguments_, "entityId");
      assertResolvedObject(arguments_, "components");
      break;
    case "entity.destroy":
      assertResolvedString(arguments_, "entityId");
      break;
    case "event.emit":
      assertResolvedString(arguments_, "typeId", { typeId: true });
      assertResolvedObject(arguments_, "payload");
      break;
  }
}

export function resolveDeclarativeEffects(input: {
  readonly templates: readonly DeclarativeEffectTemplate[];
  readonly sourceKind: "rule" | "process";
  readonly sourceDefinitionId: string;
  readonly sourceInstanceId: string;
  readonly sourceTriggerId: string;
  readonly context: RuleExpressionContext;
  readonly maxEvaluationSteps: number;
}): readonly ResolvedDeclarativeEffect[] {
  return Object.freeze(input.templates.map((template) => {
    const resolvedArguments: Record<string, import("@solidloom/shared").RuntimeJsonValue> = {};
    Object.entries(template.arguments).forEach(([name, expression]) => {
      resolvedArguments[name] = cloneRuntimeJsonValue(
        evaluateRuleExpression(expression, input.context, input.maxEvaluationSteps),
      );
    });
    const resolved = Object.freeze({
      id: `${input.sourceTriggerId}:${input.sourceDefinitionId}:${template.id}`,
      sourceKind: input.sourceKind,
      sourceDefinitionId: input.sourceDefinitionId,
      sourceInstanceId: input.sourceInstanceId,
      sourceTriggerId: input.sourceTriggerId,
      kind: template.kind,
      arguments: Object.freeze(resolvedArguments),
    });
    validateResolvedEffect(resolved);
    return resolved;
  }));
}

function matchesTrigger(definition: DeclarativeRuleDefinition, trigger: RuleDispatchTrigger) {
  return definition.trigger.kind === trigger.kind
    && (trigger.kind === "event"
      ? definition.trigger.kind === "event" && definition.trigger.typeId === trigger.typeId
      : definition.trigger.kind === "schedule" && definition.trigger.scheduleId === trigger.scheduleId);
}

function emittedTrigger(
  effect: ResolvedDeclarativeEffect,
  source: RuleDispatchTrigger,
): RuleDispatchTrigger | null {
  if (effect.kind !== "event.emit") return null;
  const typeId = effect.arguments.typeId;
  const payload = effect.arguments.payload;
  if (typeof typeId !== "string" || !TYPE_ID_PATTERN.test(typeId)) {
    throw new DeclarativeRuntimeOperationError("invalid-emitted-event", "event.emit typeId 必须是带命名空间的字符串");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new DeclarativeRuntimeOperationError("invalid-emitted-event", "event.emit payload 必须是 JSON 对象");
  }
  return Object.freeze({
    kind: "event",
    id: effect.id,
    idempotencyKey: effect.id,
    runId: source.runId,
    typeId,
    simulationTimeMs: source.simulationTimeMs,
    payload: cloneRuntimeJsonObject(payload as import("@solidloom/shared").RuntimeJsonObject),
  });
}

function triggerFingerprint(trigger: RuleDispatchTrigger) {
  const { idempotencyKey: _idempotencyKey, ...semanticTrigger } = trigger;
  return canonicalDeclarativeRequest(semanticTrigger);
}

export class DeclarativeRuleRuntime {
  readonly #definitions: readonly DeclarativeRuleDefinition[];
  readonly #limits: RuleExecutionLimits;
  readonly #effectAdapter: DeclarativeEffectCommitAdapter | undefined;
  #state: DeclarativeRuleRuntimeState;

  constructor(options: DeclarativeRuleRuntimeOptions) {
    this.#limits = Object.freeze({ ...(options.limits ?? DEFAULT_RULE_EXECUTION_LIMITS) });
    validateDeclarativeRuleDefinitions(options.definitions, options.fieldCatalog, this.#limits);
    this.#definitions = Object.freeze([...options.definitions].sort((left, right) => (
      right.priority - left.priority || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    )));
    this.#effectAdapter = options.effectAdapter;
    this.#state = options.initialState ? freezeRuleState(options.initialState) : createInitialState(options.runId);
    if (this.#state.runId !== options.runId) {
      throw new DeclarativeRuntimeOperationError("run-mismatch", "初始规则状态不属于当前 runId");
    }
  }

  get state(): DeclarativeRuleRuntimeState {
    return this.#state;
  }

  dispatch(
    trigger: RuleDispatchTrigger,
    expectedRevision: number,
    context: RuleDispatchContext,
  ): RuleDispatchResult {
    if (!trigger.id || !trigger.idempotencyKey) {
      throw new DeclarativeRuntimeOperationError("invalid-trigger", "触发 ID 和幂等键不能为空");
    }
    if (trigger.runId !== this.#state.runId) {
      throw new DeclarativeRuntimeOperationError("run-mismatch", "触发不属于当前运行实例");
    }
    if (trigger.kind === "event" && !TYPE_ID_PATTERN.test(trigger.typeId)) {
      throw new DeclarativeRuntimeOperationError("invalid-trigger", "事件 typeId 必须是带命名空间的类型 ID");
    }
    if (trigger.kind === "schedule" && !TYPE_ID_PATTERN.test(trigger.scheduleId)) {
      throw new DeclarativeRuntimeOperationError("invalid-trigger", "scheduleId 必须是带命名空间的类型 ID");
    }
    assertSafeTime(trigger.simulationTimeMs, "trigger.simulationTimeMs");
    const fingerprint = triggerFingerprint(trigger);
    const existing = this.#state.dispatches.find(({ idempotencyKey }) => idempotencyKey === trigger.idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new DeclarativeRuntimeIdempotencyConflictError(trigger.idempotencyKey);
      }
      return Object.freeze({ state: this.#state, effects: Object.freeze([]), audit: Object.freeze([]), replayed: true });
    }
    assertRevision(this.#state.revision, expectedRevision);

    const queue: QueuedTrigger[] = [{ trigger, depth: 0 }];
    const effects: ResolvedDeclarativeEffect[] = [];
    const audit: RuleAuditEntry[] = [];
    const firings = new Map<string, number>();
    let triggerCount = 0;
    let firingCount = 0;
    let nextAuditSequence = this.#state.nextAuditSequence;

    while (queue.length > 0) {
      const current = queue.shift()!;
      triggerCount += 1;
      if (triggerCount > this.#limits.maxTriggers) throw new RuleExecutionBudgetExceededError("maxTriggers");
      if (current.depth > this.#limits.maxCascadeDepth) throw new RuleExecutionBudgetExceededError("maxCascadeDepth");

      for (const definition of this.#definitions) {
        if (!matchesTrigger(definition, current.trigger)) continue;
        let outcome: RuleAuditEntry["outcome"];
        let resolved: readonly ResolvedDeclarativeEffect[] = [];
        if (definition.status === "planned") {
          outcome = "planned-skipped";
        } else {
          const evaluationContext = expressionContext(current.trigger, context);
          if (!evaluateRuleCondition(definition.condition, evaluationContext, this.#limits.maxEvaluationSteps)) {
            outcome = "condition-false";
          } else {
            const ruleFirings = (firings.get(definition.id) ?? 0) + 1;
            if (ruleFirings > definition.maxFiringsPerDispatch) {
              throw new RuleExecutionBudgetExceededError(`rule:${definition.id}:maxFiringsPerDispatch`);
            }
            firings.set(definition.id, ruleFirings);
            firingCount += 1;
            if (firingCount > this.#limits.maxRuleFirings) {
              throw new RuleExecutionBudgetExceededError("maxRuleFirings");
            }
            resolved = resolveDeclarativeEffects({
              templates: definition.effects,
              sourceKind: "rule",
              sourceDefinitionId: definition.id,
              sourceInstanceId: definition.id,
              sourceTriggerId: current.trigger.id,
              context: evaluationContext,
              maxEvaluationSteps: this.#limits.maxEvaluationSteps,
            });
            if (effects.length + resolved.length > this.#limits.maxEffects) {
              throw new RuleExecutionBudgetExceededError("maxEffects");
            }
            effects.push(...resolved);
            for (const effect of resolved) {
              const generated = emittedTrigger(effect, current.trigger);
              if (generated) queue.push({ trigger: generated, depth: current.depth + 1 });
            }
            outcome = "fired";
          }
        }
        audit.push(freezeAudit({
          sequence: nextAuditSequence,
          triggerId: current.trigger.id,
          ruleDefinitionId: definition.id,
          outcome,
          simulationTimeMs: current.trigger.simulationTimeMs,
          effectIds: resolved.map(({ id }) => id),
        }));
        nextAuditSequence += 1;
      }
    }

    if (effects.length > 0) {
      if (!this.#effectAdapter) {
        throw new DeclarativeRuntimeOperationError(
          "effect-adapter-required",
          "规则效果需要原子提交适配器；未接入的能力不能视为已执行",
        );
      }
      this.#effectAdapter.commitAtomic({ runId: this.#state.runId, effects: Object.freeze(effects) });
    }

    this.#state = freezeRuleState({
      ...this.#state,
      revision: this.#state.revision + 1,
      nextAuditSequence,
      dispatches: [...this.#state.dispatches, Object.freeze({
        idempotencyKey: trigger.idempotencyKey,
        triggerId: trigger.id,
        fingerprint,
      })],
      audit: [...this.#state.audit, ...audit],
    });
    return Object.freeze({
      state: this.#state,
      effects: Object.freeze(effects),
      audit: Object.freeze(audit),
      replayed: false,
    });
  }
}
