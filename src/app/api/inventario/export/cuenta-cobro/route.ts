import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, todayColombia } from "@/lib/date";
import { newPdfBuffer } from "@/lib/pdf-brand";
import { drawCuentaCobro } from "@/lib/cuenta-cobro";

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

  // Consecutivo: las mismas ventas del mismo cliente conservan su número al volver a descargar.
  const clave = ventas.map((v) => v.id).sort().join(",");
  const emitida = await prisma.cuentaCobroEmitida.upsert({
    where: { clienteId_clave: { clienteId, clave } },
    update: {},
    create: { clienteId, clave },
  });

  // El logo se pide al propio sitio (los archivos de /public no siempre viajan con la función).
  let logo: Buffer | null = null;
  try {
    const r = await fetch(new URL("/logo-veragua-completo.png", req.nextUrl.origin));
    if (r.ok) logo = Buffer.from(await r.arrayBuffer());
  } catch {
    logo = null;
  }

  const filas = ventas.flatMap((v) =>
    v.items.map((it) => ({ fecha: v.fecha, producto: it.producto.nombre, cantidad: it.cantidad, precio: it.precioUnitario }))
  );

  const buffer = await newPdfBuffer((doc) => {
    drawCuentaCobro(
      doc,
      {
        numero: emitida.numero,
        fechaEmision: todayColombia(),
        cliente: { nombre: cliente.nombre, empresa: cliente.empresa, nit: cliente.nit, direccion: cliente.direccion, telefono: cliente.telefono },
        desde: ventas[0].fecha,
        hasta: ventas[ventas.length - 1].fecha,
        filas,
      },
      logo
    );
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cuenta-cobro-${cliente.nombre.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
