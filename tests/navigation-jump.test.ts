import { describe, expect, it } from "vitest";
import {
  createNavigationJumpState,
  resetNavigationJumpState,
  stepNavigationJump,
} from "../apps/web/src/navigationJump";

const jumpOptions = {
  deltaSeconds: 1 / 60,
  gravity: 9800,
  jumpPressed: true,
  jumpVelocity: 3100,
};

describe("navigation jump", () => {
  it("starts only on the rising edge of the space key", () => {
    const state = createNavigationJumpState();

    stepNavigationJump(state, jumpOptions);
    const firstVelocity = state.verticalVelocity;
    stepNavigationJump(state, jumpOptions);

    expect(state.grounded).toBe(false);
    expect(state.verticalVelocity).toBeLessThan(firstVelocity);
  });

  it("lands on the navigation floor without sinking below it", () => {
    const state = createNavigationJumpState();
    stepNavigationJump(state, jumpOptions);
    for (let frame = 0; frame < 120; frame += 1) {
      stepNavigationJump(state, { ...jumpOptions, jumpPressed: false });
    }

    expect(state).toMatchObject({
      grounded: true,
      verticalOffset: 0,
      verticalVelocity: 0,
    });
  });

  it("does not allow a second jump while airborne", () => {
    const state = createNavigationJumpState();
    stepNavigationJump(state, jumpOptions);
    stepNavigationJump(state, { ...jumpOptions, jumpPressed: false });
    const velocityBeforeSecondPress = state.verticalVelocity;
    stepNavigationJump(state, jumpOptions);

    expect(state.verticalVelocity).toBeLessThan(velocityBeforeSecondPress);
  });

  it("resets the jump when the agent becomes seated", () => {
    const state = createNavigationJumpState();
    stepNavigationJump(state, jumpOptions);

    expect(resetNavigationJumpState(state, true)).toBe(true);
    expect(state).toEqual({
      grounded: true,
      inputLatched: true,
      verticalOffset: 0,
      verticalVelocity: 0,
    });
  });
});
