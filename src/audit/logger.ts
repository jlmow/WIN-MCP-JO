import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface AuditEntry {
  timestamp: string;
  integrationId: string;
  integrationLabel: string;
  tool: string;
  params: unknown;
  success: boolean;
  error?: string;
  resultSummary?: unknown;
  durationMs: number;
}

export interface AuditSink {
  record(entry: AuditEntry): void;
}

/**
 * Regista cada entrada como uma linha JSON num ficheiro local
 * (append-only). Suficiente para desenvolvimento; em produção deve ser
 * trocado por um sink que escreva para um armazenamento auditável e
 * imutável (ex: base de dados própria do hub, ou um serviço de logging
 * centralizado da empresa).
 */
export class FileAuditSink implements AuditSink {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  record(entry: AuditEntry): void {
    appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}

/** Sink em memória, útil para testes. */
export class InMemoryAuditSink implements AuditSink {
  readonly entries: AuditEntry[] = [];

  record(entry: AuditEntry): void {
    this.entries.push(entry);
  }
}

interface AuditContext {
  integrationId: string;
  integrationLabel: string;
  tool: string;
  params: unknown;
}

/**
 * Executa `fn` e regista sempre um registo de auditoria — quem pediu,
 * o que foi pedido e o que foi devolvido — quer a chamada tenha sucesso
 * quer falhe (incluindo falhas de permissão).
 */
export async function withAudit<T>(
  sink: AuditSink,
  ctx: AuditContext,
  summarize: (result: T) => unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    sink.record({
      timestamp: new Date().toISOString(),
      integrationId: ctx.integrationId,
      integrationLabel: ctx.integrationLabel,
      tool: ctx.tool,
      params: ctx.params,
      success: true,
      resultSummary: summarize(result),
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    sink.record({
      timestamp: new Date().toISOString(),
      integrationId: ctx.integrationId,
      integrationLabel: ctx.integrationLabel,
      tool: ctx.tool,
      params: ctx.params,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}
