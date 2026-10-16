"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { requireVehiculoAccess, requireVehiculoStaff, requireOwnSalida } from "@/lib/vehiculo/access";
import { sincronizarInventarioPorEntrega } from "@/lib/pedidos/inventario";

/** Pedidos del día — nunca precios (Order/OrderItem/Producto no tienen columna de
 * precio, así que no hay riesgo de filtrarlos por construcción), y nunca pedidos de
 * otro día. Solo los que quedaron explícitamente asignados a ESTA salida (al planear
 * la ruta, o agregados después por staff) — mostrar también los pedidos de hoy sin
 * asignar hacía que cualquier pedido suelto del día (de otro cliente, ya entregado,
 * o de otra ruta) apareciera en la pantalla del conductor sin corresponderle. */
export async function listarPedidosDelDia(salidaId: string) {
  const session = await requireVehiculoAccess();
  const salida = await requireOwnSalida(session, salidaId);
  if (salida.tipoUso !== "RUTA_EMPRESA") return [];

  return prisma.order.findMany({
    where: {
      entregaTercero: null,
      vehiculoSalidaId: salidaId,
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

/** Para planear la ruta con anticipación (antes de que el conductor esté presente con
 * el vehículo): lista los pedidos pendientes de una fecha cualquiera, para elegir cuáles
 * va a llevar esa salida. Se usa en /vehiculo/nueva, independiente de cuándo se termine
 * de guardar el acta (el borrador local ya deja seguir después). */
export async function listarPedidosPendientesPorFecha(fechaStr: string) {
  // Acceso abierto a todo el módulo (no solo staff) — el conductor también puede llegar
  // a necesitar elegir los pedidos de su ruta si nadie de la empresa está disponible
  // para planearla por él (ver requireEntregaAccess en crearSalida).
  await requireVehiculoAccess();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) return [];

  const fecha = dateOnlyToUTC(fechaStr);
  return prisma.order.findMany({
    where: { fechaEntrega: fecha, entregaTercero: null, entregado: false, vehiculoSalidaId: null },
    select: {
      id: true,
      cliente: true,
      direccion: true,
      zona: true,
      items: { select: { cantidad: true, producto: { select: { nombre: true } } } },
    },
    orderBy: [{ zona: "asc" }, { cliente: "asc" }],
  });
}

/** Solo el staff arma la ruta de la salida: asigna los pedidos que lleva el conductor y
 * registra cuáles se entregaron. César no arma la ruta ni marca entregas. */
export async function asignarPedidoASalida(salidaId: string, orderId: string) {
  await requireVehiculoStaff();
  await prisma.order.update({ where: { id: orderId }, data: { vehiculoSalidaId: salidaId } });
  revalidatePath(`/vehiculo/${salidaId}`);
  revalidatePath("/pedidos");
}

export async function quitarPedidoDeSalida(salidaId: string, orderId: string) {
  await requireVehiculoStaff();
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.vehiculoSalidaId !== salidaId) throw new Error("Este pedido no está en esta salida.");
  await prisma.order.update({ where: { id: orderId }, data: { vehiculoSalidaId: null } });
  revalidatePath(`/vehiculo/${salidaId}`);
  revalidatePath("/pedidos");
}

export async function marcarPedidoEntregadoStaff(salidaId: string, orderId: string, entregado: boolean) {
  const session = await requireVehiculoStaff();
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.vehiculoSalidaId !== salidaId) throw new Error("Este pedido no está en esta salida.");
  await prisma.order.update({ where: { id: orderId }, data: { entregado, entregadoAt: entregado ? new Date() : null } });
  await sincronizarInventarioPorEntrega(orderId, entregado, session.user.id);
  revalidatePath(`/vehiculo/${salidaId}`);
  revalidatePath("/pedidos");
  revalidatePath("/pedidos/pereira");
  revalidatePath("/calendario");
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
