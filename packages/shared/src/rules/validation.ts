import type { RuntimeJsonObject, RuntimeJsonValue } from "../runtime/domain.js";
import { RuleContractValidationError, type RuleContractValidationIssue } from "./errors.js";
import {
  PROCESS_STAGE_KINDS,
  PROCESS_TRANSITION_TRIGGERS,
  RULE_ARITHMETIC_OPERATORS,
  RULE_COMPARE_OPERATORS,
  RULE_EFFECT_KINDS,
  RULE_EXPRESSION_ROOTS,
  type DeclarativeEffectTemplate,
  type DeclarativeProcessDefinition,
  type DeclarativeRuleDefinition,
  type RuleEffectKind,
  type RuleExecutionLimits,
  type RuleExpression,
  type RuleFieldCatalog,
} from "./types.js";

const TYPE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9-]*)+$/;
const FIELD_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export const DEFAULT_RULE_EXECUTION_LIMITS: RuleExecutionLimits = Object.freeze({
  maxNodes: 256,
  maxDepth: 24,
  maxEvaluationSteps: 512,
  maxCascadeDepth: 8,
  maxTriggers: 128,
  maxRuleFirings: 256,
  maxEffects: 1_024,
});

export const EMPTY_RULE_FIELD_CATALOG: RuleFieldCatalog = Object.freeze({
  event: Object.freeze([]),
  state: Object.freeze([]),
  process: Object.freeze([]),
  variables: Object.freeze([]),
});

const EFFECT_ARGUMENTS: Readonly<Record<RuleEffectKind, {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}>> = Object.freeze({
  "component.set": { required: ["entityId", "componentTypeId", "fieldPath", "value"], optional: [] },
  "component.increment": { required: ["entityId", "componentTypeId", "fieldPath", "delta"], optional: [] },
  "relation.add": { required: ["relationTypeId", "sourceEntityId", "targetEntityId", "attributes"], optional: [] },
  "relation.remove": { required: ["relationId"], optional: [] },
  "resource.reserve": { required: ["accountId", "amount", "reservationId"], optional: [] },
  "resource.commit": { required: ["accountId", "reservationId"], optional: [] },
  "resource.release": { required: ["accountId", "reservationId"], optional: [] },
  "resource.transfer": { required: ["sourceAccountId", "targetAccountId", "amount"], optional: [] },
  "metric.increment": { required: ["metricTypeId", "scopeId", "delta"], optional: [] },
  "process.start": { required: ["definitionId", "processId", "variables"], optional: [] },
  "process.pause": { required: ["processId", "reason"], optional: [] },
  "process.cancel": { required: ["processId", "reason"], optional: [] },
  "entity.create": { required: ["entityTypeId", "entityId", "components"], optional: [] },
  "entity.destroy": { required: ["entityId"], optional: [] },
  "event.emit": { required: ["typeId", "payload"], optional: [] },
});

function addIssue(
  issues: RuleContractValidationIssue[],
  code: RuleContractValidationIssue["code"],
  path: string,
  message: string,
) {
  issues.push({ code, path, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateString(
  value: unknown,
  path: string,
  issues: RuleContractValidationIssue[],
  typeId = false,
): value is string {
  if (typeof value !== "string" || value.length === 0) {
    addIssue(issues, "invalid-value", path, `${path} 必须是非空字符串`);
    return false;
  }
  if (typeId && !TYPE_ID_PATTERN.test(value)) {
    addIssue(issues, "invalid-value", path, `${path} 必须是带命名空间的类型 ID`);
    return false;
  }
  return true;
}

function validateSafeInteger(
  value: unknown,
  path: string,
  issues: RuleContractValidationIssue[],
  minimum = 0,
) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    addIssue(issues, "invalid-value", path, `${path} 必须是不小于 ${minimum} 的安全整数`);
    return false;
  }
  return true;
}

function validateJson(value: unknown, path: string, issues: RuleContractValidationIssue[], ancestors = new Set<object>()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) addIssue(issues, "invalid-value", path, `${path} 必须是有限数值`);
    return;
  }
  if (typeof value !== "object") {
    addIssue(issues, "invalid-value", path, `${path} 必须是 JSON 值`);
    return;
  }
  if (ancestors.has(value)) {
    addIssue(issues, "invalid-structure", path, `${path} 不能包含循环引用`);
    return;
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJson(item, `${path}[${index}]`, issues, ancestors));
  } else {
    Object.entries(value).forEach(([key, item]) => {
      if (FORBIDDEN_PATH_SEGMENTS.has(key)) {
        addIssue(issues, "unsafe-field", `${path}.${key}`, `${path} 包含不安全的对象键 ${key}`);
        return;
      }
      validateJson(item, `${path}.${key}`, issues, ancestors);
    });
  }
  ancestors.delete(value);
}

