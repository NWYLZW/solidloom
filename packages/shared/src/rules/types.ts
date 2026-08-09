import type {
  RuntimeDefinitionStatus,
  RuntimeJsonObject,
  RuntimeJsonValue,
} from "../runtime/domain.js";

export const DECLARATIVE_RULE_SCHEMA_VERSION = 1 as const;
export const RULE_EXPRESSION_ROOTS = ["event", "state", "process", "variables"] as const;
export const RULE_COMPARE_OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in"] as const;
export const RULE_ARITHMETIC_OPERATORS = ["add", "subtract", "multiply", "divide", "modulo"] as const;
export const RULE_EFFECT_KINDS = [
  "component.set",
  "component.increment",
  "relation.add",
  "relation.remove",
  "resource.reserve",
  "resource.commit",
  "resource.release",
  "resource.transfer",
  "metric.increment",
  "process.start",
  "process.pause",
  "process.cancel",
  "entity.create",
  "entity.destroy",
  "event.emit",
] as const;
export const RULE_AUDIT_OUTCOMES = ["planned-skipped", "condition-false", "fired"] as const;
export const PROCESS_STATUSES = ["running", "paused", "completed", "failed", "cancelled"] as const;
export const PROCESS_STAGE_KINDS = ["active", "completed", "failed"] as const;
export const PROCESS_TRANSITION_TRIGGERS = ["condition", "manual", "timeout"] as const;
export const PROCESS_AUDIT_TYPES = [
  "process-started",
  "stage-entered",
  "stage-exited",
  "process-paused",
  "process-resumed",
  "process-completed",
  "process-failed",
  "process-cancelled",
  "stage-compensated",
] as const;

export type RuleExpressionRoot = (typeof RULE_EXPRESSION_ROOTS)[number];
export type RuleCompareOperator = (typeof RULE_COMPARE_OPERATORS)[number];
export type RuleArithmeticOperator = (typeof RULE_ARITHMETIC_OPERATORS)[number];
export type RuleEffectKind = (typeof RULE_EFFECT_KINDS)[number];
export type RuleAuditOutcome = (typeof RULE_AUDIT_OUTCOMES)[number];
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];
export type ProcessStageKind = (typeof PROCESS_STAGE_KINDS)[number];
export type ProcessTransitionTrigger = (typeof PROCESS_TRANSITION_TRIGGERS)[number];
export type ProcessAuditType = (typeof PROCESS_AUDIT_TYPES)[number];

export type RuleExpression = (
  | { readonly kind: "literal"; readonly value: RuntimeJsonValue }
  | { readonly kind: "path"; readonly root: RuleExpressionRoot; readonly path: readonly string[] }
  | { readonly kind: "not"; readonly operand: RuleExpression }
  | { readonly kind: "all" | "any"; readonly operands: readonly RuleExpression[] }
  | {
    readonly kind: "compare";
    readonly operator: RuleCompareOperator;
    readonly left: RuleExpression;
    readonly right: RuleExpression;
  }
  | {
    readonly kind: "arithmetic";
    readonly operator: RuleArithmeticOperator;
    readonly left: RuleExpression;
    readonly right: RuleExpression;
  }
);

export interface RuleExpressionContext {
  readonly event: RuntimeJsonObject;
  readonly state: RuntimeJsonObject;
  readonly process: RuntimeJsonObject;
  readonly variables: RuntimeJsonObject;
}

export type RuleFieldCatalog = Readonly<Record<RuleExpressionRoot, readonly string[]>>;

export interface RuleExpressionLimits {
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly maxEvaluationSteps: number;
}

export interface DeclarativeEffectTemplate {
  readonly id: string;
  readonly kind: RuleEffectKind;
  readonly arguments: Readonly<Record<string, RuleExpression>>;
}

export interface ResolvedDeclarativeEffect {
  readonly id: string;
  readonly sourceKind: "rule" | "process";
  readonly sourceDefinitionId: string;
  readonly sourceInstanceId: string;
  readonly sourceTriggerId: string;
  readonly kind: RuleEffectKind;
  readonly arguments: RuntimeJsonObject;
}

