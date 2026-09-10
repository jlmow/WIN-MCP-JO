import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryAuditSink } from "../src/audit/logger.js";
import type { Identity } from "../src/auth/types.js";
import { runTool } from "../src/tools/helpers.js";

function makeDeps(scopes: Identity["scopes"]) {
  const auditSink = new InMemoryAuditSink();
  const identity: Identity = { integrationId: "int-1", label: "Teste", scopes };
  return { deps: { identity, auditSink }, auditSink };
}

test("runTool returns tool content and audits success when the scope is present", async () => {
  const { deps, auditSink } = makeDeps(["phc:clients:read"]);

  const result = await runTool(
    deps,
    "phc.list_clients",
    "phc:clients:read",
    { search: "x" },
    (r: string[]) => ({ count: r.length }),
    async () => ["cliente-a"],
  );

  assert.equal(result.isError, undefined);
  assert.match(result.content[0]!.text, /cliente-a/);
  assert.equal(auditSink.entries.length, 1);
  assert.equal(auditSink.entries[0]?.success, true);
});

test("runTool denies and audits when the scope is missing, without calling the connector", async () => {
  const { deps, auditSink } = makeDeps([]);
  let called = false;

  const result = await runTool(
    deps,
    "phc.create_order",
    "phc:orders:write",
    { clientId: "C0001" },
    () => undefined,
    async () => {
      called = true;
      return { id: "ENC000001" };
    },
  );

  assert.equal(called, false);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /não tem permissão/);
  assert.equal(auditSink.entries.length, 1);
  assert.equal(auditSink.entries[0]?.success, false);
});
