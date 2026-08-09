export interface TouchPoint {
  x: number;
  y: number;
}

export interface TouchJoystickResult {
  knob: TouchPoint;
  value: TouchPoint;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resolveTouchJoystick(
  origin: TouchPoint,
  current: TouchPoint,
  radius: number,
  deadzone = 0.12,
): TouchJoystickResult {
  const safeRadius = Math.max(1, radius);
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const clampedDistance = Math.min(distance, safeRadius);
  const directionX = distance > 0 ? dx / distance : 0;
  const directionY = distance > 0 ? dy / distance : 0;
  const rawMagnitude = clampedDistance / safeRadius;
  const magnitude = rawMagnitude <= deadzone
    ? 0
    : clamp((rawMagnitude - deadzone) / Math.max(0.01, 1 - deadzone), 0, 1);
  return {
    knob: {
      x: directionX * clampedDistance,
      y: directionY * clampedDistance,
    },
    value: {
      x: directionX * magnitude,
      y: directionY * magnitude,
    },
  };
}

export function resolveTouchLookDelta(
  deltaX: number,
  deltaY: number,
  sensitivity = 1,
  invertY = false,
) {
  const radiansPerPixel = 0.0032 * clamp(sensitivity, 0.1, 3);
  return {
    x: deltaX * radiansPerPixel,
    y: deltaY * radiansPerPixel * (invertY ? -1 : 1),
  };
}
