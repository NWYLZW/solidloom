import { Command } from "commander";
import { renderCliLlms } from "@solidloom/shared";

const DEFAULT_SERVER = "http://127.0.0.1:4310";

function readServerArg(argv: string[]): string {
  const index = argv.findIndex((argument) => argument === "--server");
  const fromArg = index >= 0 ? argv[index + 1] : undefined;
  return (fromArg ?? process.env.SOLIDLOOM_URL ?? DEFAULT_SERVER).replace(/\/+$/, "");
}

async function requestJson(server: string, path: string): Promise<unknown> {
  const response = await fetch(`${server}${path}`, {
    headers: { accept: "application/json", "user-agent": "solidloom-cli/0.1.0" },
  });
  const body = await response.json().catch(() => ({
    error: "invalid_response",
    message: `The service returned ${response.status} without JSON.`,
  }));
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
    .description("list models; persistence is not enabled in the scaffold")
    .action(async () => printJson(await requestJson(server, "/api/models")));

  program.parseAsync(process.argv).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
