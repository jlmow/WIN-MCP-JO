import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { isScope, type Scope } from "../permissions/scopes.js";
import { resolveRoleScopes } from "../permissions/roles.js";
import type { Identity, Integration } from "./types.js";

export function hashApiKey(rawApiKey: string): string {
  return createHash("sha256").update(rawApiKey, "utf8").digest("hex");
}

interface RawIntegrationRecord {
  id: string;
  label: string;
  apiKeyHash: string;
  /** Perfil de utilizador (ver src/permissions/roles.ts) — os seus scopes juntam-se aos de `scopes`. */
  role?: string;
  /** Scopes atribuídos diretamente, além dos que vêm de `role`. Opcional se `role` já cobrir tudo o que a integração precisa. */
  scopes?: string[];
  /** Dados para restrições ao nível da linha (ex: `{ "factorialEmployeeId": "E003" }`). */
  attributes?: Record<string, string>;
  revoked?: boolean;
  createdAt?: string;
}

/**
 * Guarda e resolve as credenciais das integrações de IA.
 *
 * Em produção isto deve ser trocado por uma tabela numa base de dados
 * própria do hub (nunca a base de dados do PHC) com rotação e revogação
 * geridas por uma consola de administração. Para já, carrega de um
 * ficheiro JSON local — ver `config/integrations.example.json`.
 */
export class CredentialStore {
  private integrations: Integration[];

  constructor(integrations: Integration[]) {
    this.integrations = integrations;
  }

  static fromFile(filePath: string): CredentialStore {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as { integrations: RawIntegrationRecord[] };
    const integrations = raw.integrations.map((record) => {
      const explicitScopes = record.scopes ?? [];
      const unknown = explicitScopes.filter((s) => !isScope(s));
      if (unknown.length > 0) {
        throw new Error(`Integração '${record.id}' tem scopes desconhecidos: ${unknown.join(", ")}`);
      }

      let roleScopes: Scope[] = [];
      if (record.role) {
        try {
          roleScopes = resolveRoleScopes(record.role);
        } catch (error) {
          throw new Error(
            `Integração '${record.id}': ${error instanceof Error ? error.message : "perfil inválido."}`,
          );
        }
      }

      const scopes = [...new Set<Scope>([...roleScopes, ...(explicitScopes as Scope[])])];

      return {
        id: record.id,
        label: record.label,
        apiKeyHash: record.apiKeyHash,
        scopes,
        attributes: record.attributes,
        revoked: record.revoked ?? false,
        createdAt: record.createdAt ?? new Date(0).toISOString(),
      };
    });
    return new CredentialStore(integrations);
  }

  /** Resolve uma API key em texto plano para a identidade da integração, ou null se inválida/revogada. */
  resolve(rawApiKey: string): Identity | null {
    const candidateHash = hashApiKey(rawApiKey);
    const candidateBuf = Buffer.from(candidateHash, "hex");

    for (const integration of this.integrations) {
      const storedBuf = Buffer.from(integration.apiKeyHash, "hex");
      if (storedBuf.length !== candidateBuf.length) continue;
      if (!timingSafeEqual(storedBuf, candidateBuf)) continue;

      if (integration.revoked) return null;
      return {
        integrationId: integration.id,
        label: integration.label,
        scopes: integration.scopes,
        ...(integration.attributes ? { attributes: integration.attributes } : {}),
      };
    }
    return null;
  }
}

export class InvalidApiKeyError extends Error {
  constructor() {
    super("API key inválida, desconhecida ou revogada.");
    this.name = "InvalidApiKeyError";
  }
}

export function resolveIdentityOrThrow(store: CredentialStore, rawApiKey: string): Identity {
  const identity = store.resolve(rawApiKey);
  if (!identity) throw new InvalidApiKeyError();
  return identity;
}
