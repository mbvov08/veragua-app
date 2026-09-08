import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateShortEs } from "@/lib/date";
import { BRAND, drawHeader, drawRow, drawSectionTitle, drawFooter, newPdfBuffer } from "@/lib/pdf-brand";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pagoId: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { pagoId } = await params;
  const pago = await prisma.pagoGalpon.findUnique({
    where: { id: pagoId },
    include: { user: true },
  });
  if (!pago) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const buffer = await newPdfBuffer((doc) => {
    drawHeader(doc, "Comprobante de pago por producción — Galpón");

    doc.font("Helvetica-Bold").fontSize(14).fillColor(BRAND.verdeHeader).text(pago.user.name, 50, doc.y);
    doc.font("Helvetica").fontSize(10).fillColor(BRAND.grisTexto).text(
      `Periodo: ${formatDateShortEs(pago.periodStart)} — ${formatDateShortEs(pago.periodEnd)}`
    );
    doc.moveDown(1);

    drawSectionTitle(doc, "Producción reportada");
    drawRow(doc, "Huevos producidos", pago.huevosProducidos.toLocaleString("es-CO"));
    drawRow(doc, "Huevos rotos", pago.huevosRotos.toLocaleString("es-CO"));
    drawRow(doc, "Huevos en buen estado", (pago.huevosProducidos - pago.huevosRotos).toLocaleString("es-CO"));

    drawSectionTitle(doc, "Verificación contra el local");
    drawRow(doc, "Recibido en el local", pago.huevosRecibidosLocal.toLocaleString("es-CO"));
    drawRow(doc, "Cantidad verificada (menor de las dos)", pago.huevosVerificados.toLocaleString("es-CO"), { bold: true });

    drawSectionTitle(doc, "Pago");
    drawRow(doc, "Cubetas (verificadas)", pago.cubetas.toFixed(2));
    drawRow(doc, "Valor por cubeta", COP.format(pago.valorCubeta));
    drawRow(doc, "Total a pagar", COP.format(pago.totalPagar), { bold: true, color: BRAND.verdeHeader });

    drawFooter(
      doc,
      "El pago se calcula sobre el menor valor entre lo producido en el galpón y lo efectivamente recibido en el local durante el periodo."
    );
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pago_galpon_${pago.user.name.replace(/\s+/g, "_")}_${formatDateShortEs(pago.periodStart).replace(/\//g, "-")}.pdf"`,
    },
  });
}
