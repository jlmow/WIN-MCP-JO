/** Scopes específicos do conector Cegid PHC CS. Ver src/permissions/scopes.ts para a lista agregada de todos os conectores. */
export const PHC_SCOPES = ["phc:clients:read", "phc:stock:read", "phc:invoices:read", "phc:orders:write"] as const;

export type PhcScope = (typeof PHC_SCOPES)[number];
