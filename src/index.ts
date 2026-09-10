#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CredentialStore, resolveIdentityOrThrow } from "./auth/credentialStore.js";
import { FileAuditSink } from "./audit/logger.js";
import { loadConfig, requireApiKeyFromEnv } from "./config.js";
import { MockPhcConnector } from "./connectors/phc/mockConnector.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const apiKey = requireApiKeyFromEnv();

  const store = CredentialStore.fromFile(config.integrationsFile);
  const identity = resolveIdentityOrThrow(store, apiKey);

  const connector = new MockPhcConnector();
  const auditSink = new FileAuditSink(config.auditLogFile);
  const server = buildServer(identity, connector, auditSink);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[winsig-mcp-server] Ligado (stdio) como integração '${identity.integrationId}' (${identity.label}).`);
  console.error(`[winsig-mcp-server] Scopes: ${identity.scopes.join(", ") || "(nenhum)"}`);
}

main().catch((error) => {
  console.error("[winsig-mcp-server] Falha ao arrancar:", error instanceof Error ? error.message : error);
  process.exit(1);
});
