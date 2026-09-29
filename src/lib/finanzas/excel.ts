import ExcelJS from "exceljs";
import type { PnlStatement } from "./calculations";
import type { TransactionRow } from "@/components/finanzas/TransactionTable";
import { formatDateOnly } from "@/lib/date";

export async function buildTransactionsWorkbook(rows: (TransactionRow & { companyLabel?: string })[]): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Movimientos");
  const hasCompanyCol = rows.some((r) => r.companyLabel);

  sheet.columns = [
    ...(hasCompanyCol ? [{ header: "Empresa", key: "empresa", width: 12 }] : []),
    { header: "Fecha", key: "fecha", width: 12 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Código categoría", key: "codigo", width: 16 },
    { header: "Categoría", key: "categoria", width: 28 },
    { header: "Canal", key: "canal", width: 14 },
    { header: "Monto (COP)", key: "monto", width: 16 },
    { header: "Método de pago", key: "metodoPago", width: 16 },
    { header: "Descripción", key: "descripcion", width: 30 },
    { header: "Cliente/Proveedor", key: "contraparte", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const t of rows) {
    sheet.addRow({
      empresa: t.companyLabel,
      fecha: formatDateOnly(t.fecha),
      tipo: t.tipo === "income" ? "Ingreso" : "Egreso",
      codigo: t.categoria.codigo,
      categoria: t.categoria.nombre,
      canal: t.canal?.nombre ?? "",
      monto: t.monto,
      metodoPago: t.metodoPago ?? "",
      descripcion: t.descripcion ?? "",
      contraparte: t.contraparte ?? "",
    });
  }
  sheet.getColumn("monto").numFmt = "#,##0";

  return workbook.xlsx.writeBuffer();
}

export async function buildPnlWorkbook(statement: PnlStatement, companyLabel: string, periodLabel: string): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("PyG");
  sheet.columns = [
    { header: "Concepto", key: "label", width: 45 },
    { header: "Valor (COP)", key: "value", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({ label: `${companyLabel} — ${periodLabel}` });
  sheet.addRow({});

  function addSection(label: string, rows: { category_code: string; category_name: string; total: number }[]) {
    sheet.addRow({ label }).font = { bold: true };
    for (const row of rows) {
      sheet.addRow({ label: `  ${row.category_code} · ${row.category_name}`, value: row.total });
    }
  }

  addSection(statement.ingresosOperacionales.label, statement.ingresosOperacionales.rows);
  sheet.addRow({ label: "Total Ingresos Operacionales", value: statement.ingresosOperacionales.total }).font = { bold: true };

  addSection(statement.costoVenta.label, statement.costoVenta.rows);
  sheet.addRow({ label: "Total Costo de Ventas", value: -statement.costoVenta.total }).font = { bold: true };

  sheet.addRow({ label: "= Utilidad Bruta", value: statement.utilidadBruta }).font = { bold: true };

  addSection(statement.gastoAdmin.label, statement.gastoAdmin.rows);
  sheet.addRow({ label: "Total Gastos de Administración", value: -statement.gastoAdmin.total }).font = { bold: true };

  addSection(statement.gastoVentas.label, statement.gastoVentas.rows);
  sheet.addRow({ label: "Total Gastos de Ventas", value: -statement.gastoVentas.total }).font = { bold: true };

  sheet.addRow({ label: "= Utilidad Operacional (EBIT)", value: statement.utilidadOperacional }).font = { bold: true };

  addSection(statement.ingresosNoOperacionales.label, statement.ingresosNoOperacionales.rows);
  addSection(statement.gastoNoOperacional.label, statement.gastoNoOperacional.rows);
  sheet.addRow({
    label: "+/- Resultado No Operacional",
    value: statement.ingresosNoOperacionales.total - statement.gastoNoOperacional.total,
  }).font = { bold: true };

  sheet.addRow({ label: "= Utilidad Antes de Impuestos", value: statement.utilidadAntesImpuestos }).font = { bold: true };

  addSection(statement.impuesto.label, statement.impuesto.rows);
  sheet.addRow({ label: "Total Impuestos", value: -statement.impuesto.total }).font = { bold: true };

  sheet.addRow({ label: "= Utilidad Neta", value: statement.utilidadNeta }).font = { bold: true };
  sheet.getColumn("value").numFmt = "#,##0";

  return workbook.xlsx.writeBuffer();
}
