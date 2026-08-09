import type { RuntimeJsonValue } from "../runtime/domain.js";
import { RuleExecutionBudgetExceededError, RuleExpressionEvaluationError } from "./errors.js";
import type { RuleExpression, RuleExpressionContext } from "./types.js";

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function isRecord(value: RuntimeJsonValue): value is { readonly [key: string]: RuntimeJsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJson(value: RuntimeJsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}

function equalValues(left: RuntimeJsonValue, right: RuntimeJsonValue) {
  return stableJson(left) === stableJson(right);
}

function orderedValues(left: RuntimeJsonValue, right: RuntimeJsonValue): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "string" && typeof right === "string") return left.localeCompare(right);
  throw new RuleExpressionEvaluationError("有序比较只支持两个数值或两个字符串");
}

function numericValues(left: RuntimeJsonValue, right: RuntimeJsonValue): readonly [number, number] {
  if (typeof left !== "number" || typeof right !== "number") {
    throw new RuleExpressionEvaluationError("算术表达式只支持有限数值");
  }
  return [left, right];
}

function booleanValue(value: RuntimeJsonValue, operation: string): boolean {
  if (typeof value !== "boolean") throw new RuleExpressionEvaluationError(`${operation} 需要布尔值`);
  return value;
}

export function evaluateRuleExpression(
  expression: RuleExpression,
  context: RuleExpressionContext,
  maxEvaluationSteps: number,
): RuntimeJsonValue {
  if (!Number.isSafeInteger(maxEvaluationSteps) || maxEvaluationSteps <= 0) {
    throw new RuleExpressionEvaluationError("maxEvaluationSteps 必须是正安全整数");
  }
  let steps = 0;

  const evaluate = (current: RuleExpression): RuntimeJsonValue => {
    steps += 1;
    if (steps > maxEvaluationSteps) throw new RuleExecutionBudgetExceededError("maxEvaluationSteps");

    switch (current.kind) {
      case "literal":
        return current.value;
      case "path": { // Only own JSON properties are traversed; prototypes and accessors are never consulted.
        let value: RuntimeJsonValue = context[current.root];
        for (const segment of current.path) {
          if (FORBIDDEN_PATH_SEGMENTS.has(segment) || !isRecord(value)
            || !Object.prototype.hasOwnProperty.call(value, segment)) {
            throw new RuleExpressionEvaluationError(`字段 ${current.root}.${current.path.join(".")} 不存在或不可访问`);
          }
          value = value[segment]!;
        }
        return value;
      }
      case "not":
        return !booleanValue(evaluate(current.operand), "not");
      case "all":
        for (const operand of current.operands) {
          if (!booleanValue(evaluate(operand), "all")) return false;
        }
        return true;
      case "any":
        for (const operand of current.operands) {
          if (booleanValue(evaluate(operand), "any")) return true;
        }
        return false;
      case "compare": {
        const left = evaluate(current.left);
        const right = evaluate(current.right);
        switch (current.operator) {
          case "eq": return equalValues(left, right);
          case "ne": return !equalValues(left, right);
          case "gt": return orderedValues(left, right) > 0;
          case "gte": return orderedValues(left, right) >= 0;
          case "lt": return orderedValues(left, right) < 0;
          case "lte": return orderedValues(left, right) <= 0;
          case "contains":
            if (typeof left === "string" && typeof right === "string") return left.includes(right);
            if (Array.isArray(left)) return left.some((item) => equalValues(item, right));
            throw new RuleExpressionEvaluationError("contains 左值必须是字符串或数组");
          case "in":
            if (!Array.isArray(right)) throw new RuleExpressionEvaluationError("in 右值必须是数组");
            return right.some((item) => equalValues(left, item));
        }
        break;
      }
      case "arithmetic": {
        const [left, right] = numericValues(evaluate(current.left), evaluate(current.right));
        let result: number;
        switch (current.operator) {
          case "add": result = left + right; break;
          case "subtract": result = left - right; break;
          case "multiply": result = left * right; break;
          case "divide":
            if (right === 0) throw new RuleExpressionEvaluationError("不能除以零");
            result = left / right;
            break;
          case "modulo":
            if (right === 0) throw new RuleExpressionEvaluationError("不能对零取模");
            result = left % right;
            break;
        }
        if (!Number.isFinite(result)) throw new RuleExpressionEvaluationError("算术结果必须是有限数值");
        return result;
      }
    }
    throw new RuleExpressionEvaluationError("不支持的声明式表达式");
  };

  return evaluate(expression);
}

export function evaluateRuleCondition(
  expression: RuleExpression | null,
  context: RuleExpressionContext,
  maxEvaluationSteps: number,
): boolean {
  if (expression === null) return true;
  const value = evaluateRuleExpression(expression, context, maxEvaluationSteps);
  if (typeof value !== "boolean") throw new RuleExpressionEvaluationError("规则条件必须返回布尔值");
  return value;
}
