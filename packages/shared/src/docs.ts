import { capabilityRegistry } from "./capabilities.js";
import type { CapabilityDefinition, CapabilityManifest } from "./types.js";

const SERVICE_NAME = "SolidLoom";
const SERVICE_VERSION = "0.1.0";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function segmentMatches(routeSegment: string, actualSegment: string): boolean {
  return routeSegment.startsWith(":") || routeSegment === actualSegment;
}

function isRelevantToPath(capability: CapabilityDefinition, path: string): boolean {
  const route = pathSegments(capability.path);
  const requested = pathSegments(path);
  const sharedLength = Math.min(route.length, requested.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const routeSegment = route[index];
    const requestedSegment = requested[index];
    if (!routeSegment || !requestedSegment || !segmentMatches(routeSegment, requestedSegment)) return false;
  }

  return true;
}

export function capabilitiesForPath(path: string): CapabilityDefinition[] {
  const normalizedPath = path === "" ? "/" : path.replace(/\/$/, "");
  return capabilityRegistry.filter((capability) => isRelevantToPath(capability, normalizedPath));
}

function skillNameForPath(path: string): string {
  const suffix = pathSegments(path)
    .filter((segment) => !segment.startsWith(":"))
    .join("-")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
  return suffix ? `solidloom-${suffix}` : "use-solidloom";
}

function displayRoute(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

export function createCapabilityManifest(baseUrl: string): CapabilityManifest {
  const base = normalizeBaseUrl(baseUrl);
  return {
    service: {
      name: SERVICE_NAME,
      version: SERVICE_VERSION,
      description: "Local-first programmable 3D modeling workspace for humans and agents.",
      transport: "http",
    },
    discovery: {
      llms: `${base}/llms.txt`,
      capabilities: `${base}/capabilities.json`,
      skillPattern: `${base}/{api-path}/skill.md`,
    },
    capabilities: [...capabilityRegistry],
  };
}

export function renderLlmsTxt(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `# ${SERVICE_NAME}\n\n> Local-first programmable 3D modeling workspace for humans and agents.\n\nModel records and versioned feature graphs are persisted locally. Real B-Rep evaluation, printable export, slicing, and printer control are not available unless the capability registry explicitly says otherwise.\n\n## Start here\n\n- Check service health: ${base}/api/health\n- Read the machine-readable capability registry: ${base}/capabilities.json\n- Read API documentation: ${base}/docs\n- Read a scoped skill by appending /skill.md to an API path. Example: ${base}/api/models/skill.md\n\n## Agent workflow\n\n1. Check health.\n2. Read only the parent skill needed for the task.\n3. Call only capabilities whose status is available.\n4. Read a model before updating it and send its revision as \`expectedRevision\`.\n5. Never infer that a planned capability exists.\n6. Obtain explicit confirmation immediately before destructive operations.\n\n## CLI bootstrap\n\nRun \`solidloom --llms\` for connection and command guidance. Set \`SOLIDLOOM_URL\` when the service is not at ${base}.\n`;
}

export function renderSkillMarkdown(path: string, baseUrl: string): string | null {
  const capabilities = capabilitiesForPath(path);
  if (capabilities.length === 0) return null;

  const base = normalizeBaseUrl(baseUrl);
  const title = path === "/" ? "SolidLoom service" : `SolidLoom ${path}`;
  const blocks = capabilities
    .map((capability) => {
      if (capability.status === "planned") {
        return `## ${capability.id}\n\n\`${capability.method} ${displayRoute(capability.path)}\` — ${capability.summary}\n\n- Status: planned. Do not call this capability yet.\n- Intended use: ${capability.agent.useWhen}`;
      }
      const safetyLine = capability.safety === "destructive"
        ? "- Safety: destructive; obtain explicit confirmation immediately before calling."
        : `- Safety: ${capability.safety}.`;
      const instructions = capability.agent.instructions.map((instruction) => `  - ${instruction}`).join("\n");
      const example = capability.agent.example ? `\n\nExample:\n\n\`\`\`bash\n${capability.agent.example}\n\`\`\`` : "";
      return `## ${capability.id}\n\n\`${capability.method} ${displayRoute(capability.path)}\` — ${capability.summary}\n\n- Status: available.\n\n${capability.description}\n\n- Use when: ${capability.agent.useWhen}\n${safetyLine}\n- Instructions:\n${instructions}${example}`;
    })
    .join("\n\n");

  return `---\nname: ${skillNameForPath(path)}\ndescription: Use the SolidLoom local HTTP service for capabilities scoped to ${path}. Trigger when an agent needs to inspect or modify local 3D model records through this API path.\n---\n\n# ${title}\n\nConnect to ${base}. Check \`${base}/api/health\` before work. Read \`${base}/capabilities.json\` only when structured schemas are required.\n\n${blocks}\n`;
}

export function renderCliLlms(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `# SolidLoom CLI for agents\n\nService: ${base}\n\nDiscovery:\n- GET ${base}/llms.txt\n- GET ${base}/capabilities.json\n- GET ${base}/api/models/skill.md\n\nAvailable commands:\n- solidloom health\n- solidloom capabilities\n- solidloom models list\n- solidloom models create --name <name>\n- solidloom models get <model-id>\n- solidloom models update <model-id> --revision <revision> [fields]\n- solidloom models replace-features <model-id> --revision <revision> --file <graph.json>\n- solidloom models delete <model-id> --revision <revision> --confirm <model-id>\n\nConnection:\n- Override with --server <url> or SOLIDLOOM_URL.\n- Responses are JSON except --help and --llms.\n- Read before writes and use the current revision for optimistic concurrency.\n- Call only capabilities whose status is available.\n- Real CAD evaluation, printable export, slicing, and printer control remain unavailable.\n`;
}
