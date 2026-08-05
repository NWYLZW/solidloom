export function readPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = window.localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function readNumberPreference(key: string, fallback: number, minimum: number, maximum: number): number {
  try {
    const storedValue = window.localStorage.getItem(key);
    if (storedValue === null) return fallback;
    const value = Number(storedValue);
    return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
  } catch {
    return fallback;
  }
}

export function readTextPreference(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key)?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
