export interface NavigationJumpState {
  grounded: boolean;
  inputLatched: boolean;
  verticalOffset: number;
  verticalVelocity: number;
}

interface NavigationJumpStepOptions {
  deltaSeconds: number;
  gravity: number;
  jumpPressed: boolean;
  jumpVelocity: number;
}

const MAXIMUM_JUMP_STEP_SECONDS = 0.05;

export function createNavigationJumpState(
  verticalOffset = 0,
  verticalVelocity = 0,
): NavigationJumpState {
  const safeOffset = Math.max(0, verticalOffset);
  const grounded = safeOffset <= 0.001 && verticalVelocity <= 0;
  return {
    grounded,
    inputLatched: false,
    verticalOffset: grounded ? 0 : safeOffset,
    verticalVelocity: grounded ? 0 : verticalVelocity,
  };
}

export function resetNavigationJumpState(
  state: NavigationJumpState,
  jumpPressed: boolean,
) {
  const changed = !state.grounded
    || state.verticalOffset !== 0
    || state.verticalVelocity !== 0
    || state.inputLatched !== jumpPressed;
  state.grounded = true;
  state.inputLatched = jumpPressed;
  state.verticalOffset = 0;
  state.verticalVelocity = 0;
  return changed;
}

export function stepNavigationJump(
  state: NavigationJumpState,
  {
    deltaSeconds,
    gravity,
    jumpPressed,
    jumpVelocity,
  }: NavigationJumpStepOptions,
) {
  let changed = false;
  if (jumpPressed && !state.inputLatched && state.grounded) {
    state.grounded = false;
    state.verticalVelocity = jumpVelocity;
    changed = true;
  }
  state.inputLatched = jumpPressed;
  if (state.grounded) return changed;

  let remainingSeconds = Math.max(0, deltaSeconds);
  while (remainingSeconds > 0 && !state.grounded) {
    const stepSeconds = Math.min(remainingSeconds, MAXIMUM_JUMP_STEP_SECONDS);
    state.verticalOffset += state.verticalVelocity * stepSeconds
      - 0.5 * gravity * stepSeconds * stepSeconds;
    state.verticalVelocity -= gravity * stepSeconds;
    remainingSeconds -= stepSeconds;
    changed = true;
    if (state.verticalOffset <= 0 && state.verticalVelocity <= 0) {
      state.grounded = true;
      state.verticalOffset = 0;
      state.verticalVelocity = 0;
    }
  }
  return changed;
}
