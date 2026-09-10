import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PhcConnector } from "../connectors/phc/types.js";
import { registerCreateOrder } from "./createOrder.js";
import { registerGetClient } from "./getClient.js";
import type { ToolDeps } from "./helpers.js";
import { registerListClients } from "./listClients.js";
import { registerListInvoices } from "./listInvoices.js";
import { registerListStock } from "./listStock.js";

/**
 * Regista todas as ferramentas MCP do hub. Cada ferramenta continua a
 * verificar o scope da integração e a auditar o pedido no momento em que
 * é chamada — registá-la aqui só a torna visível ao cliente MCP,
 * não concede acesso a nada por si só.
 */
export function registerAllTools(server: McpServer, connector: PhcConnector, deps: ToolDeps): void {
  registerListClients(server, connector, deps);
  registerGetClient(server, connector, deps);
  registerListStock(server, connector, deps);
  registerListInvoices(server, connector, deps);
  registerCreateOrder(server, connector, deps);
}
