export const SEMANTIC_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly string[];
}

export function parseSemanticVersion(value: string): SemanticVersion | undefined {
  const match = SEMANTIC_VERSION_PATTERN.exec(value);
  if (!match) return undefined;
  return Object.freeze({
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: Object.freeze(match[4]?.split(".") ?? []),
  });
}

function comparePrerelease(left: readonly string[], right: readonly string[]): number {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : undefined;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : undefined;
    if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber - rightNumber;
    if (leftNumber !== undefined) return -1;
    if (rightNumber !== undefined) return 1;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

export function compareSemanticVersions(leftValue: string, rightValue: string): number {
  const left = parseSemanticVersion(leftValue);
  const right = parseSemanticVersion(rightValue);
  if (!left || !right) throw new Error(`无法比较无效的语义版本：${leftValue}、${rightValue}`);
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  if (left.patch !== right.patch) return left.patch - right.patch;
  return comparePrerelease(left.prerelease, right.prerelease);
}

type ComparatorOperator = "=" | ">" | ">=" | "<" | "<=";

interface VersionComparator {
  readonly operator: ComparatorOperator;
  readonly version: string;
}

function parseComparator(token: string): VersionComparator | undefined {
  const match = /^(>=|<=|>|<|=)?(.+)$/.exec(token);
  const version = match?.[2];
  if (!version || !parseSemanticVersion(version)) return undefined;
  return { operator: (match?.[1] as ComparatorOperator | undefined) ?? "=", version };
}

function incrementVersion(
  version: SemanticVersion,
  part: "major" | "minor" | "patch",
): string {
  if (part === "major") return `${version.major + 1}.0.0`;
  if (part === "minor") return `${version.major}.${version.minor + 1}.0`;
  return `${version.major}.${version.minor}.${version.patch + 1}`;
}

function expandRangeToken(token: string): readonly VersionComparator[] | undefined {
  if (token === "*") return [];
  if (token.startsWith("^")) {
    const value = token.slice(1);
    const version = parseSemanticVersion(value);
    if (!version) return undefined;
    const upper = version.major > 0
      ? incrementVersion(version, "major")
      : version.minor > 0
        ? incrementVersion(version, "minor")
        : incrementVersion(version, "patch");
    return [{ operator: ">=", version: value }, { operator: "<", version: upper }];
  }
  if (token.startsWith("~")) {
    const value = token.slice(1);
    const version = parseSemanticVersion(value);
    if (!version) return undefined;
    return [
      { operator: ">=", version: value },
      { operator: "<", version: incrementVersion(version, "minor") },
    ];
  }
  const comparator = parseComparator(token);
  return comparator ? [comparator] : undefined;
}

function parseVersionRange(range: string): readonly VersionComparator[] | undefined {
  const tokens = range.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || range.includes("||")) return undefined;
  const comparators: VersionComparator[] = [];
  for (const token of tokens) {
    const expanded = expandRangeToken(token);
    if (!expanded) return undefined;
    comparators.push(...expanded);
  }
  return comparators;
}

export function isValidVersionRange(range: string): boolean {
  return parseVersionRange(range) !== undefined;
}

export function satisfiesVersionRange(version: string, range: string): boolean {
  if (!parseSemanticVersion(version)) return false;
  const comparators = parseVersionRange(range);
  if (!comparators) return false;
  return comparators.every((comparator) => {
    const comparison = compareSemanticVersions(version, comparator.version);
    if (comparator.operator === ">") return comparison > 0;
    if (comparator.operator === ">=") return comparison >= 0;
    if (comparator.operator === "<") return comparison < 0;
    if (comparator.operator === "<=") return comparison <= 0;
    return comparison === 0;
  });
}
