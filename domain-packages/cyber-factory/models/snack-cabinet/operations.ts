import {
  createEntityRuntimeState,
  executeEntityTransfer,
  hasEntityAccess,
  issueTemporaryAccessGrant,
  type CommitEntityTransferResult,
  type EntityRuntimeState,
  type EntityTransferLeg,
  type RuntimeEntity,
} from "@solidloom/shared";

export const snackCabinetOperationIds = {
  actor: "snack-demo-operator",
  machine: "snack-cabinet",
  externalContainer: "snack-external-stock",
  machineContainer: "snack-machine-stock",
  stockInputPort: "snack-stock-input",
  maintenanceKey: "snack-maintenance-key",
} as const;

const manageRequirement = {
  capability: "inventory.manage",
  scopeEntityId: snackCabinetOperationIds.machine,
} as const;

export interface SnackCabinetSecurityState {
  cooldownUntil: number;
  difficulty: number;
  failedAttempts: number;
  grantDurationMs: number;
  lastResult: "idle" | "success" | "failure";
}

export interface SnackCabinetOperationsState {
  security: SnackCabinetSecurityState;
  world: EntityRuntimeState;
}

export interface SnackCabinetEntityInput {
  id: string;
  label: string;
  tags?: string[];
}

export interface CreateSnackCabinetOperationsInput {
  externalEntities?: SnackCabinetEntityInput[];
  machineCapacity?: number;
  machineEntities?: SnackCabinetEntityInput[];
}

export interface SnackCabinetOperationInput {
  actionId: string;
  actorId?: string;
  credentialEntityIds?: string[];
  now: number;
}

export interface SnackCabinetEntityOperationInput extends SnackCabinetOperationInput {
  entityId: string;
}

export interface SnackCabinetExchangeInput extends SnackCabinetOperationInput {
  externalEntityId: string;
  machineEntityId: string;
}

export interface SnackCabinetHackInput extends SnackCabinetOperationInput {
  roll: number;
  skill: number;
}

export type SnackCabinetHackResult =
  | { ok: true; state: SnackCabinetOperationsState; expiresAt: number }
  | { ok: false; state: SnackCabinetOperationsState; reason: "cooldown" | "failed"; retryAt: number };

const defaultExternalEntities: SnackCabinetEntityInput[] = [
  { id: "external-seaweed", label: "海苔脆片", tags: ["snack", "savory"] },
  { id: "external-coffee", label: "咖啡豆罐", tags: ["snack", "drink-supply"] },
  { id: "external-tea", label: "柑橘茶包", tags: ["snack", "drink-supply"] },
];

const defaultMachineEntities: SnackCabinetEntityInput[] = [
  { id: "machine-oat", label: "燕麦能量棒", tags: ["snack", "sweet"] },
  { id: "machine-nuts", label: "混合坚果", tags: ["snack", "savory"] },
  { id: "machine-water", label: "气泡水", tags: ["snack", "drink"] },
];

function runtimeEntity(
  input: SnackCabinetEntityInput,
  ownerId: string,
  containerId: string,
): RuntimeEntity {
  return {
    id: input.id,
    label: input.label,
    tags: ["stock", ...(input.tags ?? ["snack"])],
    ownerId,
    containerId,
    revision: 0,
  };
}

export function createSnackCabinetOperationsState(
  input: CreateSnackCabinetOperationsInput = {},
): SnackCabinetOperationsState {
  const externalEntities = input.externalEntities ?? defaultExternalEntities;
  const machineEntities = input.machineEntities ?? defaultMachineEntities;
  const entities = Object.fromEntries([
    [snackCabinetOperationIds.actor, {
      id: snackCabinetOperationIds.actor,
      label: "补给管理员",
      tags: ["actor"],
      ownerId: null,
      containerId: null,
      revision: 0,
    } satisfies RuntimeEntity],
    [snackCabinetOperationIds.machine, {
      id: snackCabinetOperationIds.machine,
      label: "参数化零食售货机",
      tags: ["machine", "inventory-owner"],
      ownerId: "cyber-factory",
      containerId: null,
      revision: 0,
    } satisfies RuntimeEntity],
    ...externalEntities.map((entity) => [
      entity.id,
      runtimeEntity(entity, snackCabinetOperationIds.actor, snackCabinetOperationIds.externalContainer),
    ] as const),
    ...machineEntities.map((entity) => [
      entity.id,
      runtimeEntity(entity, snackCabinetOperationIds.machine, snackCabinetOperationIds.machineContainer),
    ] as const),
    [snackCabinetOperationIds.maintenanceKey, {
      id: snackCabinetOperationIds.maintenanceKey,
      label: "售货机维修钥匙",
      tags: ["credential", "maintenance-key"],
      ownerId: snackCabinetOperationIds.actor,
      containerId: snackCabinetOperationIds.externalContainer,
      revision: 0,
    } satisfies RuntimeEntity],
  ]);

  return {
    world: createEntityRuntimeState({
      entities,
      containers: {
        [snackCabinetOperationIds.externalContainer]: {
          id: snackCabinetOperationIds.externalContainer,
          label: "外部实体区",
          ownerEntityId: snackCabinetOperationIds.actor,
          capacity: Math.max(12, externalEntities.length + 4),
          entityIds: [
            ...externalEntities.map((entity) => entity.id),
            snackCabinetOperationIds.maintenanceKey,
          ],
          revision: 0,
        },
        [snackCabinetOperationIds.machineContainer]: {
          id: snackCabinetOperationIds.machineContainer,
          label: "售货机库存",
          ownerEntityId: snackCabinetOperationIds.machine,
          capacity: input.machineCapacity ?? 16,
          entityIds: machineEntities.map((entity) => entity.id),
          revision: 0,
        },
      },
      ports: {
        [snackCabinetOperationIds.stockInputPort]: {
          id: snackCabinetOperationIds.stockInputPort,
          label: "后侧库存输入口",
          targetOwnerId: snackCabinetOperationIds.machine,
          targetContainerId: snackCabinetOperationIds.machineContainer,
          accepts: { all: ["stock"], any: ["snack"] },
          requirements: [manageRequirement],
        },
      },
      credentials: {
        [snackCabinetOperationIds.maintenanceKey]: {
          capabilities: [manageRequirement.capability],
          scopeEntityIds: [manageRequirement.scopeEntityId],
          expiresAt: null,
          mode: "bearer",
        },
      },
    }),
    security: {
      difficulty: 8,
      cooldownUntil: 0,
      failedAttempts: 0,
      grantDurationMs: 45_000,
      lastResult: "idle",
    },
  };
}

