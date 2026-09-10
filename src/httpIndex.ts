#!/usr/bin/env node
import { FileAuditSink } from "./audit/logger.js";
import { loadConfig } from "./config.js";
import { createHttpHub } from "./httpServer.js";
import { createConnectorModules } from "./modules.js";

const port = Number(process.env.WINSIG_MCP_HTTP_PORT ?? 3000);
const host = process.env.WINSIG_MCP_HTTP_HOST ?? "127.0.0.1";

const config = loadConfig();
const modules = createConnectorModules();
const auditSink = new FileAuditSink(config.auditLogFile);

const httpServer = createHttpHub({ integrationsFile: config.integrationsFile, modules, auditSink });

httpServer.listen(port, host, () => {
  console.error(`[winsig-mcp-server] Hub HTTP a correr em http://${host}:${port}/mcp`);
  console.error(`[winsig-mcp-server] Verificação de saúde em http://${host}:${port}/healthz`);
});
