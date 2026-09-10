import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuditSink } from "./audit/logger.js";
import type { Identity } from "./auth/types.js";
import type { ConnectorModule } from "./connectors/registry.js";

/**
 * Constrói o servidor MCP do hub Winsig para uma identidade já autenticada.
 *
 * `modules` é a lista de sistemas ligados ao hub (PHC, Factorial, e no
 * futuro Sage, Primavera, SAP, Odoo, ...) — cada um regista as suas
 * próprias ferramentas, prefixadas com o seu id, sem que este ficheiro
 * saiba nada sobre nenhum deles em concreto. `modules` e `auditSink` são
 * partilhados entre todas as identidades/sessões (a mesma fonte de dados,
 * o mesmo registo de auditoria); só `identity` — e por consequência os
 * scopes que cada ferramenta verifica — muda de uma chamada a
 * `buildServer` para outra. No transporte HTTP isto acontece uma vez por
 * sessão; no stdio, uma vez por processo.
 */
export function buildServer(identity: Identity, modules: ConnectorModule[], auditSink: AuditSink): McpServer {
  const server = new McpServer({
    name: "winsig-mcp-server",
    version: "0.1.0",
    title: "Winsig MCP Server",
  });

  for (const module of modules) {
    module.registerTools(server, { identity, auditSink });
  }

  return server;
}
