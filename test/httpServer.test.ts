import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { hashApiKey } from "../src/auth/credentialStore.js";
import { InMemoryAuditSink } from "../src/audit/logger.js";
import { createFactorialModule } from "../src/connectors/factorial/module.js";
import { MockFactorialConnector } from "../src/connectors/factorial/mockConnector.js";
import { createPhcModule } from "../src/connectors/phc/module.js";
import { MockPhcConnector } from "../src/connectors/phc/mockConnector.js";
import { createHttpHub } from "../src/httpServer.js";

const READ_ONLY_KEY = "chave-so-leitura";
const WRITE_KEY = "chave-com-escrita";

let baseUrl: string;
let auditSink: InMemoryAuditSink;
let integrationsFile: string;
let httpServer: ReturnType<typeof createHttpHub>;

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), "winsig-mcp-http-test-"));
  integrationsFile = join(dir, "integrations.json");
  writeFileSync(
    integrationsFile,
    JSON.stringify({
      integrations: [
        {
          id: "cliente-so-leitura",
          label: "Cliente Só Leitura",
          apiKeyHash: hashApiKey(READ_ONLY_KEY),
          scopes: ["phc:clients:read"],
          revoked: false,
        },
        {
          id: "cliente-com-escrita",
          label: "Cliente Com Escrita",
          apiKeyHash: hashApiKey(WRITE_KEY),
          scopes: ["phc:clients:read", "phc:stock:read", "phc:orders:write", "factorial:employees:read"],
          revoked: false,
        },
      ],
    }),
  );

  auditSink = new InMemoryAuditSink();
  const modules = [createPhcModule(new MockPhcConnector()), createFactorialModule(new MockFactorialConnector())];
  httpServer = createHttpHub({ integrationsFile, modules, auditSink });

  await new Promise<void>((resolvePromise) => httpServer.listen(0, "127.0.0.1", resolvePromise));
  const address = httpServer.address();
  if (typeof address !== "object" || address === null) throw new Error("Falha ao obter a porta do servidor HTTP.");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolvePromise, reject) => httpServer.close((err) => (err ? reject(err) : resolvePromise())));
  rmSync(integrationsFile);
});

async function connectClient(apiKey: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await client.connect(transport);
  return client;
}

test("/healthz responds without authentication", async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status: string };
  assert.equal(body.status, "ok");
});

test("rejects a session initialize with no Authorization header", async () => {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await assert.rejects(client.connect(transport));
});

test("rejects a session initialize with an unknown api key", async () => {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: "Bearer chave-que-nao-existe" } },
  });
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await assert.rejects(client.connect(transport));
});

test("two concurrent sessions with different scopes are isolated from each other", async () => {
  const readOnlyClient = await connectClient(READ_ONLY_KEY);
  const writeClient = await connectClient(WRITE_KEY);

  const clients = await readOnlyClient.callTool({ name: "phc.list_clients", arguments: { search: "ferragens" } });
  assert.equal(clients.isError, undefined);

  const denied = await readOnlyClient.callTool({
    name: "phc.create_order",
    arguments: { clientId: "C0001", lines: [{ itemCode: "ART001", quantity: 1 }] },
  });
  assert.equal(denied.isError, true);

  const created = await writeClient.callTool({
    name: "phc.create_order",
    arguments: { clientId: "C0001", lines: [{ itemCode: "ART001", quantity: 2 }] },
  });
  assert.equal(created.isError, undefined);

  await readOnlyClient.close();
  await writeClient.close();
});

test("the shared connector keeps state across independent sessions", async () => {
  const writeClientA = await connectClient(WRITE_KEY);
  const orderA = await writeClientA.callTool({
    name: "phc.create_order",
    arguments: { clientId: "C0001", lines: [{ itemCode: "ART002", quantity: 1 }] },
  });
  await writeClientA.close();

  const writeClientB = await connectClient(WRITE_KEY);
  const orderB = await writeClientB.callTool({
    name: "phc.create_order",
    arguments: { clientId: "C0001", lines: [{ itemCode: "ART002", quantity: 1 }] },
  });
  await writeClientB.close();

  const idA = JSON.parse((orderA.content as Array<{ text: string }>)[0]!.text).id as string;
  const idB = JSON.parse((orderB.content as Array<{ text: string }>)[0]!.text).id as string;
  assert.notEqual(idA, idB, "cada sessão devia continuar a sequência de encomendas do mesmo conector partilhado");
});

test("a second, unrelated connector (Factorial) is served from the same hub with its own scope", async () => {
  const readOnlyClient = await connectClient(READ_ONLY_KEY);

  const deniedEmployees = await readOnlyClient.callTool({ name: "factorial.list_employees", arguments: {} });
  assert.equal(deniedEmployees.isError, true, "cliente sem scope factorial:employees:read deve ser recusado");

  await readOnlyClient.close();

  const writeClient = await connectClient(WRITE_KEY);
  const employees = await writeClient.callTool({ name: "factorial.list_employees", arguments: { search: "engenharia" } });
  assert.equal(employees.isError, undefined);
  assert.match((employees.content as Array<{ text: string }>)[0]!.text, /Ana Ferreira/);

  await writeClient.close();
});
