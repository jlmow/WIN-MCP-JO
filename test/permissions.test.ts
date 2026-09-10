import assert from "node:assert/strict";
import { test } from "node:test";
import { PermissionDeniedError, requireScope } from "../src/permissions/check.js";
import type { Identity } from "../src/auth/types.js";

const identity: Identity = { integrationId: "int-1", label: "Teste", scopes: ["phc:clients:read"] };

test("requireScope passes silently when the identity has the scope", () => {
  assert.doesNotThrow(() => requireScope(identity, "phc:clients:read"));
});

test("requireScope throws PermissionDeniedError when the scope is missing", () => {
  assert.throws(() => requireScope(identity, "phc:orders:write"), PermissionDeniedError);
});

test("scopes from different connectors are independent", () => {
  const multiConnectorIdentity: Identity = {
    integrationId: "int-2",
    label: "Teste multi-conector",
    scopes: ["phc:clients:read", "factorial:employees:read"],
  };

  assert.doesNotThrow(() => requireScope(multiConnectorIdentity, "phc:clients:read"));
  assert.doesNotThrow(() => requireScope(multiConnectorIdentity, "factorial:employees:read"));
  assert.throws(() => requireScope(multiConnectorIdentity, "phc:orders:write"), PermissionDeniedError);
});
