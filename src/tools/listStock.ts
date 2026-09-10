import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PhcConnector } from "../connectors/phc/types.js";
import { runTool, type ToolDeps } from "./helpers.js";

export function registerListStock(server: McpServer, connector: PhcConnector, deps: ToolDeps): void {
  server.registerTool(
    "list_stock",
    {
      title: "Consultar stocks",
      description:
        "Lista artigos e respetivas quantidades disponíveis no Cegid PHC CS, com filtro opcional por descrição ou código.",
      inputSchema: {
        search: z.string().optional().describe("Texto livre para filtrar por descrição ou código do artigo"),
        limit: z.number().int().positive().max(200).optional().describe("Número máximo de resultados (default 50)"),
      },
    },
    async (args) =>
      runTool(
        deps,
        "list_stock",
        "stock:read",
        args,
        (items) => ({ count: items.length }),
        () => connector.listStock(args),
      ),
  );
}
