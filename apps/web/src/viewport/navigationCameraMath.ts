import * as THREE from "three";
import type { NavigationCameraMode } from "./types";

export const NAVIGATION_MOUSE_YAW_SENSITIVITY = 0.0026;
export const NAVIGATION_MOUSE_PITCH_SENSITIVITY = 0.0026;

const FIRST_PERSON_MIN_PITCH = THREE.MathUtils.degToRad(-80);
const FIRST_PERSON_MAX_PITCH = THREE.MathUtils.degToRad(80);
export const THIRD_PERSON_BASE_ELEVATION = THREE.MathUtils.degToRad(17);
export const THIRD_PERSON_MIN_ELEVATION = THREE.MathUtils.degToRad(-55);
export const THIRD_PERSON_MAX_ELEVATION = THREE.MathUtils.degToRad(80);
export const THIRD_PERSON_MIN_HEIGHT_RATIO = 0.08;
export const THIRD_PERSON_AVATAR_FADE_NEAR_RATIO = 0.2;
export const THIRD_PERSON_AVATAR_FADE_FAR_RATIO = 0.5;

export function getNavigationCameraPitchRange(mode: NavigationCameraMode) {
  if (mode === "third-person") {
    return {
      maximum: THIRD_PERSON_MAX_ELEVATION - THIRD_PERSON_BASE_ELEVATION,
      minimum: THIRD_PERSON_MIN_ELEVATION - THIRD_PERSON_BASE_ELEVATION,
    };
  }
  return {
    maximum: FIRST_PERSON_MAX_PITCH,
    minimum: FIRST_PERSON_MIN_PITCH,
  };
}

export function clampNavigationCameraPitch(mode: NavigationCameraMode, pitch: number) {
  const range = getNavigationCameraPitchRange(mode);
  return THREE.MathUtils.clamp(pitch, range.minimum, range.maximum);
}

export function resolveThirdPersonElevation(pitch: number) {
  return THIRD_PERSON_BASE_ELEVATION
    + clampNavigationCameraPitch("third-person", pitch);
}

export function clampThirdPersonCameraHeight(
  cameraY: number,
  floorY: number,
  agentHeight: number,
) {
  return Math.max(cameraY, floorY + agentHeight * THIRD_PERSON_MIN_HEIGHT_RATIO);
}

export function resolveThirdPersonAvatarOpacity(cameraDistance: number, agentHeight: number) {
  const safeHeight = Math.max(1, agentHeight);
  const nearDistance = safeHeight * THIRD_PERSON_AVATAR_FADE_NEAR_RATIO;
  const farDistance = safeHeight * THIRD_PERSON_AVATAR_FADE_FAR_RATIO;
  return THREE.MathUtils.smoothstep(cameraDistance, nearDistance, farDistance);
}
