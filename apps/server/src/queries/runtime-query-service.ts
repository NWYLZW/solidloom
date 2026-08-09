import {
  RUNTIME_QUERY_CAPABILITIES,
  assertRuntimeCapability,
  executeRuntimeQuery,
  inspectRuntimeQueryCursor,
  materializeRuntimeSavedQuery,
  RuntimeQueryCursorError,
  type RuntimeAuthorizationContext,
  type RuntimeDomainSnapshot,
  type RuntimeQuery,
  type RuntimeQueryPageRequest,
  type RuntimeQueryPrincipal,
  type RuntimeQueryResult,
  type RuntimeSavedQueryView,
} from "@solidloom/shared";
import { RuntimePermissionService } from "../permissions/runtime-permission-service.js";

export interface RuntimeSnapshotReadRequest {
  readonly runId: string;
  /** A cursor pins pagination to this exact snapshot revision. */
  readonly revision?: number;
}

/**
 * The sole world-state dependency of the query service. Implementations may read
 * SQLite or another store, but callers never receive that adapter or a table API.
 */
export interface RuntimeSnapshotReader {
  readSnapshot(request: RuntimeSnapshotReadRequest): Promise<RuntimeDomainSnapshot | null>;
}

export interface RuntimeSavedQueryViewReader {
  readSavedQueryView(viewId: string): Promise<RuntimeSavedQueryView | null>;
}

export class RuntimeQueryServiceError extends Error {
  readonly code: "run-not-found" | "saved-view-not-found" | "snapshot-revision-unavailable";

  constructor(code: RuntimeQueryServiceError["code"], message: string) {
    super(message);
    this.name = "RuntimeQueryServiceError";
    this.code = code;
  }
}

export interface RuntimeQueryServiceOptions {
  readonly snapshots: RuntimeSnapshotReader;
  readonly permissions: RuntimePermissionService;
  readonly savedViews?: RuntimeSavedQueryViewReader;
}

export class RuntimeQueryService {
  readonly #snapshots: RuntimeSnapshotReader;
  readonly #permissions: RuntimePermissionService;
  readonly #savedViews: RuntimeSavedQueryViewReader | undefined;

  constructor(options: RuntimeQueryServiceOptions) {
    this.#snapshots = options.snapshots;
    this.#permissions = options.permissions;
    this.#savedViews = options.savedViews;
  }

  async execute(principal: RuntimeQueryPrincipal, query: RuntimeQuery): Promise<RuntimeQueryResult> {
    const authorization = await this.#permissions.createAuthorizationContext(principal);
    return this.#executeAuthorized(authorization, query);
  }

  async executeSavedView(options: {
    readonly principal: RuntimeQueryPrincipal;
    readonly viewId: string;
    readonly runId: string;
    readonly page?: RuntimeQueryPageRequest;
  }): Promise<RuntimeQueryResult> {
    const authorization = await this.#permissions.createAuthorizationContext(options.principal);
    assertRuntimeCapability(authorization, RUNTIME_QUERY_CAPABILITIES.savedViews);
    if (!this.#savedViews) {
      throw new RuntimeQueryServiceError("saved-view-not-found", "未配置保存查询视图读取器");
    }
    const view = await this.#savedViews.readSavedQueryView(options.viewId);
    if (!view) {
      throw new RuntimeQueryServiceError("saved-view-not-found", `保存查询视图 ${options.viewId} 不存在`);
    }
    const query = materializeRuntimeSavedQuery(view, options.runId, options.page);
    return this.#executeAuthorized(authorization, query);
  }

  async #executeAuthorized(
    authorization: RuntimeAuthorizationContext,
    query: RuntimeQuery,
  ): Promise<RuntimeQueryResult> {
    let revision: number | undefined;
    if (query.page?.cursor) {
      const cursor = inspectRuntimeQueryCursor(query.page.cursor);
      if (cursor.runId !== query.runId || cursor.kind !== query.kind) {
        throw new RuntimeQueryCursorError("cursor-mismatch", "查询游标不属于当前查询");
      }
      revision = cursor.baseRevision;
    }
    const request = revision === undefined ? { runId: query.runId } : { runId: query.runId, revision };
    const snapshot = await this.#snapshots.readSnapshot(request);
    if (!snapshot) {
      if (revision !== undefined) {
        throw new RuntimeQueryServiceError(
          "snapshot-revision-unavailable",
          `运行实例 ${query.runId} 的修订 ${revision} 不可用，请重新开始分页`,
        );
      }
      throw new RuntimeQueryServiceError("run-not-found", `运行实例 ${query.runId} 不存在`);
    }
    if (revision !== undefined && snapshot.revision !== revision) {
      throw new RuntimeQueryServiceError(
        "snapshot-revision-unavailable",
        `快照读取器未返回游标要求的修订 ${revision}`,
      );
    }
    return executeRuntimeQuery(snapshot, query, authorization);
  }
}
