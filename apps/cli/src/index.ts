import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { renderCliLlms, type FeatureGraph, type Unit } from "@solidloom/shared";

const DEFAULT_SERVER = "http://127.0.0.1:4310";

function readServerArg(argv: string[]): string {
  const index = argv.findIndex((argument) => argument === "--server");
  const fromArg = index >= 0 ? argv[index + 1] : undefined;
  return (fromArg ?? process.env.SOLIDLOOM_URL ?? DEFAULT_SERVER).replace(/\/+$/, "");
}

async function requestJson(server: string, path: string, options: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const request: RequestInit = {
    method: options.method ?? "GET",
    headers: {
      accept: "application/json",
      "user-agent": "solidloom-cli/0.1.0",
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    },
  };
  if (options.body !== undefined) request.body = JSON.stringify(options.body);
  const response = await fetch(`${server}${path}`, request);
  if (response.status === 204) return { deleted: true };
  const body = await response.json().catch(() => ({ error: "invalid_response", message: `The service returned ${response.status} without JSON.` }));
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const server = readServerArg(process.argv);

if (process.argv.includes("--llms")) {
  process.stdout.write(renderCliLlms(server));
} else {
  const program = new Command();
  program
    .name("solidloom")
    .description("Manage the local SolidLoom service. Use --help for humans and --llms for agents.")
    .version("0.1.0")
    .option("--server <url>", "local API base URL", process.env.SOLIDLOOM_URL ?? DEFAULT_SERVER)
    .option("--llms", "print concise connection and capability guidance for agents");

  program
    .command("health")
    .description("check whether the local service is running")
    .action(async () => printJson(await requestJson(server, "/api/health")));

  program
    .command("capabilities")
    .description("print available and planned HTTP capabilities")
    .action(async () => printJson(await requestJson(server, "/capabilities.json")));

  const models = program.command("models").description("work with local model records");
  models
    .command("list")
    .description("list locally persisted models")
    .action(async () => printJson(await requestJson(server, "/api/models")));

  models
    .command("create")
    .description("create a local model with a default box feature")
    .requiredOption("--name <name>", "model name")
    .option("--description <description>", "model description")
    .option("--unit <unit>", "model unit: mm, cm, or in", "mm")
    .action(async (options: { name: string; description?: string; unit: Unit }) => printJson(await requestJson(server, "/api/models", {
      method: "POST",
      body: { name: options.name, description: options.description, unit: options.unit },
    })));

  models
    .command("get <model-id>")
    .description("inspect one model and its complete feature graph")
    .action(async (modelId: string) => printJson(await requestJson(server, `/api/models/${encodeURIComponent(modelId)}`)));

  models
    .command("update <model-id>")
    .description("update model metadata using optimistic concurrency")
    .requiredOption("--revision <revision>", "current model revision", Number)
    .option("--name <name>", "new model name")
    .option("--description <description>", "new model description")
    .option("--unit <unit>", "new model unit: mm, cm, or in")
    .action(async (modelId: string, options: { revision: number; name?: string; description?: string; unit?: Unit }) => {
      if (options.name === undefined && options.description === undefined && options.unit === undefined) {
        throw new Error("Provide at least one of --name, --description, or --unit.");
      }
      const body = {
        expectedRevision: options.revision,
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.description === undefined ? {} : { description: options.description }),
        ...(options.unit === undefined ? {} : { unit: options.unit }),
      };
      printJson(await requestJson(server, `/api/models/${encodeURIComponent(modelId)}`, { method: "PATCH", body }));
    });

  models
    .command("replace-features <model-id>")
    .description("replace the complete feature graph from a JSON file")
    .requiredOption("--revision <revision>", "current model revision", Number)
    .requiredOption("--file <path>", "JSON file containing a feature graph")
    .action(async (modelId: string, options: { revision: number; file: string }) => {
      const featureGraph = JSON.parse(await readFile(options.file, "utf8")) as FeatureGraph;
      printJson(await requestJson(server, `/api/models/${encodeURIComponent(modelId)}/features`, {
        method: "PUT",
        body: { expectedRevision: options.revision, featureGraph },
      }));
    });

  models
    .command("delete <model-id>")
    .description("permanently delete a model after an exact-id confirmation")
    .requiredOption("--revision <revision>", "current model revision", Number)
    .requiredOption("--confirm <model-id>", "repeat the exact model id to confirm deletion")
    .action(async (modelId: string, options: { revision: number; confirm: string }) => {
      if (options.confirm !== modelId) throw new Error("--confirm must exactly match <model-id>.");
      printJson(await requestJson(server, `/api/models/${encodeURIComponent(modelId)}?expectedRevision=${options.revision}`, { method: "DELETE" }));
    });

  program.parseAsync(process.argv).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
