import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PhcConnector } from "../connectors/phc/types.js";
import { runTool, type ToolDeps } from "./helpers.js";

const orderLineSchema = z.object({
  itemCode: z.string().min(1).describe("Código do artigo no PHC"),
  quantity: z.number().positive().describe("Quantidade a encomendar"),
});

export function registerCreateOrder(server: McpServer, connector: PhcConnector, deps: ToolDeps): void {
  server.registerTool(
    "create_order",
    {
      title: "Criar encomenda",
      description:
        "Cria uma encomenda de cliente no Cegid PHC CS. Operação de escrita — requer scope 'orders:write'. " +
        "Valida o cliente e cada artigo antes de criar o documento; não confirma nem fatura automaticamente.",
      inputSchema: {
        clientId: z.string().min(1).describe("Código do cliente no PHC"),
        lines: z.array(orderLineSchema).min(1).describe("Linhas da encomenda"),
        notes: z.string().optional().describe("Observações a incluir na encomenda"),
      },
    },
    async (args) =>
      runTool(
        deps,
        "create_order",
        "orders:write",
        args,
        (order) => ({ orderId: order.id, lineCount: order.lines.length }),
        () => connector.createOrder(args),
      ),
  );
}
