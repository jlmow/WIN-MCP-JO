import type { Identity } from "../auth/types.js";
import type { Scope } from "./scopes.js";

export class PermissionDeniedError extends Error {
  constructor(
    public readonly integrationId: string,
    public readonly requiredScopes: Scope[],
  ) {
    super(
      requiredScopes.length === 1
        ? `A integração '${integrationId}' não tem permissão '${requiredScopes[0]}'.`
        : `A integração '${integrationId}' não tem nenhum dos scopes necessários: ${requiredScopes.join(", ")}.`,
    );
    this.name = "PermissionDeniedError";
  }
}

/**
 * Confirma que a identidade autenticada tem o scope necessário para
 * executar uma ferramenta. A IA nunca vê mais do que aquilo que a
 * credencial da integração autoriza explicitamente.
 */
export function requireScope(identity: Identity, requiredScope: Scope): void {
  requireAnyScope(identity, [requiredScope]);
}

/**
 * Como `requireScope`, mas aceita satisfazer qualquer um de vários
 * scopes — útil quando uma ferramenta tem uma versão "total" e uma
 * versão restrita ao nível da linha (ex: `factorial:employees:read` vs
 * `factorial:employees:read:self`), e a própria ferramenta decide depois
 * qual dos dois foi concedido para filtrar o resultado.
 */
export function requireAnyScope(identity: Identity, requiredScopes: Scope[]): void {
  if (!requiredScopes.some((scope) => identity.scopes.includes(scope))) {
    throw new PermissionDeniedError(identity.integrationId, requiredScopes);
  }
}
