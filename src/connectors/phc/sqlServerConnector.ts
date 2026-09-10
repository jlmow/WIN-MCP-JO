import sql from "mssql";
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

export class WritesDisabledError extends Error {
  constructor() {
    super(
      "Escrita real no PHC está desativada por segurança (WINSIG_PHC_ALLOW_WRITES não é 'true'). " +
        "Só ativar depois de validares as queries de escrita contra uma cópia/backup da base de dados.",
    );
    this.name = "WritesDisabledError";
  }
}

export class WriteNotImplementedError extends Error {
  constructor() {
    super(
      "A escrita real de encomendas ainda não está implementada: as tabelas/regras de numeração do PHC " +
        "para documentos de venda não foram confirmadas contra o teu esquema (ver 'npm run inspect-phc-schema'). " +
        "Preencher a query real em PhcSqlServerConnector.createOrder() depois de confirmar.",
    );
    this.name = "WriteNotImplementedError";
  }
}

interface ClientRow {
  id: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
}

function mapClientRow(row: ClientRow): Client {
  return {
    id: String(row.id).trim(),
    name: row.name?.trim() ?? "",
    taxId: row.taxId?.trim() ?? "",
    email: row.email?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    city: row.city?.trim() || undefined,
  };
}

interface StockRow {
  code: string;
  description: string;
  quantityAvailable: number | null;
  unit: string | null;
  priceExVat: number | null;
}

function mapStockRow(row: StockRow): StockItem {
  return {
    code: String(row.code).trim(),
    description: row.description?.trim() ?? "",
    quantityAvailable: row.quantityAvailable ?? 0,
    unit: row.unit?.trim() ?? "",
    priceExVat: row.priceExVat ?? 0,
  };
}

/**
 * Conector real ao Cegid PHC CS via ligação direta ao SQL Server.
 *
 * ⚠️ AS QUERIES ABAIXO SÃO UMA MELHOR TENTATIVA, NÃO UMA CERTEZA. O
 * esquema de tabelas do PHC CS (nomes de tabelas/colunas) varia por
 * versão e instalação. Antes de confiar em qualquer resultado:
 *
 *   1. Corre `npm run inspect-phc-schema` para listares as tabelas reais.
 *   2. Corre `npm run inspect-phc-schema -- <tabela>` para veres as
 *      colunas reais de cada uma (ex: da tabela de clientes).
 *   3. Confirma/ajusta os nomes marcados "// PHC:" abaixo antes de usar
 *      isto contra dados verdadeiros.
 *
 * As queries só leem/escrevem nas tabelas listadas aqui — nunca haverá
 * um `SELECT *` nem acesso a tabelas fora deste ficheiro.
 */
