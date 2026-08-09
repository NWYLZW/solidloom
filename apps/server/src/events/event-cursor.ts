import { RuntimeEventCursorError } from "./errors.js";

interface RuntimeEventCursorPayload {
  readonly version: 1;
  readonly runId: string;
  readonly sequence: number;
}

export function encodeRuntimeEventCursor(runId: string, sequence: number): string {
  const payload: RuntimeEventCursorPayload = { version: 1, runId, sequence };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeRuntimeEventCursor(cursor: string, expectedRunId: string): number {
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<RuntimeEventCursorPayload>;
    if (payload.version !== 1 || payload.runId !== expectedRunId
      || !Number.isSafeInteger(payload.sequence) || (payload.sequence ?? -1) < 0) {
      throw new Error("cursor payload mismatch");
    }
    return payload.sequence as number;
  } catch (error) {
    if (error instanceof RuntimeEventCursorError) throw error;
    throw new RuntimeEventCursorError("事件游标无效或不属于当前运行实例。");
  }
}
