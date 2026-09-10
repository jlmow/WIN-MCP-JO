import type { Scope } from "../permissions/scopes.js";

/**
 * Uma integração de IA registada no hub (ex: "Claude Desktop - Financeiro",
 * "Agente de Compras GPT"). Cada integração tem a sua própria credencial,
 * revogável a qualquer momento, e um conjunto de scopes — atribuídos
 * diretamente e/ou herdados de um perfil (`role`, ver
 * src/permissions/roles.ts).
 */
export interface Integration {
  id: string;
  label: string;
  /** SHA-256 (hex) da API key. A key em texto plano nunca é guardada. */
  apiKeyHash: string;
  scopes: Scope[];
  /**
   * Dados adicionais usados por restrições ao nível da linha (ex:
   * `{ factorialEmployeeId: "E003" }` para um scope "...:read:self" que só
   * deve devolver o registo do próprio colaborador). Nunca concede acesso
   * por si só — só filtra o que um scope já autorizado pode ver.
   */
  attributes?: Record<string, string>;
  revoked: boolean;
  createdAt: string;
}

/**
 * Identidade resolvida para o pedido atual — quem está, de facto, a falar
 * com os sistemas ligados através do hub. É isto que a camada de
 * permissões e a auditoria usam, nunca a API key em si.
 */
export interface Identity {
  integrationId: string;
  label: string;
  scopes: Scope[];
  attributes?: Record<string, string>;
}