function actorId(input: SnackCabinetOperationInput) {
  return input.actorId ?? snackCabinetOperationIds.actor;
}

function credentialIds(input: SnackCabinetOperationInput) {
  return input.credentialEntityIds ?? [];
}

function execute(
  state: SnackCabinetOperationsState,
  input: SnackCabinetOperationInput,
  legs: EntityTransferLeg[],
): CommitEntityTransferResult {
  return executeEntityTransfer(state.world, {
    actionId: input.actionId,
    actorId: actorId(input),
    expectedRevision: state.world.revision,
    now: input.now,
    credentialEntityIds: credentialIds(input),
    requirements: [manageRequirement],
    legs,
  });
}

function operationResult(
  state: SnackCabinetOperationsState,
  result: CommitEntityTransferResult,
): { state: SnackCabinetOperationsState; transaction: CommitEntityTransferResult } {
  return {
    state: result.ok ? { ...state, world: result.state } : state,
    transaction: result,
  };
}

export function depositSnackCabinetEntity(
  state: SnackCabinetOperationsState,
  input: SnackCabinetEntityOperationInput,
) {
  return operationResult(state, execute(state, input, [{
    entityId: input.entityId,
    expectedOwnerId: actorId(input),
    expectedContainerId: snackCabinetOperationIds.externalContainer,
    targetOwnerId: snackCabinetOperationIds.machine,
    targetContainerId: snackCabinetOperationIds.machineContainer,
    portId: snackCabinetOperationIds.stockInputPort,
  }]));
}

export function withdrawSnackCabinetEntity(
  state: SnackCabinetOperationsState,
  input: SnackCabinetEntityOperationInput,
) {
  return operationResult(state, execute(state, input, [{
    entityId: input.entityId,
    expectedOwnerId: snackCabinetOperationIds.machine,
    expectedContainerId: snackCabinetOperationIds.machineContainer,
    targetOwnerId: actorId(input),
    targetContainerId: snackCabinetOperationIds.externalContainer,
    portId: null,
  }]));
}

export function exchangeSnackCabinetEntities(
  state: SnackCabinetOperationsState,
  input: SnackCabinetExchangeInput,
) {
  return operationResult(state, execute(state, input, [
    {
      entityId: input.externalEntityId,
      expectedOwnerId: actorId(input),
      expectedContainerId: snackCabinetOperationIds.externalContainer,
      targetOwnerId: snackCabinetOperationIds.machine,
      targetContainerId: snackCabinetOperationIds.machineContainer,
      portId: snackCabinetOperationIds.stockInputPort,
    },
    {
      entityId: input.machineEntityId,
      expectedOwnerId: snackCabinetOperationIds.machine,
      expectedContainerId: snackCabinetOperationIds.machineContainer,
      targetOwnerId: actorId(input),
      targetContainerId: snackCabinetOperationIds.externalContainer,
      portId: null,
    },
  ]));
}

export function hasSnackCabinetManagementAccess(
  state: SnackCabinetOperationsState,
  input: Pick<SnackCabinetOperationInput, "actorId" | "credentialEntityIds" | "now">,
) {
  return hasEntityAccess(
    state.world,
    input.actorId ?? snackCabinetOperationIds.actor,
    manageRequirement,
    input.credentialEntityIds ?? [],
    input.now,
  );
}

export function attemptSnackCabinetHack(
  state: SnackCabinetOperationsState,
  input: SnackCabinetHackInput,
): SnackCabinetHackResult {
  if (input.now < state.security.cooldownUntil) {
    return { ok: false, state, reason: "cooldown", retryAt: state.security.cooldownUntil };
  }
  if (input.skill + input.roll < state.security.difficulty) {
    const next = {
      ...state,
      security: {
        ...state.security,
        failedAttempts: state.security.failedAttempts + 1,
        cooldownUntil: input.now + 5_000,
        lastResult: "failure" as const,
      },
    };
    return { ok: false, state: next, reason: "failed", retryAt: next.security.cooldownUntil };
  }

  const world = issueTemporaryAccessGrant(state.world, {
    actionId: input.actionId,
    subjectId: actorId(input),
    issuedBy: "snack-cabinet-security",
    capability: manageRequirement.capability,
    scopeEntityId: manageRequirement.scopeEntityId,
    now: input.now,
    durationMs: state.security.grantDurationMs,
  });
  const expiresAt = input.now + state.security.grantDurationMs;
  return {
    ok: true,
    expiresAt,
    state: {
      world,
      security: {
        ...state.security,
        cooldownUntil: 0,
        lastResult: "success",
      },
    },
  };
}
