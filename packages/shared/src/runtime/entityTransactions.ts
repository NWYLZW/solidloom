export type CredentialMode = "bearer" | "owner-bound";

export interface RuntimeEntity {
  containerId: string | null;
  id: string;
  label: string;
  ownerId: string | null;
  revision: number;
  tags: string[];
}

export interface EntityContainer {
  capacity: number;
  entityIds: string[];
  id: string;
  label: string;
  ownerEntityId: string;
  revision: number;
}

export interface EntityCredential {
  capabilities: string[];
  expiresAt: number | null;
  mode: CredentialMode;
  scopeEntityIds: string[];
}

export interface AccessRequirement {
  capability: string;
  scopeEntityId: string;
}

export interface TemporaryAccessGrant extends AccessRequirement {
  expiresAt: number;
  id: string;
  issuedBy: string;
  subjectId: string;
}

export interface EntityTagMatcher {
  all: string[];
  any: string[];
}

export interface EntityInputPort {
  accepts: EntityTagMatcher;
  id: string;
  label: string;
  requirements: AccessRequirement[];
  targetContainerId: string;
  targetOwnerId: string;
}

export interface EntityTransactionEvent {
  actionId: string;
  actorId: string;
  entityIds: string[];
  revision: number;
  type: "entity.transfer.committed" | "access.grant.issued";
}

export interface EntityRuntimeState {
  committedActionIds: string[];
  containers: Record<string, EntityContainer>;
  credentials: Record<string, EntityCredential>;
  entities: Record<string, RuntimeEntity>;
  events: EntityTransactionEvent[];
  grants: Record<string, TemporaryAccessGrant>;
  ports: Record<string, EntityInputPort>;
  revision: number;
}

export interface EntityTransferLeg {
  entityId: string;
  expectedContainerId: string | null;
  expectedOwnerId: string | null;
  portId: string | null;
  targetContainerId: string | null;
  targetOwnerId: string | null;
}

export interface EntityTransferRequest {
  actionId: string;
  actorId: string;
  credentialEntityIds: string[];
  expectedRevision: number;
  legs: EntityTransferLeg[];
  now: number;
  requirements: AccessRequirement[];
}

export interface EntityTransferReservation extends EntityTransferRequest {
  status: "cancelled" | "prepared";
}

export type EntityTransactionErrorCode =
  | "action-id-required"
  | "duplicate-entity"
  | "entity-not-found"
  | "source-mismatch"
  | "port-not-found"
  | "port-target-mismatch"
  | "entity-rejected"
  | "container-not-found"
  | "container-capacity"
  | "access-denied"
  | "revision-conflict"
  | "reservation-cancelled";

export interface EntityTransactionError {
  code: EntityTransactionErrorCode;
  message: string;
}

export type PrepareEntityTransferResult =
  | { ok: true; reservation: EntityTransferReservation }
  | { error: EntityTransactionError; ok: false };

export type CommitEntityTransferResult =
  | { idempotent: boolean; ok: true; state: EntityRuntimeState }
  | { error: EntityTransactionError; ok: false; state: EntityRuntimeState };

export interface IssueTemporaryAccessGrantInput extends AccessRequirement {
  actionId: string;
  durationMs: number;
  issuedBy: string;
  now: number;
  subjectId: string;
}

export function createEntityRuntimeState(
  input: Partial<Omit<EntityRuntimeState, "revision">> & { revision?: number } = {},
): EntityRuntimeState {
  return {
    revision: input.revision ?? 0,
    entities: structuredClone(input.entities ?? {}),
    containers: structuredClone(input.containers ?? {}),
    ports: structuredClone(input.ports ?? {}),
    credentials: structuredClone(input.credentials ?? {}),
    grants: structuredClone(input.grants ?? {}),
    committedActionIds: [...(input.committedActionIds ?? [])],
    events: structuredClone(input.events ?? []),
  };
}

function transactionError(
  code: EntityTransactionErrorCode,
  message: string,
): PrepareEntityTransferResult {
  return { ok: false, error: { code, message } };
}

function matchesTags(entity: RuntimeEntity, matcher: EntityTagMatcher) {
  const tags = new Set(entity.tags);
  if (!matcher.all.every((tag) => tags.has(tag))) return false;
  return matcher.any.length === 0 || matcher.any.some((tag) => tags.has(tag));
}