export type DeclarativeRuleTrigger = (
  | { readonly kind: "event"; readonly typeId: string }
  | { readonly kind: "schedule"; readonly scheduleId: string }
);

export interface DeclarativeRuleDefinition {
  readonly id: string;
  readonly domainPackageId: string;
  readonly displayName: string;
  readonly description: string;
  readonly revision: number;
  readonly status: RuntimeDefinitionStatus;
  readonly priority: number;
  readonly trigger: DeclarativeRuleTrigger;
  readonly condition: RuleExpression | null;
  readonly effects: readonly DeclarativeEffectTemplate[];
  readonly maxFiringsPerDispatch: number;
}

export type RuleDispatchTrigger = (
  | {
    readonly kind: "event";
    readonly id: string;
    readonly idempotencyKey: string;
    readonly runId: string;
    readonly typeId: string;
    readonly simulationTimeMs: number;
    readonly payload: RuntimeJsonObject;
  }
  | {
    readonly kind: "schedule";
    readonly id: string;
    readonly idempotencyKey: string;
    readonly runId: string;
    readonly scheduleId: string;
    readonly simulationTimeMs: number;
    readonly payload: RuntimeJsonObject;
  }
);

export interface RuleDispatchContext {
  readonly state: RuntimeJsonObject;
  readonly process: RuntimeJsonObject;
  readonly variables: RuntimeJsonObject;
}

export interface RuleExecutionLimits extends RuleExpressionLimits {
  readonly maxCascadeDepth: number;
  readonly maxTriggers: number;
  readonly maxRuleFirings: number;
  readonly maxEffects: number;
}

export interface RuleAuditEntry {
  readonly sequence: number;
  readonly triggerId: string;
  readonly ruleDefinitionId: string;
  readonly outcome: RuleAuditOutcome;
  readonly simulationTimeMs: number;
  readonly effectIds: readonly string[];
}

export interface RuleDispatchRecord {
  readonly idempotencyKey: string;
  readonly triggerId: string;
  readonly fingerprint: string;
}

export interface DeclarativeRuleRuntimeState {
  readonly schemaVersion: typeof DECLARATIVE_RULE_SCHEMA_VERSION;
  readonly runId: string;
  readonly revision: number;
  readonly nextAuditSequence: number;
  readonly dispatches: readonly RuleDispatchRecord[];
  readonly audit: readonly RuleAuditEntry[];
}

export interface RuleDispatchResult {
  readonly state: DeclarativeRuleRuntimeState;
  readonly effects: readonly ResolvedDeclarativeEffect[];
  readonly audit: readonly RuleAuditEntry[];
  readonly replayed: boolean;
}

export interface ProcessParticipantSlotDefinition {
  readonly id: string;
  readonly required: boolean;
  readonly entityTypeIds: readonly string[];
}

export interface ProcessStageDefinition {
  readonly id: string;
  readonly kind: ProcessStageKind;
  readonly enterCondition: RuleExpression | null;
  readonly exitCondition: RuleExpression | null;
  readonly timeoutMs: number | null;
  readonly enterEffects: readonly DeclarativeEffectTemplate[];
  readonly exitEffects: readonly DeclarativeEffectTemplate[];
  readonly timeoutEffects: readonly DeclarativeEffectTemplate[];
  readonly compensationEffects: readonly DeclarativeEffectTemplate[];
}

export interface ProcessTransitionDefinition {
  readonly id: string;
  readonly fromStageId: string;
  readonly toStageId: string;
  readonly trigger: ProcessTransitionTrigger;
  readonly priority: number;
  readonly condition: RuleExpression | null;
  readonly effects: readonly DeclarativeEffectTemplate[];
}

