import type { Identity } from "../../auth/types.js";

/** Chave em `Identity.attributes` que identifica o colaborador quando o scope concedido é o restrito (":self"), não o total. */
export const OWN_EMPLOYEE_ID_ATTRIBUTE = "factorialEmployeeId";

export function hasFullEmployeeAccess(identity: Identity): boolean {
  return identity.scopes.includes("factorial:employees:read");
}

export function ownEmployeeId(identity: Identity): string | undefined {
  return identity.attributes?.[OWN_EMPLOYEE_ID_ATTRIBUTE];
}
