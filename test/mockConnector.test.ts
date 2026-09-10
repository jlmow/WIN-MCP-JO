import assert from "node:assert/strict";
import { test } from "node:test";
import { MockPhcConnector } from "../src/connectors/phc/mockConnector.js";

test("listClients filters by search term across name, NIF and code", async () => {
  const connector = new MockPhcConnector();
  const byName = await connector.listClients({ search: "ferragens" });
  assert.equal(byName.length, 1);
  assert.equal(byName[0]?.id, "C0002");

  const byTaxId = await connector.listClients({ search: "500123456" });
  assert.equal(byTaxId.length, 1);
  assert.equal(byTaxId[0]?.id, "C0001");
});

test("getClient returns null for an unknown id", async () => {
  const connector = new MockPhcConnector();
  assert.equal(await connector.getClient("C9999"), null);
});

test("createOrder succeeds for a known client and item, pricing lines from stock", async () => {
  const connector = new MockPhcConnector();
  const order = await connector.createOrder({ clientId: "C0001", lines: [{ itemCode: "ART001", quantity: 10 }] });

  assert.equal(order.clientId, "C0001");
  assert.equal(order.status, "pending");
  assert.equal(order.lines.length, 1);
  assert.equal(order.lines[0]?.unitPrice, 0.05);
  assert.equal(order.lines[0]?.description, "Parafuso M6x20 inox");
});

test("createOrder rejects an unknown client", async () => {
  await assert.rejects(
    new MockPhcConnector().createOrder({ clientId: "C9999", lines: [{ itemCode: "ART001", quantity: 1 }] }),
    /não encontrado/,
  );
});

test("createOrder rejects an unknown item", async () => {
  await assert.rejects(
    new MockPhcConnector().createOrder({ clientId: "C0001", lines: [{ itemCode: "ART999", quantity: 1 }] }),
    /não encontrado/,
  );
});

test("createOrder rejects a non-positive quantity", async () => {
  await assert.rejects(
    new MockPhcConnector().createOrder({ clientId: "C0001", lines: [{ itemCode: "ART001", quantity: 0 }] }),
    /Quantidade inválida/,
  );
});
