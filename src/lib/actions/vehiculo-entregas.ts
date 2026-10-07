"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { todayColombia } from "@/lib/date";
import { requireVehiculoAccess, requireOwnSalida } from "@/lib/vehiculo/access";
import { putPrivateVehiculoBlob } from "@/lib/vehiculo/blob";

/** Pedidos del día que calzan con la ruta de esta salida — nunca precios (Order/
 * OrderItem/Producto no tienen columna de precio, así que no hay riesgo de filtrarlos
 * por construcción), y nunca pedidos de otra zona o de otro día. */
export async function listarPedidosDelDia(salidaId: string) {
  const session = await requireVehiculoAccess();
  const salida = await requireOwnSalida(session, salidaId);
  if (salida.tipoUso !== "RUTA_EMPRESA" || !salida.zona) return [];

  const hoy = todayColombia();
  return prisma.order.findMany({
    where: {
      zona: salida.zona,
      fechaEntrega: hoy,
      OR: [{ vehiculoSalidaId: null }, { vehiculoSalidaId: salidaId }],
    },
    select: {
      id: true,
      cliente: true,
      direccion: true,
      telefono: true,
      notas: true,
      entregado: true,
      entregadoAt: true,
      items: { select: { cantidad: true, producto: { select: { nombre: true } } } },
    },
    orderBy: [{ cliente: "asc" }],
  });
}

export async function marcarPedidoEntregadoConductor(orderId: string, salidaId: string, formData: FormData) {
  const session = await requireVehiculoAccess();
  const salida = await requireOwnSalida(session, salidaId);
  if (salida.checkinAt) throw new Error("Esta salida ya está cerrada.");

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const hoy = todayColombia();
  if (order.zona !== salida.zona || order.fechaEntrega.getTime() !== hoy.getTime()) {
    throw new Error("Este pedido no corresponde a la ruta de hoy.");
  }

  const file = formData.get("foto") as File | null;
  if (!file || file.size === 0) throw new Error("La foto de la remisión firmada es obligatoria.");

  const blob = await putPrivateVehiculoBlob(`vehiculo/${crypto.randomUUID()}-remision.jpg`, file);
  const archivo = await prisma.vehiculoArchivo.create({
    data: { blobPathname: blob.pathname, contentType: blob.contentType, subidoPorId: session.user.id, salidaId },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { entregado: true, entregadoAt: new Date(), vehiculoSalidaId: salidaId, entregaArchivoId: archivo.id },
  });

  revalidatePath(`/vehiculo/${salidaId}`);
  revalidatePath("/pedidos");
}
