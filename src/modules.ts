import { createFactorialModule } from "./connectors/factorial/module.js";
import { MockFactorialConnector } from "./connectors/factorial/mockConnector.js";
import { createPhcModule } from "./connectors/phc/module.js";
import { MockPhcConnector } from "./connectors/phc/mockConnector.js";
import type { ConnectorModule } from "./connectors/registry.js";

/**
 * Lista de sistemas ligados a este hub. Hoje só há implementações mock
 * (dados fictícios) — quando houver acesso real à API do PHC Web ou ao
 * Factorial, troca-se `MockPhcConnector`/`MockFactorialConnector` pela
 * implementação real aqui, sem tocar em mais nada.
 *
 * Para ligar um novo sistema (Sage, Primavera, SAP, Odoo, ...): escrever o
 * seu conector + módulo seguindo o padrão de `connectors/phc/` ou
 * `connectors/factorial/`, e acrescentá-lo a esta lista.
 */
export function createConnectorModules(): ConnectorModule[] {
  return [createPhcModule(new MockPhcConnector()), createFactorialModule(new MockFactorialConnector())];
}
