"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { requireVehiculoAdmin, requireEntregaAccess, requireDevolucionAccess } from "@/lib/vehiculo/access";

function revalidateVehiculo() {
  revalidatePath("/vehiculo");
  revalidatePath("/vehiculo/ajustes");
}

export async function crearOActualizarVehiculo(vehiculoId: string | null, formData: FormData) {
  await requireVehiculoAdmin();

  const placa = String(formData.get("placa") ?? "").trim().toUpperCase();
  const marca = String(formData.get("marca") ?? "").trim() || null;
  const modelo = String(formData.get("modelo") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const soatStr = String(formData.get("soatVenceAt") ?? "").trim();
  const revisionStr = String(formData.get("revisionTecnicoMecanicaVenceAt") ?? "").trim();

  if (!placa) throw new Error("La placa es obligatoria.");

  const data = {
    placa,
    marca,
    modelo,
    color,
    soatVenceAt: soatStr ? dateOnlyToUTC(soatStr) : null,
    revisionTecnicoMecanicaVenceAt: revisionStr ? dateOnlyToUTC(revisionStr) : null,
  };

  if (vehiculoId) {
    await prisma.vehiculo.update({ where: { id: vehiculoId }, data });
  } else {
    const existing = await prisma.vehiculo.findUnique({ where: { placa } });
    if (existing) throw new Error("Ya existe un vehículo con esa placa.");
    await prisma.vehiculo.create({ data });
  }

  revalidateVehiculo();
}

export async function toggleVehiculoActivo(vehiculoId: string, activo: boolean) {
  await requireVehiculoAdmin();
  await prisma.vehiculo.update({ where: { id: vehiculoId }, data: { activo } });
  revalidateVehiculo();
}

export async function upsertVehiculoSettings(formData: FormData) {
  await requireVehiculoAdmin();

  const valorPorRuta = Number(formData.get("valorPorRuta"));
  const canonDiarioAlquiler = Number(formData.get("canonDiarioAlquiler"));

  if (!(valorPorRuta >= 0) || !(canonDiarioAlquiler >= 0)) {
    throw new Error("Los valores deben ser números válidos.");
  }

  await prisma.vehiculoSettings.upsert({
    where: { id: "singleton" },
    update: { valorPorRuta, canonDiarioAlquiler },
    create: { id: "singleton", valorPorRuta, canonDiarioAlquiler },
  });

  revalidateVehiculo();
}

/** Comenzar la ruta: solo el kilometraje de partida. Sin fotos, firmas ni checklists, y sin
 * armar la ruta — los pedidos que lleva los asigna el staff después, desde el detalle. */
export async function crearSalida(formData: FormData) {
  const vehiculoId = String(formData.get("vehiculoId") ?? "");
  const conductorId = String(formData.get("conductorId") ?? "");
  const { session, autoservicio } = await requireEntregaAccess(conductorId);

  const checkoutKm = Number(formData.get("checkoutKm"));
  const observacionesEntrega = String(formData.get("observacionesEntrega") ?? "").trim() || null;
  const rutaProgramadaId = String(formData.get("rutaProgramadaId") ?? "") || null;

  if (!vehiculoId) throw new Error("Selecciona el vehículo.");
  if (!conductorId) throw new Error("Selecciona el conductor.");
  if (!Number.isInteger(checkoutKm) || checkoutKm <= 0) throw new Error("Escribe el kilometraje de partida.");

  const salida = await prisma.$transaction(
    async (tx) => {
      const vehiculoActual = await tx.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
      if (vehiculoActual.salidaAbiertaId) throw new Error("Este vehículo ya tiene una salida abierta.");

      const nuevaSalida = await tx.vehiculoSalida.create({
        data: {
          vehiculoId,
          conductorId,
          tipoUso: "RUTA_EMPRESA",
          checkoutPorId: session.user.id,
          checkoutKm,
          observacionesEntrega: autoservicio
            ? [observacionesEntrega, "[Auto-registrado por el conductor, sin staff presente]"].filter(Boolean).join(" — ")
            : observacionesEntrega,
        },
      });

      await tx.vehiculo.update({ where: { id: vehiculoId }, data: { salidaAbiertaId: nuevaSalida.id } });

      // La ruta programada que se está "abriendo" ya cumplió su propósito de avisar.
      if (rutaProgramadaId) {
        await tx.vehiculoRutaProgramada.deleteMany({ where: { id: rutaProgramadaId, conductorId } });
      }

      return nuevaSalida;
    },
    { maxWait: 10000, timeout: 20000 }
  );

  revalidateVehiculo();
  return { id: salida.id };
}

/** Terminar la ruta: solo el kilometraje de llegada. */
export async function cerrarSalida(salidaId: string, formData: FormData) {
  const { session, salida: salidaActual, autoservicio } = await requireDevolucionAccess(salidaId);
  if (salidaActual.checkinAt) throw new Error("Esta salida ya fue cerrada.");

  const checkinKm = Number(formData.get("checkinKm"));
  const observacionesDevolucion = String(formData.get("observacionesDevolucion") ?? "").trim() || null;

  if (!Number.isInteger(checkinKm) || checkinKm <= 0) throw new Error("Escribe el kilometraje de llegada.");
  if (checkinKm < salidaActual.checkoutKm) {
    throw new Error(`El kilometraje de llegada no puede ser menor al de partida (${salidaActual.checkoutKm}).`);
  }

  await prisma.$transaction(
    async (tx) => {
      const salidaDentroTx = await tx.vehiculoSalida.findUniqueOrThrow({ where: { id: salidaId } });
      if (salidaDentroTx.checkinAt) throw new Error("Esta salida ya fue cerrada.");

      await tx.vehiculoSalida.update({
        where: { id: salidaId },
        data: {
          checkinAt: new Date(),
          checkinPorId: session.user.id,
          checkinKm,
          observacionesDevolucion: autoservicio
            ? [observacionesDevolucion, "[Auto-registrado por el conductor, sin staff presente]"].filter(Boolean).join(" — ")
            : observacionesDevolucion,
          lockedAt: new Date(),
        },
      });

      await tx.vehiculo.update({ where: { id: salidaDentroTx.vehiculoId }, data: { salidaAbiertaId: null } });
    },
    { maxWait: 10000, timeout: 20000 }
  );

  revalidateVehiculo();
  revalidatePath(`/vehiculo/${salidaId}`);
  return { id: salidaId };
}

/** Solo un admin puede agregar notas a una salida ya cerrada (el resto del registro
 * queda de solo lectura una vez bloqueado). */
export async function actualizarNotasAdminSalida(salidaId: string, formData: FormData) {
  await requireVehiculoAdmin();
  const notasAdmin = String(formData.get("notasAdmin") ?? "").trim() || null;
  await prisma.vehiculoSalida.update({ where: { id: salidaId }, data: { notasAdmin } });
  revalidatePath(`/vehiculo/${salidaId}`);
}

export async function registrarDanioFinanciero(salidaId: string, formData: FormData) {
  const session = await requireVehiculoAdmin();

  const valor = Number(formData.get("valor"));
  const concepto = String(formData.get("concepto") ?? "").trim();
  if (!(valor > 0)) throw new Error("El valor debe ser mayor a cero.");
  if (!concepto) throw new Error("Describe el concepto del daño o multa.");

  const salida = await prisma.vehiculoSalida.findUniqueOrThrow({ where: { id: salidaId } });
  await prisma.vehiculoDanioFinanciero.create({
    data: { salidaId, conductorId: salida.conductorId, valor, concepto, estado: "PENDIENTE", creadoPorId: session.user.id },
  });

  revalidatePath(`/vehiculo/${salidaId}`);
  revalidatePath("/vehiculo/resumen");
}

export async function actualizarEstadoDanio(danioId: string, estado: string) {
  await requireVehiculoAdmin();
  if (!["PENDIENTE", "DESCONTADO", "PAGADO"].includes(estado)) throw new Error("Estado inválido.");
  const danio = await prisma.vehiculoDanioFinanciero.update({ where: { id: danioId }, data: { estado } });
  revalidatePath(`/vehiculo/${danio.salidaId}`);
  revalidatePath("/vehiculo/resumen");
}
