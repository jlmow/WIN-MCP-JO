import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runTool, type ToolDeps } from "../../../tools/helpers.js";
import type { PhcConnector } from "../types.js";

export function registerListInvoices(server: McpServer, connector: PhcConnector, deps: ToolDeps): void {
  server.registerTool(
    "phc.list_invoices",
    {
      title: "Listar faturas (PHC)",
      description: "Lista faturas do Cegid PHC CS, com filtro opcional por cliente.",
      inputSchema: {
        clientId: z.string().optional().describe("Código do cliente para filtrar as faturas"),
        limit: z.number().int().positive().max(200).optional().describe("Número máximo de resultados (default 50)"),
      },
    },
    async (args) =>
      runTool(
        deps,
        "phc.list_invoices",
        "phc:invoices:read",
        args,
        (invoices) => ({ count: invoices.length }),
        () => connector.listInvoices(args),
      ),
  );
}
