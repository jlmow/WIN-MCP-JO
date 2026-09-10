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
  /** API key em texto plano desta ligação — identifica a integração de IA que está a correr este processo. */
  apiKey: string;
  /** Caminho para o ficheiro com as credenciais das integrações registadas. */
  integrationsFile: string;
  /** Caminho para o ficheiro de log de auditoria (append-only). */
  auditLogFile: string;
}

export function loadConfig(): AppConfig {
  return {
    apiKey: requireEnv("WINSIG_MCP_API_KEY"),
    integrationsFile: resolve(process.env.WINSIG_MCP_INTEGRATIONS_FILE ?? "config/integrations.json"),
    auditLogFile: resolve(process.env.WINSIG_MCP_AUDIT_LOG_FILE ?? "logs/audit.log"),
  };
}
