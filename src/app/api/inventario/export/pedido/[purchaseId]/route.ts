import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateOnly } from "@/lib/date";
import { BRAND, drawHeader, drawRow, drawSectionTitle, drawFooter, newPdfBuffer } from "@/lib/pdf-brand";
import { formatCOP } from "@/lib/finanzas/format";
import { COMPANY_LABEL, type Company } from "@/lib/finanzas/queries";

export async function GET(req: NextRequest, { params }: { params: Promise<{ purchaseId: string }> }) {
  const session = await auth();
  if (!session?.user || !(session.user.role === "ADMIN" || session.user.puedeVerFinanzas)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { purchaseId } = await params;
  const compra = await prisma.finPurchase.findUnique({
    where: { id: purchaseId },
    include: { items: { include: { producto: true } }, proveedor: true },
  });
  if (!compra) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });

  const companyLabel = COMPANY_LABEL[compra.company as Company];
  const titulo = compra.recibido ? "Comprobante de compra" : "Orden de pedido a proveedor";

  const buffer = await newPdfBuffer((doc) => {
    drawHeader(doc, titulo);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND.verdeHeader).text(companyLabel, 50, doc.y);
    doc.font("Helvetica").fontSize(10).fillColor(BRAND.grisTexto).text(formatDateOnly(compra.fecha));
    doc.moveDown(0.5);

    drawRow(doc, "Proveedor", compra.proveedor.nombre);
    if (compra.proveedor.telefono) drawRow(doc, "Teléfono", compra.proveedor.telefono);
    if (compra.numeroFactura) drawRow(doc, "Número de factura", compra.numeroFactura);
    drawRow(doc, "Estado", compra.recibido ? "Recibido" : "Pedido — pendiente de recibir");

    drawSectionTitle(doc, "Productos");
    for (const it of compra.items) {
      drawRow(doc, `${it.cantidad} × ${it.producto.nombre}`, formatCOP(it.cantidad * it.costoUnitario));
    }
    drawRow(doc, "Total", formatCOP(compra.total), { bold: true, color: BRAND.verdeHeader });

    if (compra.notas) {
      drawSectionTitle(doc, "Notas");
      doc.font("Helvetica").fontSize(10).fillColor(BRAND.tierraTexto).text(compra.notas);
    }

    drawFooter(
      doc,
      compra.recibido
        ? "Comprobante generado por Veragua App."
        : "Orden de pedido generada por Veragua App — por favor confirmar disponibilidad y fecha de entrega."
    );
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pedido-${purchaseId}.pdf"`,
    },
  });
}
