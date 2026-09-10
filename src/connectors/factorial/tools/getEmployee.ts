import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runTool, type ToolDeps } from "../../../tools/helpers.js";
import type { FactorialConnector } from "../types.js";

export function registerGetEmployee(server: McpServer, connector: FactorialConnector, deps: ToolDeps): void {
  server.registerTool(
    "factorial.get_employee",
    {
      title: "Consultar colaborador (Factorial)",
      description: "Devolve a ficha de um colaborador no Factorial pelo seu código.",
      inputSchema: {
        id: z.string().min(1).describe("Código do colaborador no Factorial (ex: E001)"),
      },
    },
    async (args) =>
      runTool(
        deps,
        "factorial.get_employee",
        "factorial:employees:read",
        args,
        (employee) => (employee ? { found: true, id: employee.id } : { found: false }),
        async () => {
          const employee = await connector.getEmployee(args.id);
          if (!employee) throw new Error(`Colaborador '${args.id}' não encontrado.`);
          return employee;
        },
      ),
  );
}
