import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { loadPhcSqlServerSettings } from "../src/connectors/phc/sqlConfig.js";

const ENV_KEYS = [
  "WINSIG_PHC_DB_HOST",
  "WINSIG_PHC_DB_NAME",
  "WINSIG_PHC_DB_USER",
  "WINSIG_PHC_DB_PASSWORD",
  "WINSIG_PHC_DB_PORT",
  "WINSIG_PHC_DB_INSTANCE",
  "WINSIG_PHC_DB_ENCRYPT",
  "WINSIG_PHC_DB_TRUST_SERVER_CERT",
  "WINSIG_PHC_ALLOW_WRITES",
] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function setMinimalEnv(): void {
  process.env.WINSIG_PHC_DB_HOST = "localhost";
  process.env.WINSIG_PHC_DB_NAME = "PHC";
  process.env.WINSIG_PHC_DB_USER = "winsig_mcp_readonly";
  process.env.WINSIG_PHC_DB_PASSWORD = "segredo";
}

test("throws a clear error when a required variable is missing", () => {
  assert.throws(() => loadPhcSqlServerSettings(), /WINSIG_PHC_DB_HOST/);
});

test("defaults are secure: encrypt on, trust-server-cert off, writes off", () => {
  setMinimalEnv();
  const { mssqlConfig, allowWrites } = loadPhcSqlServerSettings();
  assert.equal(mssqlConfig.options?.encrypt, true);
  assert.equal(mssqlConfig.options?.trustServerCertificate, false);
  assert.equal(allowWrites, false);
});

test("defaults to port 1433 when no instance name is given", () => {
  setMinimalEnv();
  const { mssqlConfig } = loadPhcSqlServerSettings();
  assert.equal(mssqlConfig.port, 1433);
  assert.equal(mssqlConfig.options?.instanceName, undefined);
});

test("an explicit instance name takes over and omits the port", () => {
  setMinimalEnv();
  process.env.WINSIG_PHC_DB_INSTANCE = "SQLEXPRESS";
  process.env.WINSIG_PHC_DB_PORT = "1500"; // deve ser ignorado quando há instância
  const { mssqlConfig } = loadPhcSqlServerSettings();
  assert.equal(mssqlConfig.options?.instanceName, "SQLEXPRESS");
  assert.equal(mssqlConfig.port, undefined);
});

test("WINSIG_PHC_ALLOW_WRITES=true is the only value that enables writes", () => {
  setMinimalEnv();
  process.env.WINSIG_PHC_ALLOW_WRITES = "yes";
  assert.equal(loadPhcSqlServerSettings().allowWrites, false);

  process.env.WINSIG_PHC_ALLOW_WRITES = "true";
  assert.equal(loadPhcSqlServerSettings().allowWrites, true);
});
