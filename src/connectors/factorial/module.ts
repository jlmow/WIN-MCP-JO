import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConnectorModule } from "../registry.js";
import type { ToolDeps } from "../../tools/helpers.js";
import { registerGetEmployee } from "./tools/getEmployee.js";
import { registerListEmployees } from "./tools/listEmployees.js";
import type { FactorialConnector } from "./types.js";

/** Módulo do conector Factorial (RH) — segundo sistema ligado ao hub, prova de que o padrão de conector não é específico do PHC. */
export function createFactorialModule(connector: FactorialConnector): ConnectorModule {
  return {
    id: "factorial",
    label: "Factorial (RH)",
    registerTools(server: McpServer, deps: ToolDeps): void {
      registerListEmployees(server, connector, deps);
      registerGetEmployee(server, connector, deps);
    },
  };
}
