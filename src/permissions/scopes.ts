import { FACTORIAL_SCOPES } from "../connectors/factorial/scopes.js";
import { PHC_SCOPES } from "../connectors/phc/scopes.js";

/**
 * Âmbitos (scopes) que uma credencial de integração pode ter, agregados a
 * partir de todos os conectores registados no hub. Cada ferramenta MCP
 * declara o(s) scope(s) de que precisa (sempre prefixados com o id do
 * conector, ex: "phc:clients:read", "factorial:employees:read"); uma
 * integração só consegue usar uma ferramenta se a credencial associada
 * tiver esse scope atribuído.
 *
 * Ao adicionar um novo conector (Sage, Primavera, SAP, Odoo, ...), os seus
 * scopes juntam-se aqui — nenhuma outra parte da camada de permissões
 * precisa de mudar.
 */
export const SCOPES = [...PHC_SCOPES, ...FACTORIAL_SCOPES] as const;

export type Scope = (typeof SCOPES)[number];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}
