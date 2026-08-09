export class RuntimeSnapshotError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RuntimeSnapshotError";
  }
}

export class RuntimeSnapshotRevisionConflictError extends RuntimeSnapshotError {
  constructor(
    public readonly expectedRevision: number | null,
    public readonly actualRevision: number | null,
  ) {
    super(
      "snapshot-revision-conflict",
      `快照修订冲突：期望最新状态修订 ${expectedRevision ?? "无"}，当前为 ${actualRevision ?? "无"}。`,
    );
    this.name = "RuntimeSnapshotRevisionConflictError";
  }
}

export class RuntimeSnapshotStreamConflictError extends RuntimeSnapshotError {
  constructor(message: string) {
    super("snapshot-stream-conflict", message);
    this.name = "RuntimeSnapshotStreamConflictError";
  }
}

export class RuntimeSnapshotCorruptionError extends RuntimeSnapshotError {
  constructor(message: string) {
    super("snapshot-corrupted", message);
    this.name = "RuntimeSnapshotCorruptionError";
  }
}

export class RuntimeRecoveryError extends RuntimeSnapshotError {
  constructor(message: string, public readonly cause?: unknown) {
    super("runtime-recovery-failed", message);
    this.name = "RuntimeRecoveryError";
  }
}
