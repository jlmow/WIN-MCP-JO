import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CredentialStore, hashApiKey } from "../src/auth/credentialStore.js";

function writeIntegrationsFile(records: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), "winsig-mcp-test-"));
  const filePath = join(dir, "integrations.json");
  writeFileSync(filePath, JSON.stringify({ integrations: records }));
  return filePath;
}

test("hashApiKey is deterministic", () => {
  assert.equal(hashApiKey("segredo"), hashApiKey("segredo"));
  assert.notEqual(hashApiKey("segredo"), hashApiKey("outro-segredo"));
});

test("resolves a valid, active credential to its identity and scopes", () => {
  const filePath = writeIntegrationsFile([
    {
      id: "int-1",
      label: "Integração de Teste",
      apiKeyHash: hashApiKey("chave-correta"),
      scopes: ["clients:read", "stock:read"],
      revoked: false,
    },
  ]);

  const store = CredentialStore.fromFile(filePath);
  const identity = store.resolve("chave-correta");

  assert.deepEqual(identity, {
    integrationId: "int-1",
    label: "Integração de Teste",
    scopes: ["clients:read", "stock:read"],
  });

  rmSync(filePath);
});

test("rejects an unknown api key", () => {
  const filePath = writeIntegrationsFile([
    { id: "int-1", label: "Teste", apiKeyHash: hashApiKey("chave-correta"), scopes: [], revoked: false },
  ]);
  const store = CredentialStore.fromFile(filePath);

  assert.equal(store.resolve("chave-errada"), null);
  rmSync(filePath);
});

test("rejects a revoked credential even with the correct key", () => {
  const filePath = writeIntegrationsFile([
    { id: "int-1", label: "Teste", apiKeyHash: hashApiKey("chave-correta"), scopes: ["clients:read"], revoked: true },
  ]);
  const store = CredentialStore.fromFile(filePath);

  assert.equal(store.resolve("chave-correta"), null);
  rmSync(filePath);
});

test("throws when the config file lists an unknown scope", () => {
  const filePath = writeIntegrationsFile([
    { id: "int-1", label: "Teste", apiKeyHash: hashApiKey("chave-correta"), scopes: ["scope-inventado"], revoked: false },
  ]);

  assert.throws(() => CredentialStore.fromFile(filePath), /scopes desconhecidos/);
  rmSync(filePath);
});
