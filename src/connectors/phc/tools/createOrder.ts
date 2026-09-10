import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runTool, type ToolDeps } from "../../../tools/helpers.js";
import type { PhcConnector } from "../types.js";

const orderLineSchema = z.object({
  itemCode: z.string().min(1).describe("Código do artigo no PHC"),
  quantity: z.number().positive().describe("Quantidade a encomendar"),
});

export function registerCreateOrder(server: McpServer, connector: PhcConnector, deps: ToolDeps): void {
  server.registerTool(
    "phc.create_order",
    {
      title: "Criar encomenda (PHC)",
      description:
        "Cria uma encomenda de cliente no Cegid PHC CS. Operação de escrita — requer scope 'phc:orders:write'. " +
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
        "phc.create_order",
        "phc:orders:write",
        args,
        (order) => ({ orderId: order.id, lineCount: order.lines.length }),
        () => connector.createOrder(args),
      ),
  );
}
