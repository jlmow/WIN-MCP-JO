/**
 * Tipos de domínio e contrato de acesso ao Cegid PHC CS.
 *
 * O servidor MCP nunca fala diretamente com a base de dados do PHC.
 * Toda a comunicação passa por uma implementação de `PhcConnector`.
 * Isto permite: (1) testar e desenvolver o hub sem acesso ao PHC real
 * através do `MockPhcConnector`, e (2) trocar para a API real do PHC Web
 * mais tarde sem tocar em auth, permissões, auditoria ou nas ferramentas MCP.
 */

export interface Client {
  id: string;
  name: string;
  taxId: string;
  email?: string;
  phone?: string;
  city?: string;
}

export interface StockItem {
  code: string;
  description: string;
  quantityAvailable: number;
  unit: string;
  priceExVat: number;
}

export interface InvoiceLine {
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  number: string;
  clientId: string;
  date: string;
  totalWithVat: number;
  status: "draft" | "issued" | "paid" | "cancelled";
  lines: InvoiceLine[];
}

export interface OrderLineInput {
  itemCode: string;
  quantity: number;
}

export interface CreateOrderInput {
  clientId: string;
  lines: OrderLineInput[];
  notes?: string;
}

export interface Order {
  id: string;
  clientId: string;
  date: string;
  status: "pending" | "confirmed" | "cancelled";
  lines: (OrderLineInput & { description: string; unitPrice: number })[];
  notes?: string;
}

export interface ListParams {
  search?: string;
  limit?: number;
}

export interface ListInvoicesParams {
  clientId?: string;
  limit?: number;
}

/**
 * Contrato que qualquer conector ao PHC (ou a outra solução Winsig) tem de
 * implementar para ser exposto como ferramentas MCP. Só devem existir aqui
 * as operações explicitamente autorizadas para acesso via IA — nunca o
 * sistema completo.
 */
export interface PhcConnector {
  listClients(params: ListParams): Promise<Client[]>;
  getClient(id: string): Promise<Client | null>;
  listStock(params: ListParams): Promise<StockItem[]>;
  listInvoices(params: ListInvoicesParams): Promise<Invoice[]>;
  createOrder(input: CreateOrderInput): Promise<Order>;
}
