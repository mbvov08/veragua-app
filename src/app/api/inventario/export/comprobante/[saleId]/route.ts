import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/date";
import { BRAND, drawHeader, drawRow, drawSectionTitle, drawFooter, newPdfBuffer } from "@/lib/pdf-brand";
import { formatCOP } from "@/lib/finanzas/format";
import { COMPANY_LABEL, type Company } from "@/lib/finanzas/queries";

export async function GET(req: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  const session = await auth();
  if (!session?.user || !(session.user.role === "ADMIN" || session.user.puedeVerFinanzas)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { saleId } = await params;
  const venta = await prisma.finSale.findUnique({
    where: { id: saleId },
    include: { items: { include: { producto: true } }, cliente: true, canal: true },
  });
  if (!venta) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });

  const companyLabel = COMPANY_LABEL[venta.company as Company];

  const buffer = await newPdfBuffer((doc) => {
    drawHeader(doc, "Comprobante de venta");
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND.verdeHeader).text(companyLabel, 50, doc.y);
    doc.font("Helvetica").fontSize(10).fillColor(BRAND.grisTexto).text(formatDateOnly(venta.fecha));
    doc.moveDown(0.5);

    drawRow(doc, "Cliente", venta.cliente?.nombre ?? "Consumidor final");
    if (venta.canal) drawRow(doc, "Canal", venta.canal.nombre);
    drawRow(doc, "Estado", venta.estado === "pagada" ? "Pagada" : "Pendiente de pago");

    drawSectionTitle(doc, "Productos");
    for (const it of venta.items) {
      drawRow(doc, `${it.cantidad} × ${it.producto.nombre}`, formatCOP(it.cantidad * it.precioUnitario));
    }
    drawRow(doc, "Total", formatCOP(venta.total), { bold: true, color: BRAND.verdeHeader });

    if (venta.notas) {
      drawSectionTitle(doc, "Notas");
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.tierraTexto).text(venta.notas);
    }

    drawFooter(doc, "Comprobante generado por Veragua App. No tiene validez como factura electrónica.");
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="comprobante-${saleId}.pdf"`,
    },
  });
}
