import type { Scope } from "../permissions/scopes.js";

/**
 * Uma integração de IA registada no hub (ex: "Claude Desktop - Financeiro",
 * "Agente de Compras GPT"). Cada integração tem a sua própria credencial,
 * revogável a qualquer momento, e um conjunto explícito de scopes.
 */
export interface Integration {
  id: string;
  label: string;
  /** SHA-256 (hex) da API key. A key em texto plano nunca é guardada. */
  apiKeyHash: string;
  scopes: Scope[];
  revoked: boolean;
  createdAt: string;
}

/**
 * Identidade resolvida para o pedido atual — quem está, de facto, a falar
 * com o PHC através do hub. É isto que a camada de permissões e a
 * auditoria usam, nunca a API key em si.
 */
export interface Identity {
  integrationId: string;
  label: string;
  scopes: Scope[];
}
