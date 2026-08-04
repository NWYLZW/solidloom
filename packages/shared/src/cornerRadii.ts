import type { BoxCornerKey, BoxCornerRadii, BoxFeature } from "./types.js";

export const BOX_CORNER_KEYS = [
  "xMinYMinZMin",
  "xMaxYMinZMin",
  "xMaxYMinZMax",
  "xMinYMinZMax",
  "xMinYMaxZMin",
  "xMaxYMaxZMin",
  "xMaxYMaxZMax",
  "xMinYMaxZMax",
] as const satisfies readonly BoxCornerKey[];

export const BOX_CORNER_LABELS: Record<BoxCornerKey, string> = {
  xMinYMinZMin: "x− y− z−",
  xMaxYMinZMin: "x+ y− z−",
  xMaxYMinZMax: "x+ y− z+",
  xMinYMinZMax: "x− y− z+",
  xMinYMaxZMin: "x− y+ z−",
  xMaxYMaxZMin: "x+ y+ z−",
  xMaxYMaxZMax: "x+ y+ z+",
  xMinYMaxZMax: "x− y+ z+",
};

export function uniformBoxCornerRadii(radius: number): BoxCornerRadii {
  return Object.fromEntries(BOX_CORNER_KEYS.map((key) => [key, radius])) as BoxCornerRadii;
}

export function resolveBoxCornerRadii(parameters: BoxFeature["parameters"]): BoxCornerRadii {
  const fallback = Math.max(parameters.cornerRadius ?? 0, 0);
  const configuredRadii = parameters.cornerRadii;
  if (!configuredRadii) return uniformBoxCornerRadii(fallback);
  return Object.fromEntries(BOX_CORNER_KEYS.map((key) => [
    key,
    Number.isFinite(configuredRadii[key]) ? Math.max(configuredRadii[key], 0) : fallback,
  ])) as BoxCornerRadii;
}

export function clampBoxCornerRadii(radii: BoxCornerRadii, maximumRadius: number): BoxCornerRadii {
  const maximum = Math.max(maximumRadius, 0);
  return Object.fromEntries(BOX_CORNER_KEYS.map((key) => [
    key,
    Math.min(Math.max(radii[key], 0), maximum),
  ])) as BoxCornerRadii;
}

export function boxCornerRadiiAreUniform(radii: BoxCornerRadii) {
  const first = radii[BOX_CORNER_KEYS[0]];
  return BOX_CORNER_KEYS.every((key) => Math.abs(radii[key] - first) < 1e-9);
}

export function parseBoxCornerRadiusExpression(expression: string): BoxCornerRadii | null {
  const body = expression
    .trim()
    .replace(/^corner-radius\s*:\s*/i, "")
    .replace(/;\s*$/, "")
    .replaceAll("/", " ");
  const tokens = body.split(/[\s,]+/).filter(Boolean);
  if (![1, 2, 4, 8].includes(tokens.length)) return null;
  const values = tokens.map(Number);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;

  if (values.length === 1) return uniformBoxCornerRadii(values[0]!);
  if (values.length === 2) {
    return Object.fromEntries(BOX_CORNER_KEYS.map((key, index) => [key, values[index < 4 ? 0 : 1]])) as BoxCornerRadii;
  }
  if (values.length === 4) {
    return Object.fromEntries(BOX_CORNER_KEYS.map((key, index) => [key, values[index % 4]])) as BoxCornerRadii;
  }
  return Object.fromEntries(BOX_CORNER_KEYS.map((key, index) => [key, values[index]])) as BoxCornerRadii;
}

function formatRadius(radius: number) {
  return Number(radius.toFixed(4)).toString();
}

export function formatBoxCornerRadiusExpression(radii: BoxCornerRadii) {
  const values = BOX_CORNER_KEYS.map((key) => radii[key]);
  if (boxCornerRadiiAreUniform(radii)) return formatRadius(values[0]!);
  if (values.slice(0, 4).every((value) => value === values[0])
    && values.slice(4).every((value) => value === values[4])) {
    return `${formatRadius(values[0]!)} / ${formatRadius(values[4]!)}`;
  }
  if (values.slice(0, 4).every((value, index) => value === values[index + 4])) {
    return values.slice(0, 4).map(formatRadius).join(" ");
  }
  return `${values.slice(0, 4).map(formatRadius).join(" ")} / ${values.slice(4).map(formatRadius).join(" ")}`;
}
