import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runTool, type ToolDeps } from "../../../tools/helpers.js";
import { hasFullEmployeeAccess, ownEmployeeId } from "../rowLevel.js";
import type { FactorialConnector } from "../types.js";

export function registerGetEmployee(server: McpServer, connector: FactorialConnector, deps: ToolDeps): void {
  server.registerTool(
    "factorial.get_employee",
    {
      title: "Consultar colaborador (Factorial)",
      description:
        "Devolve a ficha de um colaborador no Factorial pelo seu código. " +
        "Uma integração com o scope restrito 'factorial:employees:read:self' só pode consultar o seu próprio código, nunca o de um colega.",
      inputSchema: {
        id: z.string().min(1).describe("Código do colaborador no Factorial (ex: E001)"),
      },
    },
    async (args) =>
      runTool(
        deps,
        "factorial.get_employee",
        ["factorial:employees:read", "factorial:employees:read:self"],
        args,
        (employee) => (employee ? { found: true, id: employee.id } : { found: false }),
        async () => {
          if (!hasFullEmployeeAccess(deps.identity)) {
            const ownId = ownEmployeeId(deps.identity);
            if (!ownId || args.id !== ownId) {
              throw new Error("Com este scope só podes consultar o teu próprio registo de colaborador.");
            }
          }
          const employee = await connector.getEmployee(args.id);
          if (!employee) throw new Error(`Colaborador '${args.id}' não encontrado.`);
          return employee;
        },
      ),
  );
}
