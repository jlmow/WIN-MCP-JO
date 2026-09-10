import type { AuditSink } from "../audit/logger.js";
import { withAudit } from "../audit/logger.js";
import type { Identity } from "../auth/types.js";
import { requireAnyScope } from "../permissions/check.js";
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
 * auditoria: nenhuma ferramenta toca num conector sem primeiro passar por
 * `requireAnyScope`, e todo o pedido — aceite, negado ou falhado — fica
 * registado no `AuditSink`.
 *
 * `scope` aceita um único scope, ou uma lista quando a ferramenta tem uma
 * versão "total" e uma restrita ao nível da linha (ex:
 * `["factorial:employees:read", "factorial:employees:read:self"]`) — o
 * pedido passa se a identidade tiver qualquer um deles; a própria função
 * `fn` deve depois consultar `deps.identity.scopes` para saber qual foi
 * concedido e filtrar o resultado em conformidade.
 */
export async function runTool<T>(
  deps: ToolDeps,
  toolName: string,
  scope: Scope | Scope[],
  params: unknown,
  summarize: (result: T) => unknown,
  fn: () => Promise<T>,
) {
  const scopes = Array.isArray(scope) ? scope : [scope];
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
        requireAnyScope(deps.identity, scopes);
        return fn();
      },
    );
    return textResult(result);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}
