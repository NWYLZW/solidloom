import type { MeshFeature, ProceduralMeshSource, Vector3Tuple } from "../../types.js";
import { recessedLaptopDeck, recessedRoundedPanel } from "./panels.js";
import { normalizeRoomShellSource, proceduralRoomShell } from "./roomGeometry.js";

export function regenerateProceduralMeshFeature(feature: MeshFeature, source: ProceduralMeshSource): MeshFeature {
  const normalized: ProceduralMeshSource = source.kind === "recessed-deck"
    ? (() => {
      const size = source.size.map((value) => Math.max(0.01, value)) as Vector3Tuple;
      const outlineRadius = Math.min(Math.max(0, source.outlineRadius), size[0] / 2, size[2] / 2);
      return {
        ...source,
        size,
        outlineRadius,
        edgeFilletRadius: Math.min(Math.max(0, source.edgeFilletRadius), size[1] / 2, outlineRadius),
        recesses: source.recesses.map((recess) => ({
          center: [...recess.center] as [number, number],
          size: [
            Math.min(Math.max(0.01, recess.size[0]), size[0]),
            Math.min(Math.max(0.01, recess.size[1]), size[2]),
          ],
          depth: Math.min(Math.max(0, recess.depth), size[1]),
        })),
      };
    })()
    : source.kind === "recessed-panel"
      ? (() => {
        const size = source.size.map((value) => Math.max(0.01, value)) as Vector3Tuple;
        const outlineRadius = Math.min(Math.max(0, source.outlineRadius), size[0] / 2, size[1] / 2);
        return {
          ...source,
          size,
          recessSize: [
            Math.min(Math.max(0.01, source.recessSize[0]), size[0]),
            Math.min(Math.max(0.01, source.recessSize[1]), size[1]),
            Math.min(Math.max(0, source.recessSize[2]), size[2]),
          ],
          outlineRadius,
          recessRadius: Math.min(Math.max(0, source.recessRadius), size[0] / 2, size[1] / 2),
          edgeFilletRadius: Math.min(Math.max(0, source.edgeFilletRadius), size[2] / 2, outlineRadius),
        };
      })()
      : normalizeRoomShellSource(source);
  const regenerated = normalized.kind === "recessed-deck"
    ? recessedLaptopDeck(
      feature.id,
      feature.name,
      normalized.size,
      feature.position,
      normalized.recesses,
      normalized.outlineRadius,
      normalized.edgeFilletRadius,
    )
    : normalized.kind === "recessed-panel"
      ? recessedRoundedPanel(
        feature.id,
        feature.name,
        normalized.size,
        normalized.recessSize,
        feature.position,
        feature.rotation,
        normalized.outlineRadius,
        normalized.recessRadius,
        normalized.edgeFilletRadius,
      )
      : proceduralRoomShell(
        feature.id,
        feature.name,
        feature.position,
        normalized,
      );
  return {
    ...feature,
    parameters: regenerated.parameters,
  };
}
