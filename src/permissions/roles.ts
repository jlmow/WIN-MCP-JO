import type { Scope } from "./scopes.js";

export interface RoleDefinition {
  id: string;
  label: string;
  scopes: Scope[];
}

/**
 * Perfis de utilizador — pacotes nomeados de scopes, para não ser preciso
 * listar scopes um a um em cada integração. Espelha a ideia de perfis já
 * existente no PHC CS; o objetivo a prazo é que estes perfis possam ser
 * herdados diretamente de lá em vez de mantidos aqui à mão.
 *
 * Dois exemplos deliberadamente distintos:
 * - "consultor" mostra um perfil sem acesso a vendas (sem
 *   phc:invoices:read / phc:orders:write).
 * - "colaborador" mostra restrição ao nível da linha: só vê o seu
 *   próprio registo de RH (factorial:employees:read:self), nunca o dos
 *   colegas — ver src/connectors/factorial/tools/.
 */
export const ROLES: RoleDefinition[] = [
  {
    id: "consultor",
    label: "Consultor",
    scopes: ["phc:clients:read", "phc:stock:read"],
  },
  {
    id: "vendas",
    label: "Equipa de Vendas",
    scopes: ["phc:clients:read", "phc:stock:read", "phc:invoices:read", "phc:orders:write"],
  },
  {
    id: "rh-admin",
    label: "Administrador de RH",
    scopes: ["factorial:employees:read"],
  },
  {
    id: "colaborador",
    label: "Colaborador",
    scopes: ["factorial:employees:read:self"],
  },
];

export function findRole(roleId: string): RoleDefinition | undefined {
  return ROLES.find((r) => r.id === roleId);
}

export function resolveRoleScopes(roleId: string): Scope[] {
  const role = findRole(roleId);
  if (!role) {
    throw new Error(`Perfil desconhecido: '${roleId}'. Perfis disponíveis: ${ROLES.map((r) => r.id).join(", ")}.`);
  }
  return role.scopes;
}
