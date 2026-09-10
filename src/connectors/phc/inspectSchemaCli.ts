#!/usr/bin/env node
import "dotenv/config";
import sql from "mssql";
import { loadPhcSqlServerSettings } from "./sqlConfig.js";

/**
 * Ferramenta de introspeção do esquema real do PHC — corre antes de
 * confiares em qualquer query do `PhcSqlServerConnector`.
 *
 * Só lê o catálogo do SQL Server (nomes de tabelas/colunas, tipos,
 * contagens aproximadas de linhas) — NUNCA dados de negócio (nenhuma
 * linha de uma tabela de clientes, artigos, faturas, etc. é lida).
 *
 * Uso:
 *   npm run inspect-phc-schema                 → lista todas as tabelas
 *   npm run inspect-phc-schema -- nome_tabela   → lista as colunas dessa tabela
 */

interface TableRow {
  schemaName: string;
  tableName: string;
  approxRowCount: number | null;
}

interface ColumnRow {
  columnName: string;
  dataType: string;
  isNullable: string;
  maxLength: number | null;
}

async function listTables(pool: sql.ConnectionPool): Promise<TableRow[]> {
  const result = await pool.request().query<TableRow>(`
    SELECT
      t.TABLE_SCHEMA AS schemaName,
      t.TABLE_NAME AS tableName,
      p.rows AS approxRowCount
    FROM INFORMATION_SCHEMA.TABLES t
    LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME AND SCHEMA_NAME(st.schema_id) = t.TABLE_SCHEMA
    LEFT JOIN sys.partitions p ON p.object_id = st.object_id AND p.index_id IN (0, 1)
    WHERE t.TABLE_TYPE = 'BASE TABLE'
    ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME;
  `);
  return result.recordset;
}

async function describeTable(pool: sql.ConnectionPool, tableName: string): Promise<ColumnRow[]> {
  const request = pool.request();
  request.input("tableName", sql.NVarChar, tableName);
  const result = await request.query<ColumnRow>(`
    SELECT
      COLUMN_NAME AS columnName,
      DATA_TYPE AS dataType,
      IS_NULLABLE AS isNullable,
      CHARACTER_MAXIMUM_LENGTH AS maxLength
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @tableName
    ORDER BY ORDINAL_POSITION;
  `);
  return result.recordset;
}

function printTable(headers: string[], widths: number[], rows: string[][]): void {
  console.log(headers.map((h, i) => h.padEnd(widths[i]!)).join(""));
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i]!)).join(""));
  }
}

async function main(): Promise<void> {
  const { mssqlConfig } = loadPhcSqlServerSettings();
  console.error(`[inspect-phc-schema] A ligar a ${mssqlConfig.server}/${mssqlConfig.database}...`);
  const pool = await new sql.ConnectionPool(mssqlConfig).connect();
  console.error("[inspect-phc-schema] Ligado. Isto só lê nomes de tabelas/colunas — nunca dados de negócio.\n");

  try {
    const tableArg = process.argv[2];

    if (!tableArg) {
      const tables = await listTables(pool);
      console.log(`Encontradas ${tables.length} tabelas.\n`);
      printTable(
        ["schema", "tabela", "linhas (aprox.)"],
        [12, 32, 16],
        tables.map((t) => [t.schemaName, t.tableName, String(t.approxRowCount ?? "?")]),
      );
      console.log(
        "\nPara ver as colunas de uma tabela específica: npm run inspect-phc-schema -- <nome_da_tabela>",
      );
    } else {
      const columns = await describeTable(pool, tableArg);
      if (columns.length === 0) {
        console.log(
          `Nenhuma coluna encontrada para a tabela '${tableArg}'. Confirma o nome exato na lista de tabelas (npm run inspect-phc-schema).`,
        );
      } else {
        console.log(`Colunas de '${tableArg}':\n`);
        printTable(
          ["coluna", "tipo", "aceita null", "tamanho"],
          [32, 16, 14, 10],
          columns.map((c) => [c.columnName, c.dataType, c.isNullable, String(c.maxLength ?? "")]),
        );
      }
    }
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error("[inspect-phc-schema] Falhou:", error instanceof Error ? error.message : error);
  process.exit(1);
});
