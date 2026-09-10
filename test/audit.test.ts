import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryAuditSink, withAudit } from "../src/audit/logger.js";

const baseCtx = { integrationId: "int-1", integrationLabel: "Teste", tool: "list_clients", params: { search: "x" } };

test("withAudit records a successful call with its summary", async () => {
  const sink = new InMemoryAuditSink();
  const result = await withAudit(sink, baseCtx, (r: string[]) => ({ count: r.length }), async () => ["a", "b"]);

  assert.deepEqual(result, ["a", "b"]);
  assert.equal(sink.entries.length, 1);
  assert.equal(sink.entries[0]?.success, true);
  assert.deepEqual(sink.entries[0]?.resultSummary, { count: 2 });
});

test("withAudit records a failed call and rethrows the original error", async () => {
  const sink = new InMemoryAuditSink();

  await assert.rejects(
    withAudit(sink, baseCtx, () => undefined, async () => {
      throw new Error("falhou de propósito");
    }),
    /falhou de propósito/,
  );

  assert.equal(sink.entries.length, 1);
  assert.equal(sink.entries[0]?.success, false);
  assert.equal(sink.entries[0]?.error, "falhou de propósito");
});
