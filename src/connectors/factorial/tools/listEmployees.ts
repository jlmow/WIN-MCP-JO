import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runTool, type ToolDeps } from "../../../tools/helpers.js";
import type { FactorialConnector } from "../types.js";

export function registerListEmployees(server: McpServer, connector: FactorialConnector, deps: ToolDeps): void {
  server.registerTool(
    "factorial.list_employees",
    {
      title: "Listar colaboradores (Factorial)",
      description:
        "Lista colaboradores no Factorial, com filtro opcional por nome, departamento ou email, e opção de mostrar só ativos.",
      inputSchema: {
        search: z.string().optional().describe("Texto livre para filtrar por nome, departamento ou email"),
        onlyActive: z.boolean().optional().describe("Se verdadeiro, mostra só colaboradores ativos"),
        limit: z.number().int().positive().max(200).optional().describe("Número máximo de resultados (default 50)"),
      },
    },
    async (args) =>
      runTool(
        deps,
        "factorial.list_employees",
        "factorial:employees:read",
        args,
        (employees) => ({ count: employees.length }),
        () => connector.listEmployees(args),
      ),
  );
}