function isCredentialUsableBy(
  state: EntityRuntimeState,
  actorId: string,
  credentialEntityId: string,
  now: number,
) {
  const entity = state.entities[credentialEntityId];
  const credential = state.credentials[credentialEntityId];
  if (!entity || !credential) return false;
  if (credential.expiresAt !== null && credential.expiresAt <= now) return false;
  return entity.ownerId === actorId;
}

export function hasEntityAccess(
  state: EntityRuntimeState,
  actorId: string,
  requirement: AccessRequirement,
  credentialEntityIds: readonly string[],
  now: number,
) {
  const hasGrant = Object.values(state.grants).some((grant) => (
    grant.subjectId === actorId
    && grant.capability === requirement.capability
    && grant.scopeEntityId === requirement.scopeEntityId
    && grant.expiresAt > now
  ));
  if (hasGrant) return true;

  return credentialEntityIds.some((entityId) => {
    if (!isCredentialUsableBy(state, actorId, entityId, now)) return false;
    const credential = state.credentials[entityId]!;
    const capabilityMatches = credential.capabilities.includes(requirement.capability);
    const scopeMatches = credential.scopeEntityIds.includes("*")
      || credential.scopeEntityIds.includes(requirement.scopeEntityId);
    return capabilityMatches && scopeMatches;
  });
}

