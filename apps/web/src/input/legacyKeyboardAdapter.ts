import type { InputContext } from "./types";

export interface NavigationSemanticFrame {
  context: InputContext;
  crouch: boolean;
  jump: boolean;
  look: { x: number; y: number };
  lookDelta: { x: number; y: number };
  move: { x: number; y: number };
  precise: boolean;
  sprint: boolean;
  vertical: number;
}

export const EMPTY_NAVIGATION_SEMANTIC_FRAME: NavigationSemanticFrame = {
  context: "gameplay",
  crouch: false,
  jump: false,
  look: { x: 0, y: 0 },
  lookDelta: { x: 0, y: 0 },
  move: { x: 0, y: 0 },
  precise: false,
  sprint: false,
  vertical: 0,
};

export function navigationFrameFromKeyboard(codes: ReadonlySet<string>): NavigationSemanticFrame {
  return {
    context: "gameplay",
    crouch: codes.has("ControlLeft") || codes.has("ControlRight"),
    jump: codes.has("Space"),
    look: {
      x: Number(codes.has("ArrowRight")) - Number(codes.has("ArrowLeft")),
      y: Number(codes.has("ArrowDown")) - Number(codes.has("ArrowUp")),
    },
    lookDelta: { x: 0, y: 0 },
    move: {
      x: Number(codes.has("KeyD")) - Number(codes.has("KeyA")),
      y: Number(codes.has("KeyW")) - Number(codes.has("KeyS")),
    },
    precise: codes.has("AltLeft") || codes.has("AltRight"),
    sprint: codes.has("ShiftLeft") || codes.has("ShiftRight"),
    vertical: Number(codes.has("KeyE")) - Number(codes.has("KeyQ")),
  };
}

export function navigationFrameFromSnapshot(
  snapshot: import("./types").SemanticInputSnapshot,
  lookDelta = { x: 0, y: 0 },
) {
  return {
    context: snapshot.context,
    crouch: snapshot.actions.crouch.held,
    jump: snapshot.actions.jump.held,
    look: snapshot.look,
    lookDelta,
    move: snapshot.move,
    precise: false,
    sprint: snapshot.actions.sprint.held,
    vertical: 0,
  } satisfies NavigationSemanticFrame;
}
