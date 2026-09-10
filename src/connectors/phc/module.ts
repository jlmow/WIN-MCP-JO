import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConnectorModule } from "../registry.js";
import type { ToolDeps } from "../../tools/helpers.js";
import { registerCreateOrder } from "./tools/createOrder.js";
import { registerGetClient } from "./tools/getClient.js";
import { registerListClients } from "./tools/listClients.js";
import { registerListInvoices } from "./tools/listInvoices.js";
import { registerListStock } from "./tools/listStock.js";
import type { PhcConnector } from "./types.js";

/** Módulo do conector Cegid PHC CS — o primeiro sistema ligado ao hub, e o modelo a seguir para os próximos (Sage, Primavera, SAP, Odoo, ...). */
export function createPhcModule(connector: PhcConnector): ConnectorModule {
  return {
    id: "phc",
    label: "Cegid PHC CS",
    registerTools(server: McpServer, deps: ToolDeps): void {
      registerListClients(server, connector, deps);
      registerGetClient(server, connector, deps);
      registerListStock(server, connector, deps);
      registerListInvoices(server, connector, deps);
      registerCreateOrder(server, connector, deps);
    },
  };
}
