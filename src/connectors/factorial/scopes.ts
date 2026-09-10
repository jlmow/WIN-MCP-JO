/**
 * Scopes específicos do conector Factorial. Ver src/permissions/scopes.ts
 * para a lista agregada de todos os conectores.
 *
 * "read" vê todos os colaboradores; "read:self" é uma restrição ao nível
 * da linha — só vê o registo do próprio colaborador (ver
 * src/connectors/factorial/tools/), nunca o dos colegas.
 */
export const FACTORIAL_SCOPES = ["factorial:employees:read", "factorial:employees:read:self"] as const;

export type FactorialScope = (typeof FACTORIAL_SCOPES)[number];
