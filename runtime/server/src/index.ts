import { RuntimeEvents } from "./events.js";
import { createHttpServer } from "./http.js";
import { createMcpHandlers } from "./mcp.js";
import { resolveRuntimePaths } from "./paths.js";

function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const repoRoot = readArg("--repo", process.cwd());
const host = readArg("--host", "127.0.0.1");
const port = Number(readArg("--port", "8765"));
const publicUrl = readArg("--public-url", `http://${host}:${port}`);

const paths = await resolveRuntimePaths(repoRoot);
const events = new RuntimeEvents();
const mcp = createMcpHandlers(paths, events);
void mcp;

const app = await createHttpServer(paths, events, async () => {
  await app.close();
}, publicUrl);

await app.listen({ host, port });

console.log("Sandtable mobile review server");
console.log(`repo: ${paths.repoRoot}`);
console.log(`mailbox: ${paths.runtimeRoot}`);
console.log(`http: ${publicUrl}`);

process.on("SIGINT", () => {
  void app.close().finally(() => {
    console.log("Sandtable mobile review server stopped");
    process.exit(0);
  });
});
