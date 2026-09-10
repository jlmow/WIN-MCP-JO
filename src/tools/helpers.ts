import type { AuditSink } from "../audit/logger.js";
import { withAudit } from "../audit/logger.js";
import type { Identity } from "../auth/types.js";
import { requireScope } from "../permissions/check.js";
import type { Scope } from "../permissions/scopes.js";

export interface ToolDeps {
  identity: Identity;
  auditSink: AuditSink;
}

export function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

/**
 * Envolve a execução de uma ferramenta MCP com verificação de permissões e
 * auditoria: nenhuma ferramenta toca no `PhcConnector` sem primeiro passar
 * por `requireScope`, e todo o pedido — aceite, negado ou falhado — fica
 * registado no `AuditSink`.
 */
export async function runTool<T>(
  deps: ToolDeps,
  toolName: string,
  scope: Scope,
  params: unknown,
  summarize: (result: T) => unknown,
  fn: () => Promise<T>,
) {
  try {
    const result = await withAudit(
      deps.auditSink,
      {
        integrationId: deps.identity.integrationId,
        integrationLabel: deps.identity.label,
        tool: toolName,
        params,
      },
      summarize,
      async () => {
        requireScope(deps.identity, scope);
        return fn();
      },
    );
    return textResult(result);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}
