import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { dateOnlyToUTC, formatDateOnly } from "@/lib/date";
import { BRAND, drawHeader, drawRow, drawSectionTitle, drawFooter, newPdfBuffer } from "@/lib/pdf-brand";
import { getPnlRows, mergePnlRows, resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { buildPnlStatement } from "@/lib/finanzas/calculations";
import { buildPnlWorkbook } from "@/lib/finanzas/excel";
import { formatCOP } from "@/lib/finanzas/format";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !(session.user.role === "ADMIN" || session.user.puedeVerFinanzas)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
  if (!start || !end) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  const selection = resolveCompanyParam(searchParams.get("company") ?? undefined);
  const startDate = dateOnlyToUTC(start);
  const endDate = dateOnlyToUTC(end);

  const rowSets = await Promise.all(selection.targets.map((c) => getPnlRows(c, startDate, endDate)));
  const statement = buildPnlStatement(mergePnlRows(rowSets));
  const companyLabel = selection.isConsolidated ? "Consolidado Veragua + Melcoch" : COMPANY_LABEL[selection.company!];
  const periodLabel = `${formatDateOnly(startDate)} a ${formatDateOnly(endDate)}`;

  if (format === "xlsx") {
    const buffer = await buildPnlWorkbook(statement, companyLabel, periodLabel);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="pyg-${companyLabel.replace(/\s+/g, "-").toLowerCase()}-${start}-${end}.xlsx"`,
      },
    });
  }

  const buffer = await newPdfBuffer((doc) => {
    drawHeader(doc, "Estado de Resultados (PyG)");
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND.verdeHeader).text(companyLabel, 50, doc.y);
    doc.font("Helvetica").fontSize(10).fillColor(BRAND.grisTexto).text(periodLabel);
    doc.moveDown(0.5);

    drawSectionTitle(doc, statement.ingresosOperacionales.label);
    for (const r of statement.ingresosOperacionales.rows) drawRow(doc, `${r.category_code} · ${r.category_name}`, formatCOP(r.total));
    drawRow(doc, "Total Ingresos Operacionales", formatCOP(statement.ingresosOperacionales.total), { bold: true });

    drawSectionTitle(doc, statement.costoVenta.label);
    for (const r of statement.costoVenta.rows) drawRow(doc, `${r.category_code} · ${r.category_name}`, formatCOP(r.total));
    drawRow(doc, "Total Costo de Ventas", formatCOP(-statement.costoVenta.total), { bold: true });
    drawRow(doc, "= Utilidad Bruta", formatCOP(statement.utilidadBruta), { bold: true, color: BRAND.verdeHeader });

    drawSectionTitle(doc, statement.gastoAdmin.label);
    for (const r of statement.gastoAdmin.rows) drawRow(doc, `${r.category_code} · ${r.category_name}`, formatCOP(r.total));
    drawRow(doc, "Total Gastos de Administración", formatCOP(-statement.gastoAdmin.total), { bold: true });

    drawSectionTitle(doc, statement.gastoVentas.label);
    for (const r of statement.gastoVentas.rows) drawRow(doc, `${r.category_code} · ${r.category_name}`, formatCOP(r.total));
    drawRow(doc, "Total Gastos de Ventas", formatCOP(-statement.gastoVentas.total), { bold: true });
    drawRow(doc, "= Utilidad Operacional (EBIT)", formatCOP(statement.utilidadOperacional), { bold: true, color: BRAND.verdeHeader });

    drawSectionTitle(doc, "Resultado No Operacional");
    for (const r of statement.ingresosNoOperacionales.rows) drawRow(doc, `${r.category_code} · ${r.category_name}`, formatCOP(r.total));
    for (const r of statement.gastoNoOperacional.rows) drawRow(doc, `${r.category_code} · ${r.category_name}`, formatCOP(-r.total));
    drawRow(doc, "= Utilidad Antes de Impuestos", formatCOP(statement.utilidadAntesImpuestos), { bold: true });

    drawSectionTitle(doc, statement.impuesto.label);
    for (const r of statement.impuesto.rows) drawRow(doc, `${r.category_code} · ${r.category_name}`, formatCOP(r.total));
    drawRow(doc, "= Utilidad Neta", formatCOP(statement.utilidadNeta), { bold: true, color: BRAND.verdeHeader });

    drawFooter(doc, "Estado de resultados de uso interno gerencial, base caja, sin descomponer IVA (régimen simple). No reemplaza la contabilidad oficial.");
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pyg-${companyLabel.replace(/\s+/g, "-").toLowerCase()}-${start}-${end}.pdf"`,
    },
  });
}