function uniqueRequirements(requirements: readonly AccessRequirement[]) {
  const seen = new Set<string>();
  return requirements.filter((requirement) => {
    const key = `${requirement.capability}:${requirement.scopeEntityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateTransfer(
  state: EntityRuntimeState,
  request: EntityTransferRequest,
): PrepareEntityTransferResult {
  if (!request.actionId.trim()) {
    return transactionError("action-id-required", "实体转移必须提供稳定的动作 ID。");
  }

  const seenEntityIds = new Set<string>();
  const requirements = [...request.requirements];
  const containerDeltas = new Map<string, number>();

  for (const leg of request.legs) {
    if (seenEntityIds.has(leg.entityId)) {
      return transactionError("duplicate-entity", `同一事务不能重复转移实体：${leg.entityId}`);
    }
    seenEntityIds.add(leg.entityId);
    const entity = state.entities[leg.entityId];
    if (!entity) {
      return transactionError("entity-not-found", `找不到待转移实体：${leg.entityId}`);
    }
    if (entity.ownerId !== leg.expectedOwnerId || entity.containerId !== leg.expectedContainerId) {
      return transactionError("source-mismatch", `实体 ${entity.label} 的所有者或容器已经变化。`);
    }

    if (leg.expectedContainerId !== null) {
      const sourceContainer = state.containers[leg.expectedContainerId];
      if (!sourceContainer) {
        return transactionError("container-not-found", `找不到来源容器：${leg.expectedContainerId}`);
      }
      if (!sourceContainer.entityIds.includes(leg.entityId)) {
        return transactionError("source-mismatch", `来源容器不包含实体：${entity.label}`);
      }
      containerDeltas.set(
        leg.expectedContainerId,
        (containerDeltas.get(leg.expectedContainerId) ?? 0) - 1,
      );
    }
    if (leg.targetContainerId !== null) {
      if (!state.containers[leg.targetContainerId]) {
        return transactionError("container-not-found", `找不到目标容器：${leg.targetContainerId}`);
      }
      containerDeltas.set(
        leg.targetContainerId,
        (containerDeltas.get(leg.targetContainerId) ?? 0) + 1,
      );
    }

    if (leg.portId !== null) {
      const port = state.ports[leg.portId];
      if (!port) {
        return transactionError("port-not-found", `找不到实体输入端口：${leg.portId}`);
      }
      if (port.targetContainerId !== leg.targetContainerId || port.targetOwnerId !== leg.targetOwnerId) {
        return transactionError("port-target-mismatch", `输入端口 ${port.label} 与目标所有者或容器不匹配。`);
      }
      if (!matchesTags(entity, port.accepts)) {
        return transactionError("entity-rejected", `输入端口 ${port.label} 不接受实体 ${entity.label}。`);
      }
      requirements.push(...port.requirements);
    }
  }

  for (const [containerId, delta] of containerDeltas) {
    const container = state.containers[containerId]!;
    if (container.entityIds.length + delta > container.capacity) {
      return transactionError("container-capacity", `容器 ${container.label} 没有足够容量。`);
    }
  }

  const deniedRequirement = uniqueRequirements(requirements).find((requirement) => (
    !hasEntityAccess(
      state,
      request.actorId,
      requirement,
      request.credentialEntityIds,
      request.now,
    )
  ));
  if (deniedRequirement) {
    return transactionError(
      "access-denied",
      `缺少能力 ${deniedRequirement.capability}（作用域：${deniedRequirement.scopeEntityId}）。`,
    );
  }

  return { ok: true, reservation: { ...structuredClone(request), status: "prepared" } };
}

export function prepareEntityTransfer(
  state: EntityRuntimeState,
  request: EntityTransferRequest,
): PrepareEntityTransferResult {
  if (state.revision !== request.expectedRevision) {
    return transactionError("revision-conflict", "世界状态已更新，请基于最新修订重新发起操作。");
  }
  if (state.committedActionIds.includes(request.actionId)) {
    return { ok: true, reservation: { ...structuredClone(request), status: "prepared" } };
  }
  return validateTransfer(state, request);
}

export function cancelEntityTransfer(
  reservation: EntityTransferReservation,
): EntityTransferReservation {
  return { ...structuredClone(reservation), status: "cancelled" };
}

function cloneRuntimeState(state: EntityRuntimeState) {
  return createEntityRuntimeState(state);
}

export function commitEntityTransfer(
  state: EntityRuntimeState,
  reservation: EntityTransferReservation,
): CommitEntityTransferResult {
  if (state.committedActionIds.includes(reservation.actionId)) {
    return { ok: true, state, idempotent: true };
  }
  if (reservation.status === "cancelled") {
    return {
      ok: false,
      state,
      error: { code: "reservation-cancelled", message: "已取消的实体转移不能提交。" },
    };
  }
  if (state.revision !== reservation.expectedRevision) {
    return {
      ok: false,
      state,
      error: { code: "revision-conflict", message: "提交时世界状态已变化，事务未执行。" },
    };
  }

  const validation = validateTransfer(state, reservation);
  if (!validation.ok) return { ...validation, state };

  const next = cloneRuntimeState(state);
  const touchedContainers = new Set<string>();
  for (const leg of reservation.legs) {
    if (leg.expectedContainerId !== null) {
      const source = next.containers[leg.expectedContainerId]!;
      source.entityIds = source.entityIds.filter((entityId) => entityId !== leg.entityId);
      touchedContainers.add(source.id);
    }
    if (leg.targetContainerId !== null) {
      const target = next.containers[leg.targetContainerId]!;
      target.entityIds.push(leg.entityId);
      touchedContainers.add(target.id);
    }
    const entity = next.entities[leg.entityId]!;
    entity.ownerId = leg.targetOwnerId;
    entity.containerId = leg.targetContainerId;
    entity.revision += 1;
  }
  touchedContainers.forEach((containerId) => {
    next.containers[containerId]!.revision += 1;
  });
  next.revision += 1;
  next.committedActionIds.push(reservation.actionId);
  next.events.push({
    type: "entity.transfer.committed",
    actionId: reservation.actionId,
    actorId: reservation.actorId,
    entityIds: reservation.legs.map((leg) => leg.entityId),
    revision: next.revision,
  });
  return { ok: true, state: next, idempotent: false };
}

export function executeEntityTransfer(
  state: EntityRuntimeState,
  request: EntityTransferRequest,
): CommitEntityTransferResult {
  const prepared = prepareEntityTransfer(state, request);
  if (!prepared.ok) return { ...prepared, state };
  return commitEntityTransfer(state, prepared.reservation);
}

export function issueTemporaryAccessGrant(
  state: EntityRuntimeState,
  input: IssueTemporaryAccessGrantInput,
): EntityRuntimeState {
  if (input.durationMs <= 0 || !Number.isFinite(input.durationMs)) {
    throw new Error("临时授权时长必须大于零。");
  }
  const grantId = `grant:${input.actionId}`;
  if (state.grants[grantId]) return state;
  const next = cloneRuntimeState(state);
  next.grants[grantId] = {
    id: grantId,
    subjectId: input.subjectId,
    issuedBy: input.issuedBy,
    capability: input.capability,
    scopeEntityId: input.scopeEntityId,
    expiresAt: input.now + input.durationMs,
  };
  next.revision += 1;
  next.committedActionIds.push(input.actionId);
  next.events.push({
    type: "access.grant.issued",
    actionId: input.actionId,
    actorId: input.subjectId,
    entityIds: [],
    revision: next.revision,
  });
  return next;
}
