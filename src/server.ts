import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuditSink } from "./audit/logger.js";
import type { Identity } from "./auth/types.js";
import type { PhcConnector } from "./connectors/phc/types.js";
import { registerAllTools } from "./tools/index.js";

/**
 * Constrói o servidor MCP do hub Winsig para uma identidade já autenticada.
 *
 * `connector` e `auditSink` são partilhados entre todas as identidades/
 * sessões (uma única fonte de dados do PHC, um único registo de auditoria);
 * só `identity` — e, por consequência, os scopes que cada ferramenta
 * verifica — muda de uma chamada a `buildServer` para outra. No transporte
 * HTTP isto acontece uma vez por sessão; no stdio, uma vez por processo.
 *
 * A troca do `MockPhcConnector` por um conector real do PHC Web (quando a
 * API estiver disponível) é a única mudança necessária para ligar este hub
 * a dados reais — nenhuma outra camada precisa de ser alterada.
 */
export function buildServer(identity: Identity, connector: PhcConnector, auditSink: AuditSink): McpServer {
  const server = new McpServer({
    name: "winsig-mcp-server",
    version: "0.1.0",
    title: "Winsig MCP Server",
  });

  registerAllTools(server, connector, { identity, auditSink });

  return server;
}
