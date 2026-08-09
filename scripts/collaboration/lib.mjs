export const STATUS_LABEL_PREFIX = "status:";

export function parseMarkdownSection(body, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPattern = new RegExp(`^##\\s+${escapedHeading}\\s*$`, "im");
  const match = headingPattern.exec(body ?? "");
  if (!match) return "";

  const start = match.index + match[0].length;
  const rest = body.slice(start);
  const nextHeading = /^##\s+/m.exec(rest);
  return rest.slice(0, nextHeading?.index ?? rest.length).trim();
}

export function parseDependencies(body) {
  const section = parseMarkdownSection(body, "前置依赖");
  return [...new Set([...section.matchAll(/#(\d+)/g)].map((match) => Number(match[1])))];
}

export function parseOwnedPaths(body) {
  const section = parseMarkdownSection(body, "Owned paths");
  return section
    .split("\n")
    .map((line) => line.match(/^\s*-\s+(.+?)\s*$/)?.[1])
    .filter(Boolean)
    .map((path) => path.replace(/^`|`$/g, ""));
}

export function slugifyTitle(title) {
  const slug = (title ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "task";
}

export function statusLabel(labels) {
  return labels.find((label) => label.startsWith(STATUS_LABEL_PREFIX)) ?? "status:unset";
}

export function dependenciesSatisfied(dependencies, issueStateByNumber) {
  return dependencies.every((number) => issueStateByNumber.get(number) === "CLOSED");
}

export function isClaimable(issue, issueStateByNumber) {
  return issue.state === "OPEN"
    && issue.labels.includes("kind:task")
    && issue.labels.includes("status:ready")
    && issue.assignees.length === 0
    && parseOwnedPaths(issue.body).length > 0
    && dependenciesSatisfied(parseDependencies(issue.body), issueStateByNumber);
}

export function needsVisualEvidence(labels, configuredLabels) {
  return configuredLabels.some((label) => labels.includes(label));
}

export function normalizeIssueNode(node) {
  return {
    number: node.number,
    title: node.title,
    state: node.state,
    body: node.body ?? "",
    url: node.url,
    labels: (node.labels?.nodes ?? node.labels ?? []).map((label) => typeof label === "string" ? label : label.name),
    assignees: (node.assignees?.nodes ?? node.assignees ?? []).map((assignee) => typeof assignee === "string" ? assignee : assignee.login),
  };
}

export function parseCliArgs(argv) {
  const positionals = [];
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const [rawName, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (inlineValue !== undefined) {
      options[rawName] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options[rawName] = next;
      index += 1;
    } else {
      options[rawName] = true;
    }
  }

  return { positionals, options };
}