function validateExpression(
  expression: RuleExpression,
  catalog: RuleFieldCatalog,
  limits: RuleExecutionLimits,
  path: string,
  issues: RuleContractValidationIssue[],
  depth = 1,
  counter = { nodes: 0 },
) {
  counter.nodes += 1;
  if (counter.nodes > limits.maxNodes) {
    addIssue(issues, "invalid-value", path, `${path} 节点数超过 ${limits.maxNodes}`);
    return;
  }
  if (depth > limits.maxDepth) {
    addIssue(issues, "invalid-value", path, `${path} 深度超过 ${limits.maxDepth}`);
    return;
  }
  if (!isRecord(expression) || typeof expression.kind !== "string") {
    addIssue(issues, "invalid-structure", path, `${path} 必须是表达式 AST 节点`);
    return;
  }
  switch (expression.kind) {
    case "literal":
      validateJson(expression.value, `${path}.value`, issues);
      return;
    case "path": { // Fields must be declared by the domain package before evaluation.
      if (!RULE_EXPRESSION_ROOTS.includes(expression.root)) {
        addIssue(issues, "invalid-value", `${path}.root`, `${path}.root 不是受支持的根`);
        return;
      }
      if (!Array.isArray(expression.path) || expression.path.length === 0) {
        addIssue(issues, "invalid-value", `${path}.path`, `${path}.path 不能为空`);
        return;
      }
      const segments = expression.path as readonly unknown[];
      const validSegments = segments.every((segment, index) => {
        if (typeof segment !== "string" || !FIELD_SEGMENT_PATTERN.test(segment)
          || FORBIDDEN_PATH_SEGMENTS.has(segment)) {
          addIssue(issues, "unsafe-field", `${path}.path[${index}]`, `${path}.path 包含非法字段段`);
          return false;
        }
        return true;
      });
      const fieldPath = validSegments ? (segments as readonly string[]).join(".") : "";
      if (validSegments && !catalog[expression.root].includes(fieldPath)) {
        addIssue(
          issues,
          "unsafe-field",
          `${path}.path`,
          `字段 ${expression.root}.${fieldPath} 未在允许字段目录中声明`,
        );
      }
      return;
    }
    case "not":
      validateExpression(expression.operand, catalog, limits, `${path}.operand`, issues, depth + 1, counter);
      return;
    case "all":
    case "any":
      if (!Array.isArray(expression.operands) || expression.operands.length === 0) {
        addIssue(issues, "invalid-value", `${path}.operands`, `${path}.operands 不能为空`);
        return;
      }
      expression.operands.forEach((operand, index) => {
        validateExpression(operand, catalog, limits, `${path}.operands[${index}]`, issues, depth + 1, counter);
      });
      return;
    case "compare":
      if (!RULE_COMPARE_OPERATORS.includes(expression.operator)) {
        addIssue(issues, "invalid-value", `${path}.operator`, `${path}.operator 不受支持`);
      }
      validateExpression(expression.left, catalog, limits, `${path}.left`, issues, depth + 1, counter);
      validateExpression(expression.right, catalog, limits, `${path}.right`, issues, depth + 1, counter);
      return;
    case "arithmetic":
      if (!RULE_ARITHMETIC_OPERATORS.includes(expression.operator)) {
        addIssue(issues, "invalid-value", `${path}.operator`, `${path}.operator 不受支持`);
      }
      validateExpression(expression.left, catalog, limits, `${path}.left`, issues, depth + 1, counter);
      validateExpression(expression.right, catalog, limits, `${path}.right`, issues, depth + 1, counter);
      return;
    default:
      addIssue(issues, "invalid-value", `${path}.kind`, `${path}.kind 不受支持`);
  }
}

