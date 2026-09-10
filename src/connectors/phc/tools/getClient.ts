import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runTool, type ToolDeps } from "../../../tools/helpers.js";
import type { PhcConnector } from "../types.js";

export function registerGetClient(server: McpServer, connector: PhcConnector, deps: ToolDeps): void {
  server.registerTool(
    "phc.get_client",
    {
      title: "Consultar cliente (PHC)",
      description: "Devolve a ficha de um cliente do Cegid PHC CS pelo seu código.",
      inputSchema: {
        id: z.string().min(1).describe("Código do cliente no PHC (ex: C0001)"),
      },
    },
    async (args) =>
      runTool(
        deps,
        "phc.get_client",
        "phc:clients:read",
        args,
        (client) => (client ? { found: true, id: client.id } : { found: false }),
        async () => {
          const client = await connector.getClient(args.id);
          if (!client) throw new Error(`Cliente '${args.id}' não encontrado.`);
          return client;
        },
      ),
  );
}
