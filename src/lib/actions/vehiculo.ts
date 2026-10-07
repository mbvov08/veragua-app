"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { requireVehiculoAdmin, requireVehiculoStaff } from "@/lib/vehiculo/access";
import { putPrivateVehiculoBlob } from "@/lib/vehiculo/blob";
import { ANGULOS, PUNTOS_EVALUACION, EQUIPAMIENTO_ITEMS } from "@/lib/vehiculo/constants";
import { validarActaEntrega, type FotoDraft, type EvaluacionDraft, type EquipoDraft } from "@/lib/vehiculo/validacion";

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
