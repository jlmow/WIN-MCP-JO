import { createFactorialModule } from "./connectors/factorial/module.js";
import { MockFactorialConnector } from "./connectors/factorial/mockConnector.js";
import { createPhcModule } from "./connectors/phc/module.js";
import { MockPhcConnector } from "./connectors/phc/mockConnector.js";
import { loadPhcSqlServerSettings } from "./connectors/phc/sqlConfig.js";
import { PhcSqlServerConnector } from "./connectors/phc/sqlServerConnector.js";
import type { PhcConnector } from "./connectors/phc/types.js";
import type { ConnectorModule } from "./connectors/registry.js";

/**
 * Escolhe entre o conector PHC mock (default, seguro) e o conector real
 * via SQL Server (`WINSIG_PHC_MODE=real`), conforme documentado em
 * `.env.example` e no README ("Ligar ao PHC real").
 */
async function createPhcConnector(): Promise<PhcConnector> {
  const mode = process.env.WINSIG_PHC_MODE ?? "mock";

  if (mode === "mock") {
    return new MockPhcConnector();
  }

  if (mode !== "real") {
    throw new Error(`WINSIG_PHC_MODE desconhecido: '${mode}'. Valores válidos: 'mock' ou 'real'.`);
  }

  const { mssqlConfig, allowWrites } = loadPhcSqlServerSettings();
  console.error(`[winsig-mcp-server] A ligar ao PHC real (SQL Server) em ${mssqlConfig.server}/${mssqlConfig.database}...`);
  const connector = await PhcSqlServerConnector.connect(mssqlConfig, allowWrites);
  console.error(`[winsig-mcp-server] Ligado ao PHC real. Escrita de encomendas: ${allowWrites ? "ativa" : "desativada"}.`);
  return connector;
}

/**
 * Lista de sistemas ligados a este hub. Para ligar um novo sistema
 * (Sage, Primavera, SAP, Odoo, ...): escrever o seu conector + módulo
 * seguindo o padrão de `connectors/phc/` ou `connectors/factorial/`, e
 * acrescentá-lo a esta lista.
 */
export async function createConnectorModules(): Promise<ConnectorModule[]> {
  const phcConnector = await createPhcConnector();
  return [createPhcModule(phcConnector), createFactorialModule(new MockFactorialConnector())];
}
