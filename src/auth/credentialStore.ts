import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { isScope, type Scope } from "../permissions/scopes.js";
import type { Identity, Integration } from "./types.js";

export function hashApiKey(rawApiKey: string): string {
  return createHash("sha256").update(rawApiKey, "utf8").digest("hex");
}

interface RawIntegrationRecord {
  id: string;
  label: string;
  apiKeyHash: string;
  scopes: string[];
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
      const scopes = record.scopes.filter(isScope) as Scope[];
      const unknown = record.scopes.filter((s) => !isScope(s));
      if (unknown.length > 0) {
        throw new Error(`Integração '${record.id}' tem scopes desconhecidos: ${unknown.join(", ")}`);
      }
      return {
        id: record.id,
        label: record.label,
        apiKeyHash: record.apiKeyHash,
        scopes,
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
      return { integrationId: integration.id, label: integration.label, scopes: integration.scopes };
    }
    return null;
  }
}
