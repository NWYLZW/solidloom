export type AppRoute =
  | { kind: "editor" }
  | { kind: "play"; runId: string };

const PLAY_SUBPAGE_PATTERN = /^(?:menu|character|settings(?:\/(?:appearance|audio|camera|general))?)?$/;

function decodePathSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded.trim() ? decoded : null;
  } catch {
    return null;
  }
}

export function matchAppRoute(pathname: string): AppRoute {
  const match = pathname.match(/^\/play\/([^/]+)(?:\/(.*?))?\/?$/);
  if (!match?.[1]) return { kind: "editor" };
  const subpage = match[2] ?? "";
  const runId = decodePathSegment(match[1]);
  if (!runId || !PLAY_SUBPAGE_PATTERN.test(subpage)) return { kind: "editor" };
  return { kind: "play", runId };
}
