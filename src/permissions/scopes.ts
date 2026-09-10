/**
 * Âmbitos (scopes) que uma credencial de integração pode ter.
 *
 * Cada ferramenta MCP declara o(s) scope(s) de que precisa; uma integração
 * só consegue usar uma ferramenta se a credencial associada tiver esse
 * scope atribuído. Isto espelha, a um nível simples, a lógica de perfis e
 * permissões do PHC CS — o objetivo a prazo é mapear estes scopes
 * diretamente aos perfis de utilizador já definidos no PHC.
 */
export const SCOPES = [
  "clients:read",
  "stock:read",
  "invoices:read",
  "orders:write",
] as const;

export type Scope = (typeof SCOPES)[number];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}
