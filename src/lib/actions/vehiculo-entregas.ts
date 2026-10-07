"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { todayColombia } from "@/lib/date";
import { requireVehiculoAccess, requireOwnSalida } from "@/lib/vehiculo/access";
import { putPrivateVehiculoBlob } from "@/lib/vehiculo/blob";

/** Pedidos del día — nunca precios (Order/OrderItem/Producto no tienen columna de
 * precio, así que no hay riesgo de filtrarlos por construcción), y nunca pedidos de
 * otro día. No se filtra por zona: una misma ruta puede tocar varias zonas en un solo
 * viaje (ej. Manizales → Alcalá → Local → Pereira), así que se muestran todos los
 * pedidos de hoy que no estén ya tomados por otra salida — el conductor/staff ve la
 * zona de cada uno para saber en qué parada entregarlo. */
export async function listarPedidosDelDia(salidaId: string) {
  const session = await requireVehiculoAccess();
  const salida = await requireOwnSalida(session, salidaId);
  if (salida.tipoUso !== "RUTA_EMPRESA") return [];

  const hoy = todayColombia();
  return prisma.order.findMany({
    where: {
      fechaEntrega: hoy,
      OR: [{ vehiculoSalidaId: null }, { vehiculoSalidaId: salidaId }],
    },
    select: {
      id: true,
      cliente: true,
      direccion: true,
      telefono: true,
      zona: true,
      notas: true,
      entregado: true,
      entregadoAt: true,
      items: { select: { cantidad: true, producto: { select: { nombre: true } } } },
    },
    orderBy: [{ zona: "asc" }, { cliente: "asc" }],
  });
}

export async function marcarPedidoEntregadoConductor(orderId: string, salidaId: string, formData: FormData) {
  const session = await requireVehiculoAccess();
  const salida = await requireOwnSalida(session, salidaId);
  if (salida.checkinAt) throw new Error("Esta salida ya está cerrada.");

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const hoy = todayColombia();
  if (order.fechaEntrega.getTime() !== hoy.getTime()) {
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

/** El checklist de paradas (lo que no es un pedido de cliente — dejar/recoger insumos
 * en una parada intermedia) lo puede marcar el mismo conductor o el staff. */
export async function toggleParadaCompletada(paradaId: string, completado: boolean) {
  const session = await requireVehiculoAccess();
  const parada = await prisma.vehiculoParada.findUniqueOrThrow({ where: { id: paradaId } });
  const salida = await requireOwnSalida(session, parada.salidaId);
  if (salida.checkinAt) throw new Error("Esta salida ya está cerrada.");

  await prisma.vehiculoParada.update({
    where: { id: paradaId },
    data: {
      completado,
      completadoAt: completado ? new Date() : null,
      completadoPorId: completado ? session.user.id : null,
    },
  });

  revalidatePath(`/vehiculo/${parada.salidaId}`);
}
