import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { AuditSink } from "./audit/logger.js";
import { CredentialStore, resolveIdentityOrThrow } from "./auth/credentialStore.js";
import type { PhcConnector } from "./connectors/phc/types.js";
import { buildServer } from "./server.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, rejectPromise) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        rejectPromise(new Error("Corpo do pedido excede o limite permitido."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolvePromise(undefined);
        return;
      }
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        rejectPromise(new Error("JSON inválido no corpo do pedido."));
      }
    });
    req.on("error", rejectPromise);
  });
}

function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1]!.trim() : null;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export interface HttpHubDeps {
  /** Ficheiro de integrações — relido a cada novo `initialize` para que uma revogação tenha efeito imediato em novas ligações. */
  integrationsFile: string;
  connector: PhcConnector;
  auditSink: AuditSink;
}

/**
 * Hub MCP multi-tenant sobre Streamable HTTP.
 *
 * Cada sessão MCP (uma ligação `initialize` de um cliente) autentica-se
 * com o seu próprio `Authorization: Bearer <api-key>` e fica com a sua
 * própria instância de `McpServer`, ligada à identidade resolvida dessa
 * key — múltiplas integrações de IA podem estar ligadas ao mesmo hub em
 * simultâneo, cada uma só a ver o que os seus scopes autorizam. Todas as
 * sessões partilham o mesmo `connector` (a mesma fonte de dados do PHC) e
 * o mesmo `auditSink`.
 */
export function createHttpHub(deps: HttpHubDeps): Server {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const sessionId = firstHeaderValue(req.headers["mcp-session-id"]);

    if (sessionId) {
      const transport = sessions.get(sessionId);
      if (!transport) {
        sendJson(res, 404, { error: "Sessão MCP desconhecida ou expirada." });
        return;
      }
      const body = req.method === "POST" ? await readJsonBody(req) : undefined;
      await transport.handleRequest(req, res, body);
      return;
    }

    if (req.method !== "POST") {
      sendJson(res, 400, { error: "Pedido sem sessão MCP válida (cabeçalho 'mcp-session-id' em falta)." });
      return;
    }

    const body = await readJsonBody(req);
    if (!isInitializeRequest(body)) {
      sendJson(res, 400, { error: "O primeiro pedido de uma nova sessão tem de ser 'initialize'." });
      return;
    }

    const apiKey = extractBearerToken(req);
    if (!apiKey) {
      sendJson(res, 401, { error: "Cabeçalho 'Authorization: Bearer <api-key>' em falta." });
      return;
    }

    let identity;
    try {
      const store = CredentialStore.fromFile(deps.integrationsFile);
      identity = resolveIdentityOrThrow(store, apiKey);
    } catch (error) {
      sendJson(res, 401, { error: error instanceof Error ? error.message : "Autenticação inválida." });
      return;
    }

    const server = buildServer(identity, deps.connector, deps.auditSink);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        sessions.set(sid, transport);
      },
      onsessionclosed: (sid) => {
        sessions.delete(sid);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  return createServer((req, res) => {
    void (async () => {
      try {
        if (!req.url) {
          sendJson(res, 400, { error: "Pedido inválido." });
          return;
        }
        const { pathname } = new URL(req.url, "http://localhost");

        if (pathname === "/healthz") {
          sendJson(res, 200, { status: "ok", activeSessions: sessions.size });
          return;
        }

        if (pathname !== "/mcp") {
          sendJson(res, 404, { error: "Não encontrado." });
          return;
        }

        if (req.method === "GET" || req.method === "POST" || req.method === "DELETE") {
          await handleMcpRequest(req, res);
          return;
        }

        sendJson(res, 405, { error: "Método não suportado." });
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : "Erro interno." });
      }
    })();
  });
}
