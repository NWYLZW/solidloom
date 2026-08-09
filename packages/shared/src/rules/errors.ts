export interface RuleContractValidationIssue {
  readonly code: "invalid-structure" | "invalid-value" | "duplicate-id" | "unknown-reference" | "unsafe-field" | "cycle";
  readonly path: string;
  readonly message: string;
}

export class RuleContractValidationError extends Error {
  readonly issues: readonly RuleContractValidationIssue[];

  constructor(issues: readonly RuleContractValidationIssue[]) {
    super(`声明式规则或流程定义无效：${issues.map(({ message }) => message).join("；")}`);
    this.name = "RuleContractValidationError";
    this.issues = Object.freeze([...issues]);
  }
}

export class RuleExpressionEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleExpressionEvaluationError";
  }
}

export class RuleExecutionBudgetExceededError extends Error {
  constructor(readonly budget: string) {
    super(`声明式执行超过上限：${budget}`);
    this.name = "RuleExecutionBudgetExceededError";
  }
}

export class DeclarativeRuntimeRevisionConflictError extends Error {
  constructor(readonly expectedRevision: number, readonly actualRevision: number) {
    super(`运行时修订冲突：期望 ${expectedRevision}，实际 ${actualRevision}`);
    this.name = "DeclarativeRuntimeRevisionConflictError";
  }
}

export class DeclarativeRuntimeIdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`幂等键 ${idempotencyKey} 已被不同请求使用`);
    this.name = "DeclarativeRuntimeIdempotencyConflictError";
  }
}

export class DeclarativeRuntimeOperationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "DeclarativeRuntimeOperationError";
  }
}