export interface DeclarativeProcessDefinition {
  readonly id: string;
  readonly domainPackageId: string;
  readonly displayName: string;
  readonly description: string;
  readonly revision: number;
  readonly status: RuntimeDefinitionStatus;
  readonly participantSlots: readonly ProcessParticipantSlotDefinition[];
  readonly initialStageId: string;
  readonly stages: readonly ProcessStageDefinition[];
  readonly transitions: readonly ProcessTransitionDefinition[];
  readonly maxTransitionsPerAdvance: number;
}

export interface ProcessParticipantAssignment {
  readonly slotId: string;
  readonly entityId: string;
  readonly entityTypeId: string;
}

export interface ProcessStartRequest {
  readonly processId: string;
  readonly runId: string;
  readonly definitionId: string;
  readonly participants: readonly ProcessParticipantAssignment[];
  readonly variables: RuntimeJsonObject;
  readonly idempotencyKey: string;
  readonly expectedRevision: number;
  readonly requestedAtSimulationTimeMs: number;
}

export type ProcessCommandKind = "pause" | "resume" | "cancel" | "fail" | "transition";

export interface ProcessCommandRequest {
  readonly commandId: string;
  readonly kind: ProcessCommandKind;
  readonly processId: string;
  readonly runId: string;
  readonly idempotencyKey: string;
  readonly expectedRevision: number;
  readonly requestedAtSimulationTimeMs: number;
  readonly reason: string;
  readonly transitionId: string | null;
}

export interface ProcessStageVisit {
  readonly sequence: number;
  readonly stageId: string;
  readonly enteredAtSimulationTimeMs: number;
  readonly exitedAtSimulationTimeMs: number | null;
  readonly compensatedAtSimulationTimeMs: number | null;
}

export interface ProcessFailure {
  readonly code: string;
  readonly message: string;
}

export interface ProcessInstance {
  readonly id: string;
  readonly sequence: number;
  readonly runId: string;
  readonly definitionId: string;
  readonly definitionRevision: number;
  readonly status: ProcessStatus;
  readonly currentStageId: string;
  readonly participants: readonly ProcessParticipantAssignment[];
  readonly variables: RuntimeJsonObject;
  readonly startedAtSimulationTimeMs: number;
  readonly endedAtSimulationTimeMs: number | null;
  readonly pausedAtSimulationTimeMs: number | null;
  readonly accumulatedPausedMs: number;
  readonly failure: ProcessFailure | null;
  readonly stageVisits: readonly ProcessStageVisit[];
  readonly revision: number;
}

export interface ProcessAuditEntry {
  readonly sequence: number;
  readonly processId: string;
  readonly type: ProcessAuditType;
  readonly stageId: string;
  readonly atSimulationTimeMs: number;
  readonly reason: string | null;
  readonly effectIds: readonly string[];
}

export interface ProcessIdempotencyRecord {
  readonly idempotencyKey: string;
  readonly requestId: string;
  readonly fingerprint: string;
  readonly processId: string;
}

export interface DeclarativeProcessRuntimeState {
  readonly schemaVersion: typeof DECLARATIVE_RULE_SCHEMA_VERSION;
  readonly runId: string;
  readonly revision: number;
  readonly simulationTimeMs: number;
  readonly nextProcessSequence: number;
  readonly nextAuditSequence: number;
  readonly processes: readonly ProcessInstance[];
  readonly idempotencyRecords: readonly ProcessIdempotencyRecord[];
  readonly audit: readonly ProcessAuditEntry[];
}

export interface ProcessRuntimeContext {
  readonly event: RuntimeJsonObject;
  readonly state: RuntimeJsonObject;
}

export interface ProcessMutationResult {
  readonly state: DeclarativeProcessRuntimeState;
  readonly process: ProcessInstance;
  readonly effects: readonly ResolvedDeclarativeEffect[];
  readonly audit: readonly ProcessAuditEntry[];
  readonly replayed: boolean;
}

export interface ProcessAdvanceResult {
  readonly state: DeclarativeProcessRuntimeState;
  readonly effects: readonly ResolvedDeclarativeEffect[];
  readonly audit: readonly ProcessAuditEntry[];
}
