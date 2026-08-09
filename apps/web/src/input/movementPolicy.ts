import type { InputContext } from "./types";

export type InputMovementPolicy = "lock" | "close-on-move" | "allow";

export interface MovementIntent {
  x: number;
  y: number;
}

export function resolveMovementIntent(
  context: InputContext,
  policy: InputMovementPolicy | null,
  movement: MovementIntent,
) {
  const active = Math.hypot(movement.x, movement.y) > 0.01;
  if (context === "menu") {
    return { closePanel: false, movement: { x: 0, y: 0 } };
  }
  if (context !== "device" || policy === null || policy === "allow") {
    return { closePanel: false, movement };
  }
  if (policy === "close-on-move") {
    return { closePanel: active, movement };
  }
  return { closePanel: false, movement: { x: 0, y: 0 } };
}
