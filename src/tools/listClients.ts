import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PhcConnector } from "../connectors/phc/types.js";
import { runTool, type ToolDeps } from "./helpers.js";

export function registerListClients(server: McpServer, connector: PhcConnector, deps: ToolDeps): void {
  server.registerTool(
    "list_clients",
    {
      title: "Listar clientes",
      description:
        "Lista clientes do Cegid PHC CS, com filtro opcional por nome, NIF ou código. Não devolve dados fora dos clientes autorizados para esta integração.",
      inputSchema: {
        search: z.string().optional().describe("Texto livre para filtrar por nome, NIF ou código do cliente"),
        limit: z.number().int().positive().max(200).optional().describe("Número máximo de resultados (default 50)"),
      },
    },
    async (args) =>
      runTool(
        deps,
        "list_clients",
        "clients:read",
        args,
        (clients) => ({ count: clients.length }),
        () => connector.listClients(args),
      ),
  );
}
