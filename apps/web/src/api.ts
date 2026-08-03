import type { ModelList } from "@solidloom/shared";

export interface HealthResponse {
  status: "ok";
  service: "solidloom";
  version: string;
  time: string;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>("/api/health");
}

export function listModels(): Promise<ModelList> {
  return getJson<ModelList>("/api/models");
}
