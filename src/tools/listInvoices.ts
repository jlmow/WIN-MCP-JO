import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PhcConnector } from "../connectors/phc/types.js";
import { runTool, type ToolDeps } from "./helpers.js";

export function registerListInvoices(server: McpServer, connector: PhcConnector, deps: ToolDeps): void {
  server.registerTool(
    "list_invoices",
    {
      title: "Listar faturas",
      description: "Lista faturas do Cegid PHC CS, com filtro opcional por cliente.",
      inputSchema: {
        clientId: z.string().optional().describe("Código do cliente para filtrar as faturas"),
        limit: z.number().int().positive().max(200).optional().describe("Número máximo de resultados (default 50)"),
      },
    },
    async (args) =>
      runTool(
        deps,
        "list_invoices",
        "invoices:read",
        args,
        (invoices) => ({ count: invoices.length }),
        () => connector.listInvoices(args),
      ),
  );
}
