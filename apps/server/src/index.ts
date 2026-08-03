import { buildApp } from "./app.js";
import { fileURLToPath } from "node:url";

const host = process.env.SOLIDLOOM_HOST ?? "127.0.0.1";
const parsedPort = Number.parseInt(process.env.SOLIDLOOM_PORT ?? "4310", 10);
const port = Number.isFinite(parsedPort) ? parsedPort : 4310;
const databasePath = process.env.SOLIDLOOM_DATABASE_PATH
  ?? fileURLToPath(new URL("../../../data/solidloom.db", import.meta.url));

const app = await buildApp({ logger: true, databasePath });

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
