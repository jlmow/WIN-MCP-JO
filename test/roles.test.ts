import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { CredentialStore, hashApiKey } from "../src/auth/credentialStore.js";
import { resolveRoleScopes } from "../src/permissions/roles.js";

function writeIntegrationsFile(records: unknown[]): string {
  const dir = mkdtempSync(join(tmpdir(), "winsig-mcp-roles-test-"));
  const filePath = join(dir, "integrations.json");
  writeFileSync(filePath, JSON.stringify({ integrations: records }));
  return filePath;
}

test("resolveRoleScopes returns the scopes of a known role", () => {
  assert.deepEqual(resolveRoleScopes("consultor"), ["phc:clients:read", "phc:stock:read"]);
});

test("resolveRoleScopes throws for an unknown role", () => {
  assert.throws(() => resolveRoleScopes("papel-inventado"), /Perfil desconhecido/);
});

test("consultor role has no sales or HR access", () => {
  const scopes = resolveRoleScopes("consultor");
  assert.equal(scopes.includes("phc:invoices:read"), false);
  assert.equal(scopes.includes("phc:orders:write"), false);
  assert.equal(scopes.some((s) => s.startsWith("factorial:")), false);
});

test("an integration configured with a role resolves to that role's scopes", () => {
  const filePath = writeIntegrationsFile([
    { id: "int-1", label: "Consultor Teste", apiKeyHash: hashApiKey("chave"), role: "consultor" },
  ]);

  const identity = CredentialStore.fromFile(filePath).resolve("chave");
  assert.deepEqual(identity?.scopes, ["phc:clients:read", "phc:stock:read"]);

  rmSync(filePath, { recursive: true });
});

test("a role and explicit scopes combine without duplicating", () => {
  const filePath = writeIntegrationsFile([
    {
      id: "int-1",
      label: "Consultor com extra",
      apiKeyHash: hashApiKey("chave"),
      role: "consultor",
      scopes: ["phc:stock:read", "factorial:employees:read:self"],
    },
  ]);

  const identity = CredentialStore.fromFile(filePath).resolve("chave");
  assert.deepEqual(
    [...(identity?.scopes ?? [])].sort(),
    ["factorial:employees:read:self", "phc:clients:read", "phc:stock:read"].sort(),
  );

  rmSync(filePath, { recursive: true });
});

test("an unknown role referenced in the config file fails fast with a clear error", () => {
  const filePath = writeIntegrationsFile([
    { id: "int-1", label: "Teste", apiKeyHash: hashApiKey("chave"), role: "papel-inventado" },
  ]);

  assert.throws(() => CredentialStore.fromFile(filePath), /Perfil desconhecido/);
  rmSync(filePath, { recursive: true });
});

test("attributes travel from the config file into the resolved identity", () => {
  const filePath = writeIntegrationsFile([
    {
      id: "int-1",
      label: "Colaborador Teste",
      apiKeyHash: hashApiKey("chave"),
      role: "colaborador",
      attributes: { factorialEmployeeId: "E001" },
    },
  ]);

  const identity = CredentialStore.fromFile(filePath).resolve("chave");
  assert.deepEqual(identity?.attributes, { factorialEmployeeId: "E001" });

  rmSync(filePath, { recursive: true });
});
