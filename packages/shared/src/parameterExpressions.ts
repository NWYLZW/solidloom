import type { FeatureGraph, ModelFeature, ModelVariable } from "./types.js";

export interface ParameterExpressionIssue {
  featureId: string;
  target: string;
  expression: string;
  message: string;
}

class ExpressionParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse(): number {
    const value = this.parseAdditive();
    this.skipWhitespace();
    if (this.index !== this.input.length) throw new Error(`无法识别“${this.input.slice(this.index)}”`);
    if (!Number.isFinite(value)) throw new Error("计算结果不是有限数值");
    return value;
  }

  private parseAdditive(): number {
    let value = this.parseMultiplicative();
    while (true) {
      this.skipWhitespace();
      if (this.consume("+")) value += this.parseMultiplicative();
      else if (this.consume("-")) value -= this.parseMultiplicative();
      else return value;
    }
  }

  private parseMultiplicative(): number {
    let value = this.parseUnary();
    while (true) {
      this.skipWhitespace();
      if (this.consume("*")) value *= this.parseUnary();
      else if (this.consume("/")) {
        const divisor = this.parseUnary();
        if (divisor === 0) throw new Error("不能除以 0");
        value /= divisor;
      } else return value;
    }
  }

  private parseUnary(): number {
    this.skipWhitespace();
    if (this.consume("+")) return this.parseUnary();
    if (this.consume("-")) return -this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipWhitespace();
    if (this.consume("(")) {
      const value = this.parseAdditive();
      this.skipWhitespace();
      if (!this.consume(")")) throw new Error("缺少右括号");
      return value;
    }
    const number = this.readNumber();
    if (number !== null) return number;
    const functionName = this.readIdentifier();
    if (!functionName) throw new Error(`需要数值，当前位置为“${this.input.slice(this.index, this.index + 12)}”`);
    this.skipWhitespace();
    if (!this.consume("(")) throw new Error(`函数 ${functionName} 缺少参数括号`);
    const args: number[] = [];
    this.skipWhitespace();
    if (!this.consume(")")) {
      do {
        args.push(this.parseAdditive());
        this.skipWhitespace();
      } while (this.consume(","));
      if (!this.consume(")")) throw new Error(`函数 ${functionName} 缺少右括号`);
    }
    if (functionName === "min" && args.length > 0) return Math.min(...args);
    if (functionName === "max" && args.length > 0) return Math.max(...args);
    if (functionName === "abs" && args.length === 1) return Math.abs(args[0]!);
    if (functionName === "clamp" && args.length === 3) return Math.min(args[2]!, Math.max(args[0]!, args[1]!));
    throw new Error(`不支持函数 ${functionName} 或参数数量不正确`);
  }

  private readNumber(): number | null {
    this.skipWhitespace();
    const match = this.input.slice(this.index).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!match) return null;
    this.index += match[0].length;
    return Number(match[0]);
  }

  private readIdentifier(): string | null {
    this.skipWhitespace();
    const match = this.input.slice(this.index).match(/^[A-Za-z][A-Za-z0-9-]*/);
    if (!match) return null;
    this.index += match[0].length;
    return match[0];
  }

  private consume(value: string): boolean {
    if (!this.input.startsWith(value, this.index)) return false;
    this.index += value.length;
    return true;
  }

  private skipWhitespace() {
    while (/\s/.test(this.input[this.index] ?? "")) this.index += 1;
  }
}

export function modelVariableValues(variables: ModelVariable[] = []): Record<string, number> {
  return Object.fromEntries(variables.flatMap((variable) => (
    typeof variable.value === "number" ? [[variable.id, variable.value]] : []
  )));
}

export function evaluateParameterExpression(expression: string, variables: Record<string, number>): number {
  const resolved = expression.replace(/var\(\s*(--[A-Za-z][A-Za-z0-9-]*)\s*\)/g, (_match, id: string) => {
    const value = variables[id];
    if (value === undefined) throw new Error(`未定义变量 ${id}`);
    return `(${value})`;
  });
  if (/var\s*\(/.test(resolved)) throw new Error("变量必须使用 var(--name) 格式");
  return new ExpressionParser(resolved).parse();
}

function setNumericPath(feature: ModelFeature, target: string, value: number) {
  const segments = target.split(".").filter(Boolean);
  if (segments.length === 0) throw new Error("目标路径不能为空");
  let cursor: unknown = feature;
  for (const segment of segments.slice(0, -1)) {
    if (cursor === null || typeof cursor !== "object" || !(segment in cursor)) throw new Error(`目标路径不存在：${target}`);
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  const key = segments.at(-1)!;
  if (cursor === null || typeof cursor !== "object" || !(key in cursor)) throw new Error(`目标路径不存在：${target}`);
  const record = cursor as Record<string, unknown>;
  if (typeof record[key] !== "number") throw new Error(`目标字段不是数值：${target}`);
  record[key] = value;
}

export function applyFeatureGraphExpressions(featureGraph: FeatureGraph): {
  featureGraph: FeatureGraph;
  issues: ParameterExpressionIssue[];
} {
  const variables = modelVariableValues(featureGraph.variables);
  const features = structuredClone(featureGraph.features);
  const issues: ParameterExpressionIssue[] = [];
  for (const feature of features) {
    for (const [target, expression] of Object.entries(feature.parameterExpressions ?? {})) {
      try {
        setNumericPath(feature, target, evaluateParameterExpression(expression, variables));
      } catch (error) {
        issues.push({
          featureId: feature.id,
          target,
          expression,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return {
    featureGraph: { ...structuredClone(featureGraph), features },
    issues,
  };
}
