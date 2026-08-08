import * as THREE from "three";

export const ORBIT_MIN_POLAR_ANGLE = THREE.MathUtils.degToRad(3);
export const ORBIT_MAX_POLAR_ANGLE = Math.PI - ORBIT_MIN_POLAR_ANGLE;
export const ORBIT_ROTATION_SENSITIVITY = 0.008;

export function clampOrbitDirection(direction: THREE.Vector3) {
  const spherical = new THREE.Spherical().setFromVector3(direction.clone().normalize());
  spherical.phi = THREE.MathUtils.clamp(
    spherical.phi,
    ORBIT_MIN_POLAR_ANGLE,
    ORBIT_MAX_POLAR_ANGLE,
  );
  return new THREE.Vector3().setFromSpherical(spherical).normalize();
}

export function rotateOrbitOffset(
  offset: THREE.Vector3,
  deltaX: number,
  deltaY: number,
) {
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= deltaX * ORBIT_ROTATION_SENSITIVITY;
  spherical.phi = THREE.MathUtils.clamp(
    spherical.phi - deltaY * ORBIT_ROTATION_SENSITIVITY,
    ORBIT_MIN_POLAR_ANGLE,
    ORBIT_MAX_POLAR_ANGLE,
  );
  return offset.setFromSpherical(spherical);
}