function validateEffects(
  effects: readonly DeclarativeEffectTemplate[],
  catalog: RuleFieldCatalog,
  limits: RuleExecutionLimits,
  path: string,
  issues: RuleContractValidationIssue[],
) {
  if (!Array.isArray(effects)) {
    addIssue(issues, "invalid-structure", path, `${path} 必须是数组`);
    return;
  }
  const ids = new Set<string>();
  effects.forEach((effect, index) => {
    const effectPath = `${path}[${index}]`;
    if (!isRecord(effect)) {
      addIssue(issues, "invalid-structure", effectPath, `${effectPath} 必须是效果对象`);
      return;
    }
    if (validateString(effect.id, `${effectPath}.id`, issues)) {
      if (ids.has(effect.id)) addIssue(issues, "duplicate-id", `${effectPath}.id`, `效果 ID ${effect.id} 重复`);
      ids.add(effect.id);
    }
    if (!RULE_EFFECT_KINDS.includes(effect.kind as RuleEffectKind)) {
      addIssue(issues, "invalid-value", `${effectPath}.kind`, `${effectPath}.kind 不受支持`);
      return;
    }
    if (!isRecord(effect.arguments)) {
      addIssue(issues, "invalid-structure", `${effectPath}.arguments`, `${effectPath}.arguments 必须是对象`);
      return;
    }
    const specification = EFFECT_ARGUMENTS[effect.kind as RuleEffectKind];
    const allowed = new Set([...specification.required, ...specification.optional]);
    specification.required.forEach((name) => {
      if (!Object.prototype.hasOwnProperty.call(effect.arguments, name)) {
        addIssue(issues, "invalid-structure", `${effectPath}.arguments.${name}`, `缺少效果参数 ${name}`);
      }
    });
    Object.entries(effect.arguments).forEach(([name, expression]) => {
      if (!allowed.has(name)) {
        addIssue(issues, "invalid-structure", `${effectPath}.arguments.${name}`, `效果参数 ${name} 不受支持`);
        return;
      }
      validateExpression(expression as RuleExpression, catalog, limits, `${effectPath}.arguments.${name}`, issues);
    });
    if (effect.kind === "event.emit") {
      const typeExpression = effect.arguments.typeId as RuleExpression | undefined;
      if (typeExpression?.kind === "literal"
        && (typeof typeExpression.value !== "string" || !TYPE_ID_PATTERN.test(typeExpression.value))) {
        addIssue(issues, "invalid-value", `${effectPath}.arguments.typeId`, "event.emit 的字面量 typeId 必须带命名空间");
      }
    }
    if (effect.kind === "component.set" || effect.kind === "component.increment") {
      const fieldExpression = effect.arguments.fieldPath as RuleExpression | undefined;
      const value = fieldExpression?.kind === "literal" ? fieldExpression.value : null;
      const validPath = typeof value === "string" && value.length > 0
        && value.split(".").every((segment) => FIELD_SEGMENT_PATTERN.test(segment)
          && !FORBIDDEN_PATH_SEGMENTS.has(segment));
      if (!validPath) {
        addIssue(
          issues,
          "unsafe-field",
          `${effectPath}.arguments.fieldPath`,
          "组件写入 fieldPath 必须是静态、安全的字段路径；具体 schema 仍由效果适配器校验",
        );
      }
    }
  });
}

function validateDefinitionBase(
  definition: { readonly id: unknown; readonly domainPackageId: unknown; readonly displayName: unknown;
    readonly description: unknown; readonly revision: unknown; readonly status: unknown },
  path: string,
  issues: RuleContractValidationIssue[],
) {
  validateString(definition.id, `${path}.id`, issues, true);
  validateString(definition.domainPackageId, `${path}.domainPackageId`, issues);
  validateString(definition.displayName, `${path}.displayName`, issues);
  validateString(definition.description, `${path}.description`, issues);
  validateSafeInteger(definition.revision, `${path}.revision`, issues);
  if (definition.status !== "available" && definition.status !== "planned") {
    addIssue(issues, "invalid-value", `${path}.status`, `${path}.status 必须是 available 或 planned`);
  }
}

function literalEmittedEventTypes(definition: DeclarativeRuleDefinition): readonly string[] {
  return definition.effects.flatMap((effect) => {
    if (effect.kind !== "event.emit") return [];
    const expression = effect.arguments.typeId;
    return expression?.kind === "literal" && typeof expression.value === "string" ? [expression.value] : [];
  });
}

