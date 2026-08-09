export class RuntimeEventStoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RuntimeEventStoreError";
  }
}

export class RuntimeEventRevisionConflictError extends RuntimeEventStoreError {
  constructor(
    public readonly expectedRevision: number,
    public readonly actualRevision: number,
  ) {
    super(
      "revision-conflict",
      `事件流修订冲突：期望 ${expectedRevision}，当前为 ${actualRevision}。`,
    );
    this.name = "RuntimeEventRevisionConflictError";
  }
}

export class RuntimeEventIdempotencyConflictError extends RuntimeEventStoreError {
  constructor(public readonly idempotencyKey: string) {
    super("idempotency-conflict", `幂等键 ${idempotencyKey} 已用于不同的事件请求。`);
    this.name = "RuntimeEventIdempotencyConflictError";
  }
}

export class RuntimeEventCorruptionError extends RuntimeEventStoreError {
  constructor(message: string) {
    super("event-stream-corrupted", message);
    this.name = "RuntimeEventCorruptionError";
  }
}

export class RuntimeEventCursorError extends RuntimeEventStoreError {
  constructor(message: string) {
    super("invalid-event-cursor", message);
    this.name = "RuntimeEventCursorError";
  }
}
