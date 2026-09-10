import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config.js";
import { CredentialStore } from "./auth/credentialStore.js";
import type { Identity } from "./auth/types.js";
import { FileAuditSink } from "./audit/logger.js";
import { MockPhcConnector } from "./connectors/phc/mockConnector.js";
import { registerAllTools } from "./tools/index.js";

export function resolveIdentity(config: AppConfig): Identity {
  const store = CredentialStore.fromFile(config.integrationsFile);
  const identity = store.resolve(config.apiKey);
  if (!identity) {
    throw new Error(
      "API key inválida, desconhecida ou revogada. Verifica WINSIG_MCP_API_KEY e o ficheiro de integrações.",
    );
  }
  return identity;
}

/**
 * Constrói o servidor MCP do hub Winsig para uma identidade já autenticada.
 *
 * A troca do `MockPhcConnector` por um conector real do PHC Web (quando
 * a API estiver disponível) é a única mudança necessária para ligar este
 * hub a dados reais — nenhuma ferramenta, nem a auth/permissões/auditoria,
 * precisa de ser alterada.
 */
export function buildServer(config: AppConfig, identity: Identity): McpServer {
  const server = new McpServer({
    name: "winsig-mcp-server",
    version: "0.1.0",
    title: "Winsig MCP Server",
  });

  const connector = new MockPhcConnector();
  const auditSink = new FileAuditSink(config.auditLogFile);

  registerAllTools(server, connector, { identity, auditSink });

  return server;
}
