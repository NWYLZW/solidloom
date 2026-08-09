import { describe, expect, it } from "vitest";
import { resolveMovementIntent } from "./movementPolicy";

describe("device movement policies", () => {
  const movement = { x: 0.4, y: 0.8 };

  it("locks movement for occupied terminals", () => {
    expect(resolveMovementIntent("device", "lock", movement)).toEqual({
      closePanel: false,
      movement: { x: 0, y: 0 },
    });
  });

  it("closes a normal panel and preserves the same movement intent", () => {
    expect(resolveMovementIntent("device", "close-on-move", movement)).toEqual({
      closePanel: true,
      movement,
    });
  });

  it("allows movement while a lightweight HUD stays open", () => {
    expect(resolveMovementIntent("device", "allow", movement)).toEqual({
      closePanel: false,
      movement,
    });
  });

  it("suppresses gameplay movement while the system menu is on top", () => {
    expect(resolveMovementIntent("menu", "allow", movement)).toEqual({
      closePanel: false,
      movement: { x: 0, y: 0 },
    });
  });
});
