import type { Identity } from "../auth/types.js";
import type { Scope } from "./scopes.js";

export class PermissionDeniedError extends Error {
  constructor(
    public readonly integrationId: string,
    public readonly requiredScope: Scope,
  ) {
    super(`A integração '${integrationId}' não tem permissão '${requiredScope}'.`);
    this.name = "PermissionDeniedError";
  }
}

/**
 * Confirma que a identidade autenticada tem o scope necessário para
 * executar uma ferramenta. A IA nunca vê mais do que aquilo que a
 * credencial da integração autoriza explicitamente.
 */
export function requireScope(identity: Identity, requiredScope: Scope): void {
  if (!identity.scopes.includes(requiredScope)) {
    throw new PermissionDeniedError(identity.integrationId, requiredScope);
  }
}
