import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { RuntimeEvents } from "./events.js";
import { createMcpHandlers } from "./mcp.js";
import { resolveRuntimePaths } from "./paths.js";

function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const repoRoot = readArg("--repo", process.cwd());
const paths = await resolveRuntimePaths(repoRoot);
const events = new RuntimeEvents();
const handlers = createMcpHandlers(paths, events);

const server = new McpServer({
  name: "sandtable-mobile-review",
  version: "0.1.0"
});

server.registerTool(
  "sandtable_sync_phase",
  {
    title: "Sync Sandtable phase",
    description: "Publish the current Sandtable phase to the mobile review runtime.",
    inputSchema: {
      feature: z.string(),
      phase: z.string(),
      summary: z.string()
    }
  },
  async ({ feature, phase, summary }) => {
    const file = await handlers.syncPhase(feature, phase, summary);
    return {
      content: [{ type: "text", text: `synced phase to ${file}` }]
    };
  }
);

server.registerTool(
  "sandtable_publish_document",
  {
    title: "Publish Sandtable document",
    description: "Publish a document snapshot to the mobile review runtime.",
    inputSchema: {
      feature: z.string(),
      name: z.string(),
      content: z.string()
    }
  },
  async ({ feature, name, content }) => {
    const file = await handlers.publishDocument(feature, name, content);
    return {
      content: [{ type: "text", text: `published document to ${file}` }]
    };
  }
);

server.registerTool(
  "sandtable_read_mobile_messages",
  {
    title: "Read mobile messages",
    description: "Read pending mobile-origin messages for a feature.",
    inputSchema: {
      feature: z.string()
    }
  },
  async ({ feature }) => {
    const messages = await handlers.readMobileMessages(feature);
    return {
      content: [{ type: "text", text: JSON.stringify(messages.map((item) => item.message), null, 2) }]
    };
  }
);

server.registerTool(
  "sandtable_post_message",
  {
    title: "Post message to mobile",
    description:
      "Post a free-form agent reply into the session conversation so the developer sees it on the phone. Use kind 'chat' for normal replies, 'question' when asking the developer something, or 'status' for progress notices.",
    inputSchema: {
      feature: z.string(),
      text: z.string(),
      kind: z.enum(["chat", "question", "status"]).optional()
    }
  },
  async ({ feature, text, kind }) => {
    const message = await handlers.postMessage(feature, text, kind ?? "chat");
    return {
      content: [{ type: "text", text: `posted message ${message.id}` }]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
