import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "../tools/helpers.js";

export type { ToolDeps };

/**
 * Um sistema ligado ao hub (Cegid PHC, Factorial, e no futuro Sage,
 * Primavera, SAP, Odoo, ...). Cada conector regista o seu próprio conjunto
 * de ferramentas MCP, prefixadas com o seu `id`, para nunca colidir com as
 * de outro conector no mesmo servidor.
 *
 * Isto é o que torna o hub multi-sistema em vez de um MCP por fornecedor:
 * `buildServer` não sabe nada sobre PHC ou Factorial especificamente — só
 * sabe iterar uma lista de `ConnectorModule`. Adicionar um novo sistema é
 * escrever um novo módulo que implementa esta interface, nunca alterar o
 * hub em si.
 */
export interface ConnectorModule {
  /** Identificador curto e estável do sistema — prefixo das ferramentas ("phc.list_clients") e dos scopes ("phc:clients:read"). */
  id: string;
  /** Nome amigável, para UI/documentação. */
  label: string;
  registerTools(server: McpServer, deps: ToolDeps): void;
}
