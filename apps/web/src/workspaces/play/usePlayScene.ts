import { useEffect, useMemo, useState } from "react";
import type { ModelRecord } from "@solidloom/shared";
import { listModels } from "../../api";
import { resolveSceneRuntimeModel } from "../../sceneRuntimeModel";

export function usePlayScene(sceneId: string) {
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void listModels()
      .then((result) => {
        if (!cancelled) setModels(result.items);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  const scene = models.find((model) => model.id === sceneId && model.kind === "scene") ?? null;
  const runtimeModel = useMemo(
    () => scene ? resolveSceneRuntimeModel(scene, models) : null,
    [models, scene],
  );

  return { error, loading, runtimeModel, scene };
}
