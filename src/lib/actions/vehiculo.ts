"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC } from "@/lib/date";
import { requireVehiculoAdmin } from "@/lib/vehiculo/access";

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
