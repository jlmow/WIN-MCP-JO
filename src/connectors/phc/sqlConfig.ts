import type { config as MssqlConfig } from "mssql";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória em falta: ${name}. Ver README — secção "Ligar ao PHC real".`);
  }
  return value;
}

function parseBoolEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return raw === "true";
}

export interface PhcSqlServerSettings {
  mssqlConfig: MssqlConfig;
  /**
   * Interruptor de segurança para operações de escrita (ex: criar
   * encomenda). Desligado por default — escrever nas tabelas do PHC
   * diretamente contorna as regras de negócio que normalmente só a
   * aplicação do PHC garante (numeração de documentos, triggers,
   * atualização de stock). Só ativar depois de validar as queries contra
   * uma cópia/backup da base de dados.
   */
  allowWrites: boolean;
}

/**
 * Carrega a configuração de ligação ao SQL Server do PHC a partir de
 * variáveis de ambiente — nunca de código, nunca commitado. Ver
 * `.env.example` para a lista completa.
 *
 * Segurança por default: ligação cifrada (`encrypt: true`) e o
 * certificado do servidor só é aceite sem validação
 * (`trustServerCertificate`) se explicitamente pedido — o normal para um
 * SQL Server local de teste com certificado autoassinado, mas nunca
 * recomendado em produção.
 */
export function loadPhcSqlServerSettings(): PhcSqlServerSettings {
  const server = requireEnv("WINSIG_PHC_DB_HOST");
  const database = requireEnv("WINSIG_PHC_DB_NAME");
  const user = requireEnv("WINSIG_PHC_DB_USER");
  const password = requireEnv("WINSIG_PHC_DB_PASSWORD");
  const instanceName = process.env.WINSIG_PHC_DB_INSTANCE || undefined;
  const port = process.env.WINSIG_PHC_DB_PORT ? Number(process.env.WINSIG_PHC_DB_PORT) : undefined;
  const encrypt = parseBoolEnv("WINSIG_PHC_DB_ENCRYPT", true);
  const trustServerCertificate = parseBoolEnv("WINSIG_PHC_DB_TRUST_SERVER_CERT", false);
  const allowWrites = parseBoolEnv("WINSIG_PHC_ALLOW_WRITES", false);

  const mssqlConfig: MssqlConfig = {
    server,
    database,
    user,
    password,
    // Instância nomeada (ex: "localhost\\SQLEXPRESS") e porta explícita são
    // mutuamente exclusivas no driver — a instância resolve a porta sozinha.
    ...(instanceName ? {} : { port: port ?? 1433 }),
    options: {
      encrypt,
      trustServerCertificate,
      ...(instanceName ? { instanceName } : {}),
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 10000,
    requestTimeout: 15000,
  };

  return { mssqlConfig, allowWrites };
}
