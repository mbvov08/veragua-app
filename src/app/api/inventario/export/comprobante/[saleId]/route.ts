import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { newPdfBuffer } from "@/lib/pdf-brand";
import { drawCuentaCobro, fechaLarga } from "@/lib/cuenta-cobro";
import { COMPANY_LABEL, type Company } from "@/lib/finanzas/queries";

export async function GET(req: NextRequest, { params }: { params: Promise<{ saleId: string }> }) {
  const session = await auth();
  if (!session?.user || !(session.user.role === "ADMIN" || session.user.puedeVerFinanzas)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { saleId } = await params;
  const venta = await prisma.finSale.findUnique({
    where: { id: saleId },
    include: { items: { include: { producto: true } }, cliente: true, canal: true, cuentaPorCobrar: true },
  });
  if (!venta) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });

  const abonos = venta.cuentaPorCobrar ? venta.cuentaPorCobrar.montoTotal - venta.cuentaPorCobrar.saldo : venta.total;
  const saldo = venta.cuentaPorCobrar?.saldo ?? 0;

  let logo: Buffer | null = null;
  try {
    const r = await fetch(new URL("/logo-veragua.png", req.nextUrl.origin));
    if (r.ok) logo = Buffer.from(await r.arrayBuffer());
  } catch {
    logo = null;
  }

  const c = venta.cliente;
  const buffer = await newPdfBuffer((doc) => {
    drawCuentaCobro(
      doc,
      {
        numero: 0,
        titulo: "COMPROBANTE DE VENTA",
        subtitulo: venta.estado === "pagada" ? "PAGADA" : "PENDIENTE DE PAGO",
        rotuloEmisor: "VENDIDO POR",
        negocio: COMPANY_LABEL[venta.company as Company],
        intro: `Detalle de la venta realizada el ${fechaLarga(venta.fecha)}${venta.canal ? ` (${venta.canal.nombre})` : ""}:`,
        fechaEmision: venta.fecha,
        cliente: {
          nombre: c?.nombre ?? "Consumidor final",
          empresa: c?.empresa ?? null,
          nit: c?.nit ?? null,
          direccion: c?.direccion ?? "",
          telefono: c?.telefono ?? null,
        },
        desde: venta.fecha,
        hasta: venta.fecha,
        filas: venta.items.map((it) => ({ fecha: venta.fecha, producto: it.producto.nombre, cantidad: it.cantidad, precio: it.precioUnitario })),
        resumenPagos: { abonos, saldo },
        notas: venta.notas ? [venta.notas] : [],
        mostrarFormaPago: saldo > 0,
      },
      logo
    );
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="comprobante-${saleId}.pdf"`,
    },
  });
}
