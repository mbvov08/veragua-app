"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { requireVehiculoAdmin, requireVehiculoStaff } from "@/lib/vehiculo/access";
import { putPrivateVehiculoBlob } from "@/lib/vehiculo/blob";
import { ANGULOS, PUNTOS_EVALUACION, EQUIPAMIENTO_ITEMS, NOVEDAD_TIPOS } from "@/lib/vehiculo/constants";
import {
  validarActaEntrega,
  validarActaDevolucion,
  type FotoDraft,
  type EvaluacionDraft,
  type EquipoDraft,
  type NovedadDraft,
} from "@/lib/vehiculo/validacion";

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

export async function crearSalida(formData: FormData) {
  const session = await requireVehiculoStaff();

  const vehiculoId = String(formData.get("vehiculoId") ?? "");
  const conductorId = String(formData.get("conductorId") ?? "");
  const tipoUso = String(formData.get("tipoUso") ?? "");
  const zona = String(formData.get("zona") ?? "") || null;
  const destino = String(formData.get("destino") ?? "").trim() || null;
  const checkoutKm = Number(formData.get("checkoutKm"));
  const checkoutCombustible = String(formData.get("checkoutCombustible") ?? "");
  const observacionesEntrega = String(formData.get("observacionesEntrega") ?? "").trim() || null;
  const evaluaciones = JSON.parse(String(formData.get("evaluacionesJson") ?? "[]")) as EvaluacionDraft[];
  const equipamiento = JSON.parse(String(formData.get("equipamientoJson") ?? "[]")) as EquipoDraft[];
  const firmaConductorFile = formData.get("firmaConductor") as File | null;
  const firmaRepFile = formData.get("firmaRep") as File | null;

  const fotos: FotoDraft[] = ANGULOS.map((a) => {
    const file = formData.get(`foto__${a.value}`) as File | null;
    return { angulo: a.value, blob: file && file.size > 0 ? file : null };
  });

  const faltas = validarActaEntrega({
    vehiculoId,
    conductorId,
    tipoUso,
    zona: zona ?? "",
    checkoutKm: String(checkoutKm || ""),
    checkoutCombustible,
    fotos,
    evaluaciones,
    equipamiento,
    firmaConductorVacia: !firmaConductorFile || firmaConductorFile.size === 0,
    firmaRepVacia: !firmaRepFile || firmaRepFile.size === 0,
  });
  if (faltas.length > 0) throw new Error("Falta completar: " + faltas.join("; "));

  const vehiculo = await prisma.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
  if (vehiculo.salidaAbiertaId) throw new Error("Este vehículo ya tiene una salida abierta.");

  // Cada línea de "Ruta / paradas" se vuelve un ítem de checklist marcable — así el
  // conductor ve la ruta compleja (ej. dejar/recoger en paradas intermedias que no son
  // pedidos de cliente) como algo que puede ir tachando, no solo como texto suelto.
  const lineasParadas = (destino ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

  // Las subidas a Blob son lentas (red) — se hacen fuera de la transacción de BD para
  // no dejarla abierta esperando. Si algo falla después, los archivos quedan
  // huérfanos (sin salidaId) pero no hay inconsistencia visible para el usuario.
  const archivoIds: Record<string, string> = {};
  for (const f of fotos) {
    const blob = await putPrivateVehiculoBlob(`vehiculo/${crypto.randomUUID()}-${f.angulo}.jpg`, f.blob!);
    const archivo = await prisma.vehiculoArchivo.create({
      data: { blobPathname: blob.pathname, contentType: blob.contentType, subidoPorId: session.user.id },
    });
    archivoIds[`foto_${f.angulo}`] = archivo.id;
  }
  const blobFirmaConductor = await putPrivateVehiculoBlob(`vehiculo/${crypto.randomUUID()}-firma-conductor.png`, firmaConductorFile!);
  const archivoFirmaConductor = await prisma.vehiculoArchivo.create({
    data: { blobPathname: blobFirmaConductor.pathname, contentType: blobFirmaConductor.contentType, subidoPorId: session.user.id },
  });
  const blobFirmaRep = await putPrivateVehiculoBlob(`vehiculo/${crypto.randomUUID()}-firma-rep.png`, firmaRepFile!);
  const archivoFirmaRep = await prisma.vehiculoArchivo.create({
    data: { blobPathname: blobFirmaRep.pathname, contentType: blobFirmaRep.contentType, subidoPorId: session.user.id },
  });

  const salida = await prisma.$transaction(
    async (tx) => {
      const vehiculoActual = await tx.vehiculo.findUniqueOrThrow({ where: { id: vehiculoId } });
      if (vehiculoActual.salidaAbiertaId) throw new Error("Este vehículo ya tiene una salida abierta.");

      const nuevaSalida = await tx.vehiculoSalida.create({
        data: {
          vehiculoId,
          conductorId,
          tipoUso,
          zona,
          destino,
          checkoutPorId: session.user.id,
          checkoutKm,
          checkoutCombustible,
          observacionesEntrega,
          firmaConductorEntregaId: archivoFirmaConductor.id,
          firmaRepEntregaId: archivoFirmaRep.id,
          fotos: {
            create: ANGULOS.map((a) => ({
              momento: "ENTREGA",
              angulo: a.value,
              archivoId: archivoIds[`foto_${a.value}`],
            })),
          },
          evaluaciones: {
            create: PUNTOS_EVALUACION.map((p) => {
              const ev = evaluaciones.find((e) => e.punto === p.value)!;
              return { momento: "ENTREGA", punto: p.value, estado: ev.estado, nota: ev.nota.trim() || null };
            }),
          },
          paradas: {
            create: lineasParadas.map((titulo, i) => ({ orden: i, titulo })),
          },
          equipamiento: {
            create: EQUIPAMIENTO_ITEMS.map((it) => {
              const eq = equipamiento.find((e) => e.item === it.value)!;
              return { momento: "ENTREGA", item: it.value, presente: Boolean(eq.presente) };
            }),
          },
        },
      });

      await tx.vehiculoArchivo.updateMany({
        where: { id: { in: [...Object.values(archivoIds), archivoFirmaConductor.id, archivoFirmaRep.id] } },
        data: { salidaId: nuevaSalida.id },
      });

      await tx.vehiculo.update({ where: { id: vehiculoId }, data: { salidaAbiertaId: nuevaSalida.id } });

      return nuevaSalida;
    },
    { maxWait: 10000, timeout: 20000 }
  );

  revalidateVehiculo();
  return { id: salida.id };
}

export async function cerrarSalida(salidaId: string, formData: FormData) {
  const session = await requireVehiculoStaff();

  const salidaActual = await prisma.vehiculoSalida.findUniqueOrThrow({ where: { id: salidaId } });
  if (salidaActual.checkinAt) throw new Error("Esta salida ya fue cerrada.");

  const checkinKm = Number(formData.get("checkinKm"));
  const checkinCombustible = String(formData.get("checkinCombustible") ?? "");
  const observacionesDevolucion = String(formData.get("observacionesDevolucion") ?? "").trim() || null;
  const evaluaciones = JSON.parse(String(formData.get("evaluacionesJson") ?? "[]")) as EvaluacionDraft[];
  const equipamiento = JSON.parse(String(formData.get("equipamientoJson") ?? "[]")) as EquipoDraft[];
  const novedades = JSON.parse(String(formData.get("novedadesJson") ?? "[]")) as NovedadDraft[];
  const firmaConductorFile = formData.get("firmaConductor") as File | null;
  const firmaRepFile = formData.get("firmaRep") as File | null;

  const fotos: FotoDraft[] = ANGULOS.map((a) => {
    const file = formData.get(`foto__${a.value}`) as File | null;
    return { angulo: a.value, blob: file && file.size > 0 ? file : null };
  });

  const faltas = validarActaDevolucion(
    {
      checkinKm: String(checkinKm || ""),
      checkinCombustible,
      fotos,
      evaluaciones,
      equipamiento,
      novedades,
      firmaConductorVacia: !firmaConductorFile || firmaConductorFile.size === 0,
      firmaRepVacia: !firmaRepFile || firmaRepFile.size === 0,
    },
    salidaActual.checkoutKm
  );
  if (faltas.length > 0) throw new Error("Falta completar: " + faltas.join("; "));

  const archivoIds: Record<string, string> = {};
  for (const f of fotos) {
    const blob = await putPrivateVehiculoBlob(`vehiculo/${crypto.randomUUID()}-${f.angulo}.jpg`, f.blob!);
    const archivo = await prisma.vehiculoArchivo.create({
      data: { blobPathname: blob.pathname, contentType: blob.contentType, subidoPorId: session.user.id, salidaId },
    });
    archivoIds[`foto_${f.angulo}`] = archivo.id;
  }
  const blobFirmaConductor = await putPrivateVehiculoBlob(`vehiculo/${crypto.randomUUID()}-firma-conductor-dev.png`, firmaConductorFile!);
  const archivoFirmaConductor = await prisma.vehiculoArchivo.create({
    data: { blobPathname: blobFirmaConductor.pathname, contentType: blobFirmaConductor.contentType, subidoPorId: session.user.id, salidaId },
  });
  const blobFirmaRep = await putPrivateVehiculoBlob(`vehiculo/${crypto.randomUUID()}-firma-rep-dev.png`, firmaRepFile!);
  const archivoFirmaRep = await prisma.vehiculoArchivo.create({
    data: { blobPathname: blobFirmaRep.pathname, contentType: blobFirmaRep.contentType, subidoPorId: session.user.id, salidaId },
  });

  await prisma.$transaction(
    async (tx) => {
      const salidaDentroTx = await tx.vehiculoSalida.findUniqueOrThrow({ where: { id: salidaId } });
      if (salidaDentroTx.checkinAt) throw new Error("Esta salida ya fue cerrada.");
      if (checkinKm < salidaDentroTx.checkoutKm) {
        throw new Error(`El kilometraje de devolución no puede ser menor al de entrega (${salidaDentroTx.checkoutKm}).`);
      }

      await tx.vehiculoSalida.update({
        where: { id: salidaId },
        data: {
          checkinAt: new Date(),
          checkinPorId: session.user.id,
          checkinKm,
          checkinCombustible,
          observacionesDevolucion,
          firmaConductorDevolucionId: archivoFirmaConductor.id,
          firmaRepDevolucionId: archivoFirmaRep.id,
          lockedAt: new Date(),
          fotos: {
            create: ANGULOS.map((a) => ({
              momento: "DEVOLUCION",
              angulo: a.value,
              archivoId: archivoIds[`foto_${a.value}`],
            })),
          },
          evaluaciones: {
            create: PUNTOS_EVALUACION.map((p) => {
              const ev = evaluaciones.find((e) => e.punto === p.value)!;
              return { momento: "DEVOLUCION", punto: p.value, estado: ev.estado, nota: ev.nota.trim() || null };
            }),
          },
          equipamiento: {
            create: EQUIPAMIENTO_ITEMS.map((it) => {
              const eq = equipamiento.find((e) => e.item === it.value)!;
              return { momento: "DEVOLUCION", item: it.value, presente: Boolean(eq.presente) };
            }),
          },
          novedades: {
            create: NOVEDAD_TIPOS.map((n) => {
              const nov = novedades.find((x) => x.tipo === n.value)!;
              return { tipo: n.value, marcado: Boolean(nov.marcado), detalle: nov.detalle.trim() || null };
            }),
          },
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
