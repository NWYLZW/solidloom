import type {
  RuntimeDefinitionStatus,
  RuntimeExpression,
  RuntimeJsonObject,
  RuntimeJsonSchema,
  RuntimeScope,
  RuntimeScopeKind,
} from "../runtime/domain.js";

export const ACTION_RUNTIME_SCHEMA_VERSION = 1 as const;
export const SEMANTIC_ACTION_STATUSES = [
  "proposed",
  "validated",
  "running",
  "committed",
  "completed",
  "cancelled",
  "failed",
] as const;
export const ACTION_CHANNEL_SCOPES = ["run", "subject"] as const;
export const ACTION_LIFECYCLE_EVENT_TYPES = [
  "action.proposed",
  "action.validated",
  "action.running",
  "action.committed",
  "action.completed",
  "action.cancelled",
  "action.failed",
  "action.compensated",
] as const;

export type SemanticActionStatus = (typeof SEMANTIC_ACTION_STATUSES)[number];
export type ActionChannelScope = (typeof ACTION_CHANNEL_SCOPES)[number];
export type ActionLifecycleEventType = (typeof ACTION_LIFECYCLE_EVENT_TYPES)[number];

export interface SemanticActionSubjectConstraint {
  readonly required: boolean;
  readonly entityTypeIds: readonly string[];
}

export interface SemanticActionTargetConstraint {
  readonly required: boolean;
  readonly scopeKinds: readonly RuntimeScopeKind[];
  readonly entityTypeIds: readonly string[];
}

export interface SemanticActionChannelDefinition {
  readonly id: string;
  readonly scope: ActionChannelScope;
}

export type SemanticActionCommitPoint = (
  | { readonly mode: "on-start" }
  | { readonly mode: "at-progress"; readonly progress: number }
  | { readonly mode: "on-completion" }
);

export type SemanticActionAfterCommitCancellation = (
  | { readonly mode: "reject" }
  | { readonly mode: "compensate"; readonly effectId: string }
);

export interface SemanticActionCancellationPolicy {
  readonly beforeCommit: "allow" | "reject";
  readonly afterCommit: SemanticActionAfterCommitCancellation;
}

export interface SemanticActionDefinition {
  readonly id: string;
  readonly domainPackageId: string;
  readonly displayName: string;
  readonly description: string;
  readonly revision: number;
  readonly status: RuntimeDefinitionStatus;
  readonly parametersSchema: RuntimeJsonSchema;
  readonly subject: SemanticActionSubjectConstraint;
  readonly target: SemanticActionTargetConstraint;
  readonly preconditions: readonly RuntimeExpression[];
  readonly requiredCapabilities: readonly string[];
  readonly channels: readonly SemanticActionChannelDefinition[];
  readonly durationMs: number;
  readonly timeoutMs: number | null;
  readonly commitPoint: SemanticActionCommitPoint;
  readonly commitEffectId: string | null;
  readonly cancellation: SemanticActionCancellationPolicy;
}

export interface SemanticActionEntityReference {
  readonly id: string;
  readonly typeId: string;
}

export interface SemanticActionTargetReference {
  readonly scope: RuntimeScope;
  readonly entityTypeId?: string;
}

export interface SemanticActionRequest {
  readonly actionId: string;
  readonly runId: string;
  readonly definitionId: string;
  readonly subject: SemanticActionEntityReference | null;
  readonly target: SemanticActionTargetReference | null;
  readonly parameters: RuntimeJsonObject;
  readonly idempotencyKey: string;
  readonly expectedRevision: number;
  readonly proposedAtSimulationTimeMs: number;
}

export interface SemanticActionFailure {
  readonly code: string;
  readonly message: string;
}

export interface SemanticActionTransition {
  readonly status: SemanticActionStatus;
  readonly atSimulationTimeMs: number;
  readonly reason: string | null;
}

export interface SemanticActionInstance {
  readonly id: string;
  readonly sequence: number;
  readonly runId: string;
  readonly definitionId: string;
  readonly definitionRevision: number;
  readonly subject: SemanticActionEntityReference | null;
  readonly target: SemanticActionTargetReference | null;
  readonly parameters: RuntimeJsonObject;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly status: SemanticActionStatus;
  readonly channelKeys: readonly string[];
  readonly proposedAtSimulationTimeMs: number;
  readonly startedAtSimulationTimeMs: number | null;
  readonly committedAtSimulationTimeMs: number | null;
  readonly endedAtSimulationTimeMs: number | null;
  readonly compensatedAtSimulationTimeMs: number | null;
  readonly failure: SemanticActionFailure | null;
  readonly revision: number;
  readonly transitions: readonly SemanticActionTransition[];
}

export interface ActionIdempotencyRecord {
  readonly key: string;
  readonly actionId: string;
  readonly requestFingerprint: string;
}

export interface SemanticActionRuntimeState {
  readonly schemaVersion: typeof ACTION_RUNTIME_SCHEMA_VERSION;
  readonly runId: string;
  readonly revision: number;
  readonly simulationTimeMs: number;
  readonly nextActionSequence: number;
  readonly nextEventSequence: number;
  readonly actions: readonly SemanticActionInstance[];
  readonly idempotencyRecords: readonly ActionIdempotencyRecord[];
  readonly events: readonly SemanticActionEvent[];
}

export interface SemanticActionLifecycleEvent {
  readonly id: string;
  readonly sequence: number;
  readonly runId: string;
  readonly actionId: string;
  readonly kind: "lifecycle";
  readonly type: ActionLifecycleEventType;
  readonly atSimulationTimeMs: number;
  readonly payload: RuntimeJsonObject;
}

export interface SemanticActionDomainEvent {
  readonly id: string;
  readonly sequence: number;
  readonly runId: string;
  readonly actionId: string;
  readonly kind: "domain";
  readonly type: string;
  readonly atSimulationTimeMs: number;
  readonly payload: RuntimeJsonObject;
}

export type SemanticActionEvent = SemanticActionLifecycleEvent | SemanticActionDomainEvent;

export interface SemanticActionPolicyFailure {
  readonly requirementId: string;
  readonly kind: "precondition" | "permission";
  readonly message: string;
}

export interface SemanticActionPolicyDecision {
  readonly allowed: boolean;
  readonly failures: readonly SemanticActionPolicyFailure[];
}

export interface SemanticActionEffectEventInput {
  readonly type: string;
  readonly payload: RuntimeJsonObject;
}

export interface SemanticActionEffectResult {
  readonly events: readonly SemanticActionEffectEventInput[];
}

export interface SemanticActionSubmissionResult {
  readonly state: SemanticActionRuntimeState;
  readonly action: SemanticActionInstance;
  readonly events: readonly SemanticActionEvent[];
  readonly replayed: boolean;
}

export interface SemanticActionAdvanceResult {
  readonly state: SemanticActionRuntimeState;
  readonly events: readonly SemanticActionEvent[];
}

export interface SemanticActionCancellationRequest {
  readonly actionId: string;
  readonly runId: string;
  readonly expectedRevision: number;
  readonly requestedAtSimulationTimeMs: number;
  readonly reason: string;
}

export interface SemanticActionCancellationResult {
  readonly state: SemanticActionRuntimeState;
  readonly action: SemanticActionInstance;
  readonly events: readonly SemanticActionEvent[];
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
}
