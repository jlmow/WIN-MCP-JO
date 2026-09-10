import { resolve } from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória em falta: ${name}. Consulta o README para configurar a integração.`,
    );
  }
  return value;
}

export interface AppConfig {
  /** Caminho para o ficheiro com as credenciais das integrações registadas. */
  integrationsFile: string;
  /** Caminho para o ficheiro de log de auditoria (append-only). */
  auditLogFile: string;
}

/** Configuração partilhada por ambos os transportes (stdio e HTTP). */
export function loadConfig(): AppConfig {
  return {
    integrationsFile: resolve(process.env.WINSIG_MCP_INTEGRATIONS_FILE ?? "config/integrations.json"),
    auditLogFile: resolve(process.env.WINSIG_MCP_AUDIT_LOG_FILE ?? "logs/audit.log"),
  };
}

/**
 * No transporte stdio existe uma única identidade por processo, fixada no
 * arranque via variável de ambiente (é assim que clientes como o Claude
 * Desktop lançam servidores MCP locais, um processo por integração).
 */
export function requireApiKeyFromEnv(): string {
  return requireEnv("WINSIG_MCP_API_KEY");
}
