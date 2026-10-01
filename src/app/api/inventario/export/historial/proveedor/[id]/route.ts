import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { formatDateOnly } from "@/lib/date";
import { BRAND, drawHeader, drawRow, drawSectionTitle, drawFooter, newPdfBuffer } from "@/lib/pdf-brand";
import { formatCOP } from "@/lib/finanzas/format";
import { getHistorialProveedor } from "@/lib/inventario/historial";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !(session.user.role === "ADMIN" || session.user.puedeVerFinanzas)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "pdf";
  const { nombre, facturas, pagos } = await getHistorialProveedor(id);

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheetFacturas = workbook.addWorksheet("Compras");
    sheetFacturas.columns = [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Monto total", key: "montoTotal", width: 16 },
      { header: "Saldo", key: "saldo", width: 16 },
    ];
    sheetFacturas.getRow(1).font = { bold: true };
    for (const f of facturas) sheetFacturas.addRow({ fecha: formatDateOnly(f.fecha), montoTotal: f.montoTotal, saldo: f.saldo });

    const sheetPagos = workbook.addWorksheet("Pagos");
    sheetPagos.columns = [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Monto", key: "monto", width: 16 },
      { header: "Método", key: "metodoPago", width: 16 },
    ];
    sheetPagos.getRow(1).font = { bold: true };
    for (const p of pagos) sheetPagos.addRow({ fecha: formatDateOnly(p.fecha), monto: p.monto, metodoPago: p.metodoPago ?? "" });

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="historial-${nombre.replace(/\s+/g, "-").toLowerCase()}.xlsx"`,
      },
    });
  }

  const buffer = await newPdfBuffer((doc) => {
    drawHeader(doc, "Historial de proveedor");
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND.verdeHeader).text(nombre, 50, doc.y);
    doc.moveDown(0.5);

    drawSectionTitle(doc, "Compras");
    for (const f of facturas) {
      drawRow(doc, `${formatDateOnly(f.fecha)} — total ${formatCOP(f.montoTotal)}`, `Saldo: ${formatCOP(f.saldo)}`);
    }
    if (facturas.length === 0) drawRow(doc, "Sin compras registradas", "");

    drawSectionTitle(doc, "Pagos");
    for (const p of pagos) {
      drawRow(doc, `${formatDateOnly(p.fecha)}${p.metodoPago ? ` — ${p.metodoPago}` : ""}`, formatCOP(p.monto));
    }
    if (pagos.length === 0) drawRow(doc, "Sin pagos registrados", "");

    drawFooter(doc, "Historial generado por Veragua App.");
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="historial-${nombre.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
