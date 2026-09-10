#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { buildServer, resolveIdentity } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const identity = resolveIdentity(config);
  const server = buildServer(config, identity);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[winsig-mcp-server] Ligado como integração '${identity.integrationId}' (${identity.label}).`);
  console.error(`[winsig-mcp-server] Scopes: ${identity.scopes.join(", ") || "(nenhum)"}`);
}

main().catch((error) => {
  console.error("[winsig-mcp-server] Falha ao arrancar:", error instanceof Error ? error.message : error);
  process.exit(1);
});
