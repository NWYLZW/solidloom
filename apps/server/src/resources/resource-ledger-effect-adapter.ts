import {
  semanticActionCommitTime,
  type ResourceLedgerOperation,
  type RuntimeJsonObject,
  type SemanticActionDefinition,
  type SemanticActionEffectResult,
  type SemanticActionInstance,
  type SemanticActionRuntimeState,
} from "@solidloom/shared";
import type { SemanticActionEffectAdapter } from "../actions/semantic-action-runtime.js";
import { ResourceLedger } from "./resource-ledger.js";

export interface ResourceLedgerEffectPlan {
  readonly operations: readonly ResourceLedgerOperation[];
  readonly sourceWorkflowId?: string;
}

export interface ResourceLedgerEffectResolver {
  resolve(input: {
    readonly phase: "commit" | "compensate";
    readonly effectId: string;
    readonly action: SemanticActionInstance;
    readonly definition: SemanticActionDefinition;
    readonly actionState: SemanticActionRuntimeState;
    readonly ledgerState: ResourceLedger["state"];
  }): ResourceLedgerEffectPlan;
}

function resultEvent(
  phase: "commit" | "compensate",
  effectId: string,
  result: ReturnType<ResourceLedger["execute"]>,
): SemanticActionEffectResult {
  const payload: RuntimeJsonObject = Object.freeze({
    phase,
    effectId,
    ledgerRevision: result.state.revision,
    entryIds: Object.freeze(result.entries.map(({ id }) => id)),
    replayed: result.replayed,
  });
  return Object.freeze({
    events: Object.freeze([{ type: "resources.batch-committed", payload }]),
  });
}

export class ResourceLedgerEffectAdapter implements SemanticActionEffectAdapter {
  constructor(
    readonly ledger: ResourceLedger,
    readonly resolver: ResourceLedgerEffectResolver,
  ) {}

  commit(input: {
    readonly effectId: string;
    readonly action: SemanticActionInstance;
    readonly definition: SemanticActionDefinition;
    readonly state: SemanticActionRuntimeState;
  }): SemanticActionEffectResult {
    return this.#execute("commit", input);
  }

  compensate(input: {
    readonly effectId: string;
    readonly action: SemanticActionInstance;
    readonly definition: SemanticActionDefinition;
    readonly state: SemanticActionRuntimeState;
  }): SemanticActionEffectResult {
    return this.#execute("compensate", input);
  }

  #execute(
    phase: "commit" | "compensate",
    input: {
      readonly effectId: string;
      readonly action: SemanticActionInstance;
      readonly definition: SemanticActionDefinition;
      readonly state: SemanticActionRuntimeState;
    },
  ): SemanticActionEffectResult {
    const plan = this.resolver.resolve({
      phase,
      effectId: input.effectId,
      action: input.action,
      definition: input.definition,
      actionState: input.state,
      ledgerState: this.ledger.state,
    });
    const atSimulationTimeMs = phase === "commit"
      ? semanticActionCommitTime(input.action, input.definition)
      : input.state.simulationTimeMs;
    const batchId = `${input.action.id}:${phase}:${input.effectId}`;
    const result = this.ledger.execute({
      batchId,
      runId: input.action.runId,
      idempotencyKey: `resource-effect:${batchId}`,
      expectedRevision: this.ledger.state.revision,
      sourceActionId: input.action.id,
      ...(plan.sourceWorkflowId ? { sourceWorkflowId: plan.sourceWorkflowId } : {}),
      recordedAt: new Date(Math.max(0, Math.trunc(atSimulationTimeMs))).toISOString(),
      operations: plan.operations,
    });
    return resultEvent(phase, input.effectId, result);
  }
}
