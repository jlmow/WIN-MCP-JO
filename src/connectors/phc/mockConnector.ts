import type {
  Client,
  CreateOrderInput,
  Invoice,
  ListInvoicesParams,
  ListParams,
  Order,
  PhcConnector,
  StockItem,
} from "./types.js";

/**
 * Implementação de referência de `PhcConnector` com dados em memória.
 *
 * Serve para desenvolver e testar o hub MCP de ponta a ponta sem depender
 * de acesso à API real do PHC Web / PHC CS. Quando essa API estiver
 * disponível, criar um `PhcWebApiConnector` que implemente a mesma
 * interface (`PhcConnector`) e trocar a instância em `src/server.ts` —
 * nenhuma outra camada (auth, permissões, auditoria, ferramentas) muda.
 */
export class MockPhcConnector implements PhcConnector {
  private clients: Client[] = [
    { id: "C0001", name: "Winsig Consultoria, Lda", taxId: "500123456", email: "geral@winsig.pt", city: "Lisboa" },
    { id: "C0002", name: "Ferragens do Norte, S.A.", taxId: "500654321", email: "compras@ferragensnorte.pt", city: "Porto" },
    { id: "C0003", name: "João Pereira - ENI", taxId: "199888777", city: "Braga" },
  ];

  private stock: StockItem[] = [
    { code: "ART001", description: "Parafuso M6x20 inox", quantityAvailable: 4200, unit: "UN", priceExVat: 0.05 },
    { code: "ART002", description: "Chapa aço galvanizado 2mm", quantityAvailable: 150, unit: "M2", priceExVat: 18.5 },
    { code: "ART003", description: "Licença software gestão (anual)", quantityAvailable: 999, unit: "UN", priceExVat: 350 },
  ];

  private invoices: Invoice[] = [
    {
      id: "F2025A/000123",
      number: "FT A/123",
      clientId: "C0001",
      date: "2025-11-10",
      totalWithVat: 430.5,
      status: "paid",
      lines: [{ itemCode: "ART003", description: "Licença software gestão (anual)", quantity: 1, unitPrice: 350 }],
    },
    {
      id: "F2025A/000124",
      number: "FT A/124",
      clientId: "C0002",
      date: "2025-12-02",
      totalWithVat: 2274.75,
      status: "issued",
      lines: [{ itemCode: "ART002", description: "Chapa aço galvanizado 2mm", quantity: 100, unitPrice: 18.5 }],
    },
  ];

  private orders: Order[] = [];
  private nextOrderId = 1;

  async listClients(params: ListParams): Promise<Client[]> {
    const search = params.search?.toLowerCase();
    const filtered = search
      ? this.clients.filter(
          (c) => c.name.toLowerCase().includes(search) || c.taxId.includes(search) || c.id.toLowerCase() === search,
        )
      : this.clients;
    return filtered.slice(0, params.limit ?? 50);
  }

  async getClient(id: string): Promise<Client | null> {
    return this.clients.find((c) => c.id === id) ?? null;
  }

  async listStock(params: ListParams): Promise<StockItem[]> {
    const search = params.search?.toLowerCase();
    const filtered = search
      ? this.stock.filter((s) => s.description.toLowerCase().includes(search) || s.code.toLowerCase() === search)
      : this.stock;
    return filtered.slice(0, params.limit ?? 50);
  }

  async listInvoices(params: ListInvoicesParams): Promise<Invoice[]> {
    const filtered = params.clientId ? this.invoices.filter((i) => i.clientId === params.clientId) : this.invoices;
    return filtered.slice(0, params.limit ?? 50);
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const client = await this.getClient(input.clientId);
    if (!client) {
      throw new Error(`Cliente '${input.clientId}' não encontrado no PHC.`);
    }

    const lines = input.lines.map((line) => {
      const item = this.stock.find((s) => s.code === line.itemCode);
      if (!item) {
        throw new Error(`Artigo '${line.itemCode}' não encontrado no PHC.`);
      }
      if (line.quantity <= 0) {
        throw new Error(`Quantidade inválida para o artigo '${line.itemCode}'.`);
      }
      return { ...line, description: item.description, unitPrice: item.priceExVat };
    });

    const order: Order = {
      id: `ENC${String(this.nextOrderId++).padStart(6, "0")}`,
      clientId: input.clientId,
      date: new Date().toISOString().slice(0, 10),
      status: "pending",
      lines,
      notes: input.notes,
    };
    this.orders.push(order);
    return order;
  }
}
