import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, formatDateOnly } from "@/lib/date";
import { BRAND, drawHeader, drawRow, drawSectionTitle, drawFooter, newPdfBuffer } from "@/lib/pdf-brand";
import { formatCOP } from "@/lib/finanzas/format";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !(session.user.role === "ADMIN" || session.user.puedeVerFinanzas)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const saleIdsParam = searchParams.get("saleIds");
  if (!clienteId) return NextResponse.json({ error: "Falta el cliente" }, { status: 400 });

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const saleIds = saleIdsParam ? saleIdsParam.split(",").filter(Boolean) : null;
  const ventas = await prisma.finSale.findMany({
    where: {
      clienteId,
      ...(saleIds
        ? { id: { in: saleIds } }
        : { fecha: { gte: start ? dateOnlyToUTC(start) : undefined, lte: end ? dateOnlyToUTC(end) : undefined } }),
    },
    include: { items: { include: { producto: true } } },
    orderBy: { fecha: "asc" },
  });

  if (ventas.length === 0) {
    return NextResponse.json({ error: "No hay ventas para los filtros dados" }, { status: 404 });
  }

  const total = ventas.reduce((sum, v) => sum + v.total, 0);
  const periodo = saleIds ? "Ventas seleccionadas" : `${formatDateOnly(ventas[0].fecha)} a ${formatDateOnly(ventas[ventas.length - 1].fecha)}`;

  const buffer = await newPdfBuffer((doc) => {
    drawHeader(doc, "Cuenta de cobro");
    doc.font("Helvetica-Bold").fontSize(13).fillColor(BRAND.verdeHeader).text(cliente.nombre, 50, doc.y);
    doc.font("Helvetica").fontSize(10).fillColor(BRAND.grisTexto).text(periodo);
    doc.moveDown(0.5);

    drawSectionTitle(doc, "Detalle");
    for (const v of ventas) {
      const resumen = v.items.map((it) => `${it.cantidad} ${it.producto.nombre}`).join(", ");
      drawRow(doc, `${formatDateOnly(v.fecha)} — ${resumen}`, formatCOP(v.total));
    }
    drawRow(doc, "Total a cobrar", formatCOP(total), { bold: true, color: BRAND.verdeHeader });

    drawFooter(doc, "Cuenta de cobro generada por Veragua App. No tiene validez como factura electrónica.");
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cuenta-cobro-${cliente.nombre.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
