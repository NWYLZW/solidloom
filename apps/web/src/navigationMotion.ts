export interface NavigationMotionProfile {
  acceleration: number;
  braking: number;
  pathSpeed: number;
  runSpeed: number;
  seatedSpeed: number;
  walkSpeed: number;
}

interface MutableNavigationVelocity {
  x: number;
  y: number;
  z: number;
}

interface NavigationVelocity {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const REFERENCE_AGENT_HEIGHT = 1720;

export function resolveNavigationMotionProfile(agentHeight: number): NavigationMotionProfile {
  const scale = Math.max(1, agentHeight) / REFERENCE_AGENT_HEIGHT;
  return {
    acceleration: 4800 * scale,
    braking: 6800 * scale,
    pathSpeed: 1500 * scale,
    runSpeed: 3600 * scale,
    seatedSpeed: 720 * scale,
    walkSpeed: 1500 * scale,
  };
}

export function resolveNavigationPathSpeed(
  profile: NavigationMotionProfile,
  currentSpeed: number,
  remainingDistance: number,
  finalSegment: boolean,
  deltaSeconds: number,
) {
  const safeCurrentSpeed = Math.max(0, currentSpeed);
  const stoppingSpeed = finalSegment
    ? Math.sqrt(2 * profile.braking * Math.max(0, remainingDistance))
    : profile.pathSpeed;
  const targetSpeed = Math.min(profile.pathSpeed, stoppingSpeed);
  const maximumChange = (targetSpeed >= safeCurrentSpeed
    ? profile.acceleration
    : profile.braking) * Math.max(0, deltaSeconds);
  return targetSpeed >= safeCurrentSpeed
    ? Math.min(targetSpeed, safeCurrentSpeed + maximumChange)
    : Math.max(targetSpeed, safeCurrentSpeed - maximumChange);
}

export function moveNavigationVelocityToward(
  current: MutableNavigationVelocity,
  target: NavigationVelocity,
  maxDelta: number,
) {
  const deltaX = target.x - current.x;
  const deltaY = target.y - current.y;
  const deltaZ = target.z - current.z;
  const distance = Math.hypot(deltaX, deltaY, deltaZ);
  if (distance <= maxDelta || distance < 0.0001) {
    current.x = target.x;
    current.y = target.y;
    current.z = target.z;
    return;
  }
  if (maxDelta <= 0) return;
  const scale = maxDelta / distance;
  current.x += deltaX * scale;
  current.y += deltaY * scale;
  current.z += deltaZ * scale;
}
