import assert from "node:assert/strict";
import { test } from "node:test";
import { PermissionDeniedError, requireScope } from "../src/permissions/check.js";
import type { Identity } from "../src/auth/types.js";

const identity: Identity = { integrationId: "int-1", label: "Teste", scopes: ["clients:read"] };

test("requireScope passes silently when the identity has the scope", () => {
  assert.doesNotThrow(() => requireScope(identity, "clients:read"));
});

test("requireScope throws PermissionDeniedError when the scope is missing", () => {
  assert.throws(() => requireScope(identity, "orders:write"), PermissionDeniedError);
});