export class PhcSqlServerConnector implements PhcConnector {
  private constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly allowWrites: boolean,
  ) {}

  static async connect(config: sql.config, allowWrites: boolean): Promise<PhcSqlServerConnector> {
    const pool = await new sql.ConnectionPool(config).connect();
    return new PhcSqlServerConnector(pool, allowWrites);
  }

  async close(): Promise<void> {
    await this.pool.close();
  }

  async listClients(params: ListParams): Promise<Client[]> {
    const request = this.pool.request();
    request.input("search", sql.NVarChar, params.search ? `%${params.search}%` : null);
    request.input("limit", sql.Int, params.limit ?? 50);
    // PHC: tabela "cl" (clientes) — colunas por confirmar com inspect-phc-schema.
    const result = await request.query<ClientRow>(`
      SELECT TOP (@limit)
        no    AS id,
        nome  AS name,
        ncont AS taxId,
        email AS email,
        telefone AS phone,
        local AS city
      FROM cl
      WHERE (@search IS NULL OR nome LIKE @search OR ncont LIKE @search OR CAST(no AS NVARCHAR(50)) = @search)
      ORDER BY nome;
    `);
    return result.recordset.map(mapClientRow);
  }

  async getClient(id: string): Promise<Client | null> {
    const request = this.pool.request();
    request.input("id", sql.NVarChar, id);
    const result = await request.query<ClientRow>(`
      SELECT TOP (1)
        no    AS id,
        nome  AS name,
        ncont AS taxId,
        email AS email,
        telefone AS phone,
        local AS city
      FROM cl
      WHERE CAST(no AS NVARCHAR(50)) = @id;
    `);
    const row = result.recordset[0];
    return row ? mapClientRow(row) : null;
  }

  async listStock(params: ListParams): Promise<StockItem[]> {
    const request = this.pool.request();
    request.input("search", sql.NVarChar, params.search ? `%${params.search}%` : null);
    request.input("limit", sql.Int, params.limit ?? 50);
    // PHC: tabela "st" (stocks/artigos) — colunas por confirmar.
    const result = await request.query<StockRow>(`
      SELECT TOP (@limit)
        ref     AS code,
        design  AS description,
        stock   AS quantityAvailable,
        un      AS unit,
        epv1    AS priceExVat
      FROM st
      WHERE (@search IS NULL OR design LIKE @search OR ref LIKE @search)
      ORDER BY design;
    `);
    return result.recordset.map(mapStockRow);
  }

  async listInvoices(params: ListInvoicesParams): Promise<Invoice[]> {
    const request = this.pool.request();
    request.input("clientId", sql.NVarChar, params.clientId ?? null);
    request.input("limit", sql.Int, params.limit ?? 50);
    // PHC: tabelas "ft" (cabeçalho de fatura) + "fi" (linhas) — colunas
    // por confirmar. O campo "status" aqui é um placeholder ("issued")
    // até confirmarmos como o PHC guarda paga/anulada/rascunho.
    const headerResult = await request.query<{
      id: string;
      number: string;
      clientId: string;
      date: Date;
      totalWithVat: number | null;
    }>(`
      SELECT TOP (@limit)
        fno            AS id,
        CAST(fno AS NVARCHAR(50)) AS number,
        no             AS clientId,
        data           AS date,
        etotal         AS totalWithVat
      FROM ft
      WHERE (@clientId IS NULL OR CAST(no AS NVARCHAR(50)) = @clientId)
      ORDER BY data DESC;
    `);

    const invoices: Invoice[] = [];
    for (const header of headerResult.recordset) {
      const linesRequest = this.pool.request();
      linesRequest.input("invoiceId", sql.NVarChar, header.id);
      const linesResult = await linesRequest.query<{
        itemCode: string;
        description: string;
        quantity: number;
        unitPrice: number;
      }>(`
        SELECT
          ref    AS itemCode,
          design AS description,
          qtt    AS quantity,
          epv1   AS unitPrice
        FROM fi
        WHERE fno = @invoiceId;
      `);
      invoices.push({
        id: String(header.id),
        number: header.number,
        clientId: String(header.clientId),
        date: header.date instanceof Date ? header.date.toISOString().slice(0, 10) : String(header.date),
        totalWithVat: header.totalWithVat ?? 0,
        status: "issued", // placeholder — ver nota acima
        lines: linesResult.recordset.map((l) => ({
          itemCode: l.itemCode?.trim() ?? "",
          description: l.description?.trim() ?? "",
          quantity: l.quantity ?? 0,
          unitPrice: l.unitPrice ?? 0,
        })),
      });
    }
    return invoices;
  }

  async createOrder(_input: CreateOrderInput): Promise<Order> {
    if (!this.allowWrites) {
      throw new WritesDisabledError();
    }
    // Escrever um documento de venda no PHC envolve numeração de
    // documentos, tipo de documento (bo2), triggers de atualização de
    // stock, entre outras regras internas do PHC que não devem ser
    // adivinhadas — daqui viria corrupção de dados reais, não só um
    // resultado errado como nas leituras acima. Implementar isto exige
    // primeiro confirmar essas regras com quem administra o PHC (ou
    // trocar para a API do PHC Web assim que disponível, que já as
    // aplica por si).
    throw new WriteNotImplementedError();
  }
}
