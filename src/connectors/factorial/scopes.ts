/** Scopes específicos do conector Factorial. Ver src/permissions/scopes.ts para a lista agregada de todos os conectores. */
export const FACTORIAL_SCOPES = ["factorial:employees:read"] as const;

export type FactorialScope = (typeof FACTORIAL_SCOPES)[number];
