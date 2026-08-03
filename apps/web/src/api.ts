import type {
  CreateModelInput,
  FeatureGraph,
  ModelList,
  ModelRecord,
  UpdateModelInput,
} from "@solidloom/shared";

export interface HealthResponse {
  status: "ok";
  service: "solidloom";
  version: string;
  time: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null) as { error?: string; message?: string } | T | null;
  if (!response.ok) {
    const error = body as { error?: string; message?: string } | null;
    throw new ApiError(response.status, error?.error ?? "request_failed", error?.message ?? `${response.status} ${response.statusText}`);
  }
  return body as T;
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/api/health");
}

export function listModels(): Promise<ModelList> {
  return requestJson<ModelList>("/api/models");
}

export function createModel(input: CreateModelInput): Promise<ModelRecord> {
  return requestJson<ModelRecord>("/api/models", { method: "POST", body: JSON.stringify(input) });
}

export function getModel(modelId: string): Promise<ModelRecord> {
  return requestJson<ModelRecord>(`/api/models/${encodeURIComponent(modelId)}`);
}

export function updateModel(modelId: string, input: UpdateModelInput): Promise<ModelRecord> {
  return requestJson<ModelRecord>(`/api/models/${encodeURIComponent(modelId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function replaceFeatureGraph(modelId: string, expectedRevision: number, featureGraph: FeatureGraph): Promise<ModelRecord> {
  return requestJson<ModelRecord>(`/api/models/${encodeURIComponent(modelId)}/features`, {
    method: "PUT",
    body: JSON.stringify({ expectedRevision, featureGraph }),
  });
}