function detectEventCycles(definitions: readonly DeclarativeRuleDefinition[], issues: RuleContractValidationIssue[]) {
  const graph = new Map<string, Set<string>>();
  definitions.forEach((definition) => {
    if (definition.trigger.kind !== "event") return;
    const targets = graph.get(definition.trigger.typeId) ?? new Set<string>();
    literalEmittedEventTypes(definition).forEach((target) => targets.add(target));
    graph.set(definition.trigger.typeId, targets);
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string, trail: readonly string[]): boolean => {
    if (visiting.has(node)) {
      addIssue(issues, "cycle", "definitions", `事件规则存在直接触发环：${[...trail, node].join(" -> ")}`);
      return true;
    }
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const target of graph.get(node) ?? []) {
      if (graph.has(target) && visit(target, [...trail, node])) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  for (const node of graph.keys()) {
    if (visit(node, [])) break;
  }
}

function validateLimits(limits: RuleExecutionLimits, issues: RuleContractValidationIssue[]) {
  (Object.entries(limits) as readonly [keyof RuleExecutionLimits, number][]).forEach(([key, value]) => {
    validateSafeInteger(value, `limits.${key}`, issues, 1);
  });
}

export function validateDeclarativeRuleDefinitions(
  definitions: readonly DeclarativeRuleDefinition[],
  catalog: RuleFieldCatalog,
  limits: RuleExecutionLimits = DEFAULT_RULE_EXECUTION_LIMITS,
) {
  const issues: RuleContractValidationIssue[] = [];
  validateLimits(limits, issues);
  const ids = new Set<string>();
  definitions.forEach((definition, index) => {
    const path = `definitions[${index}]`;
    validateDefinitionBase(definition, path, issues);
    if (ids.has(definition.id)) addIssue(issues, "duplicate-id", `${path}.id`, `规则 ID ${definition.id} 重复`);
    ids.add(definition.id);
    if (!Number.isSafeInteger(definition.priority)) {
      addIssue(issues, "invalid-value", `${path}.priority`, `${path}.priority 必须是安全整数`);
    }
    validateSafeInteger(definition.maxFiringsPerDispatch, `${path}.maxFiringsPerDispatch`, issues, 1);
    if (definition.maxFiringsPerDispatch > limits.maxRuleFirings) {
      addIssue(issues, "invalid-value", `${path}.maxFiringsPerDispatch`, "单规则触发上限不能超过全局触发上限");
    }
    if (definition.trigger.kind === "event") {
      validateString(definition.trigger.typeId, `${path}.trigger.typeId`, issues, true);
    } else if (definition.trigger.kind === "schedule") {
      validateString(definition.trigger.scheduleId, `${path}.trigger.scheduleId`, issues, true);
    } else {
      addIssue(issues, "invalid-value", `${path}.trigger.kind`, `${path}.trigger.kind 不受支持`);
    }
    if (definition.condition !== null) {
      validateExpression(definition.condition, catalog, limits, `${path}.condition`, issues);
    }
    if (definition.effects.length === 0) {
      addIssue(issues, "invalid-value", `${path}.effects`, "规则至少需要一个声明式效果");
    }
    validateEffects(definition.effects, catalog, limits, `${path}.effects`, issues);
  });
  detectEventCycles(definitions, issues);
  if (issues.length > 0) throw new RuleContractValidationError(issues);
}

function isLiteralTrue(expression: RuleExpression | null) {
  return expression?.kind === "literal" && expression.value === true;
}

function detectUnconditionalProcessCycles(
  definition: DeclarativeProcessDefinition,
  issues: RuleContractValidationIssue[],
  path: string,
) {
  const graph = new Map<string, Set<string>>();
  definition.transitions.forEach((transition) => {
    if (transition.trigger !== "condition" || !isLiteralTrue(transition.condition)) return;
    const targets = graph.get(transition.fromStageId) ?? new Set<string>();
    targets.add(transition.toStageId);
    graph.set(transition.fromStageId, targets);
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (stageId: string): boolean => {
    if (visiting.has(stageId)) return true;
    if (visited.has(stageId)) return false;
    visiting.add(stageId);
    for (const target of graph.get(stageId) ?? []) if (visit(target)) return true;
    visiting.delete(stageId);
    visited.add(stageId);
    return false;
  };
  if ([...graph.keys()].some(visit)) {
    addIssue(issues, "cycle", `${path}.transitions`, "流程存在无条件自动转移环");
  }
}

export function validateDeclarativeProcessDefinitions(
  definitions: readonly DeclarativeProcessDefinition[],
  catalog: RuleFieldCatalog,
  limits: RuleExecutionLimits = DEFAULT_RULE_EXECUTION_LIMITS,
) {
  const issues: RuleContractValidationIssue[] = [];
  validateLimits(limits, issues);
  const definitionIds = new Set<string>();
  definitions.forEach((definition, definitionIndex) => {
    const path = `definitions[${definitionIndex}]`;
    validateDefinitionBase(definition, path, issues);
    if (definitionIds.has(definition.id)) addIssue(issues, "duplicate-id", `${path}.id`, `流程 ID ${definition.id} 重复`);
    definitionIds.add(definition.id);
    validateSafeInteger(definition.maxTransitionsPerAdvance, `${path}.maxTransitionsPerAdvance`, issues, 1);
    if (definition.maxTransitionsPerAdvance > limits.maxRuleFirings) {
      addIssue(issues, "invalid-value", `${path}.maxTransitionsPerAdvance`, "单次流程转移上限不能超过全局触发上限");
    }

    const slotIds = new Set<string>();
    definition.participantSlots.forEach((slot, index) => {
      const slotPath = `${path}.participantSlots[${index}]`;
      if (validateString(slot.id, `${slotPath}.id`, issues)) {
        if (slotIds.has(slot.id)) addIssue(issues, "duplicate-id", `${slotPath}.id`, `参与槽位 ${slot.id} 重复`);
        slotIds.add(slot.id);
      }
      const entityTypes = new Set<string>();
      slot.entityTypeIds.forEach((typeId, typeIndex) => {
        validateString(typeId, `${slotPath}.entityTypeIds[${typeIndex}]`, issues, true);
        if (entityTypes.has(typeId)) addIssue(issues, "duplicate-id", `${slotPath}.entityTypeIds[${typeIndex}]`, `实体类型 ${typeId} 重复`);
        entityTypes.add(typeId);
      });
    });

    const stageIds = new Set<string>();
    definition.stages.forEach((stage, index) => {
      const stagePath = `${path}.stages[${index}]`;
      if (validateString(stage.id, `${stagePath}.id`, issues)) {
        if (stageIds.has(stage.id)) addIssue(issues, "duplicate-id", `${stagePath}.id`, `阶段 ${stage.id} 重复`);
        stageIds.add(stage.id);
      }
      if (!PROCESS_STAGE_KINDS.includes(stage.kind)) {
        addIssue(issues, "invalid-value", `${stagePath}.kind`, `${stagePath}.kind 不受支持`);
      }
      if (stage.timeoutMs !== null) validateSafeInteger(stage.timeoutMs, `${stagePath}.timeoutMs`, issues, 1);
      if (stage.enterCondition !== null) validateExpression(stage.enterCondition, catalog, limits, `${stagePath}.enterCondition`, issues);
      if (stage.exitCondition !== null) validateExpression(stage.exitCondition, catalog, limits, `${stagePath}.exitCondition`, issues);
      validateEffects(stage.enterEffects, catalog, limits, `${stagePath}.enterEffects`, issues);
      validateEffects(stage.exitEffects, catalog, limits, `${stagePath}.exitEffects`, issues);
      validateEffects(stage.timeoutEffects, catalog, limits, `${stagePath}.timeoutEffects`, issues);
      validateEffects(stage.compensationEffects, catalog, limits, `${stagePath}.compensationEffects`, issues);
      if (stage.kind !== "active" && stage.timeoutMs !== null) {
        addIssue(issues, "invalid-value", `${stagePath}.timeoutMs`, "终态阶段不能设置超时");
      }
    });
    if (definition.stages.length === 0) addIssue(issues, "invalid-value", `${path}.stages`, "流程阶段不能为空");
    if (!stageIds.has(definition.initialStageId)) {
      addIssue(issues, "unknown-reference", `${path}.initialStageId`, `初始阶段 ${definition.initialStageId} 不存在`);
    } else if (definition.stages.find(({ id }) => id === definition.initialStageId)?.kind !== "active") {
      addIssue(issues, "invalid-value", `${path}.initialStageId`, "初始阶段必须是 active");
    }
    if (!definition.stages.some(({ kind }) => kind === "completed" || kind === "failed")) {
      addIssue(issues, "invalid-value", `${path}.stages`, "流程至少需要一个终态阶段");
    }

    const transitionIds = new Set<string>();
    definition.transitions.forEach((transition, index) => {
      const transitionPath = `${path}.transitions[${index}]`;
      if (validateString(transition.id, `${transitionPath}.id`, issues)) {
        if (transitionIds.has(transition.id)) addIssue(issues, "duplicate-id", `${transitionPath}.id`, `转移 ${transition.id} 重复`);
        transitionIds.add(transition.id);
      }
      if (!stageIds.has(transition.fromStageId)) {
        addIssue(issues, "unknown-reference", `${transitionPath}.fromStageId`, `源阶段 ${transition.fromStageId} 不存在`);
      }
      if (!stageIds.has(transition.toStageId)) {
        addIssue(issues, "unknown-reference", `${transitionPath}.toStageId`, `目标阶段 ${transition.toStageId} 不存在`);
      }
      if (!PROCESS_TRANSITION_TRIGGERS.includes(transition.trigger)) {
        addIssue(issues, "invalid-value", `${transitionPath}.trigger`, `${transitionPath}.trigger 不受支持`);
      }
      if (!Number.isSafeInteger(transition.priority)) {
        addIssue(issues, "invalid-value", `${transitionPath}.priority`, `${transitionPath}.priority 必须是安全整数`);
      }
      if (transition.trigger === "condition" && transition.condition === null) {
        addIssue(issues, "invalid-value", `${transitionPath}.condition`, "条件转移必须声明 condition");
      }
      if (transition.trigger === "timeout") {
        const sourceStage = definition.stages.find(({ id }) => id === transition.fromStageId);
        if (sourceStage?.timeoutMs === null) {
          addIssue(issues, "invalid-value", `${transitionPath}.trigger`, "timeout 转移的源阶段必须声明 timeoutMs");
        }
      }
      if (transition.condition !== null) validateExpression(transition.condition, catalog, limits, `${transitionPath}.condition`, issues);
      validateEffects(transition.effects, catalog, limits, `${transitionPath}.effects`, issues);
      const sourceKind = definition.stages.find(({ id }) => id === transition.fromStageId)?.kind;
      if (sourceKind !== undefined && sourceKind !== "active") {
        addIssue(issues, "invalid-value", `${transitionPath}.fromStageId`, "终态阶段不能有出向转移");
      }
    });
    detectUnconditionalProcessCycles(definition, issues, path);
  });
  if (issues.length > 0) throw new RuleContractValidationError(issues);
}

export function canonicalDeclarativeRequest(value: unknown): string {
  const visit = (item: unknown, ancestors: Set<object>): string => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== "object") throw new TypeError("请求必须只包含 JSON 值");
    if (ancestors.has(item)) throw new TypeError("请求不能包含循环引用");
    ancestors.add(item);
    if (Array.isArray(item)) {
      const result = `[${item.map((entry) => visit(entry, ancestors)).join(",")}]`;
      ancestors.delete(item);
      return result;
    }
    const result = `{${Object.entries(item as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => `${JSON.stringify(key)}:${visit(entry, ancestors)}`)
      .join(",")}}`;
    ancestors.delete(item);
    return result;
  };
  return visit(value, new Set());
}

export function cloneRuntimeJsonValue(value: RuntimeJsonValue, ancestors = new Set<object>()): RuntimeJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("JSON 数值必须有限");
    return value;
  }
  if (ancestors.has(value)) throw new TypeError("JSON 值不能包含循环引用");
  ancestors.add(value);
  if (Array.isArray(value)) {
    const result = Object.freeze(value.map((item) => cloneRuntimeJsonValue(item, ancestors)));
    ancestors.delete(value);
    return result;
  }
  const result: Record<string, RuntimeJsonValue> = {};
  Object.entries(value).forEach(([key, item]) => {
    if (FORBIDDEN_PATH_SEGMENTS.has(key)) throw new TypeError(`JSON 对象包含不安全的键 ${key}`);
    result[key] = cloneRuntimeJsonValue(item, ancestors);
  });
  ancestors.delete(value);
  return Object.freeze(result);
}

export function cloneRuntimeJsonObject(value: RuntimeJsonObject): RuntimeJsonObject {
  return cloneRuntimeJsonValue(value) as RuntimeJsonObject;
}
