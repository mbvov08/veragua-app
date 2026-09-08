"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, todayColombia } from "@/lib/date";
import { computeStocks } from "@/lib/melcoch";

function requireMelcochAccess(role: string) {
  if (role !== "ADMIN" && role !== "EMPLEADA") throw new Error("No autorizado.");
}

export async function registrarProduccionMelcoch(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  requireMelcochAccess(session.user.role);

  const fechaStr = String(formData.get("fecha") ?? "");
  const mezclas = Number(formData.get("mezclas"));
  const cajasNormales = Number(formData.get("cajasNormales") ?? 0);
  const cajasFamiliares = Number(formData.get("cajasFamiliares") ?? 0);
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  if (!fechaStr || !mezclas || mezclas <= 0) {
    throw new Error("Completa la fecha y las mezclas producidas.");
  }

  const fecha = dateOnlyToUTC(fechaStr);
  await prisma.melcochProduccionDiaria.upsert({
    where: { fecha },
    update: { mezclas, cajasNormales, cajasFamiliares, observaciones },
    create: {
      fecha,
      mezclas,
      cajasNormales,
      cajasFamiliares,
      observaciones,
      creadoPorId: session.user.id,
    },
  });

  revalidatePath("/melcoch");
}

export async function registrarCompraIngrediente(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado");
  requireMelcochAccess(session.user.role);

  const ingredienteId = String(formData.get("ingredienteId") ?? "");
  const cantidad = Number(formData.get("cantidad"));
  const fechaStr = String(formData.get("fecha") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  if (!ingredienteId || !cantidad || cantidad <= 0 || !fechaStr) {
    throw new Error("Completa el ingrediente, la cantidad y la fecha.");
  }

  await prisma.melcochCompraIngrediente.create({
    data: {
      ingredienteId,
      cantidad,
      fecha: dateOnlyToUTC(fechaStr),
      observaciones,
      creadoPorId: session.user.id,
    },
  });

  revalidatePath("/melcoch");
}

export async function realizarConteoFisico(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Solo la administradora puede hacer el conteo físico.");
  }

  const fechaStr = String(formData.get("fecha") ?? "");
  const fecha = fechaStr ? dateOnlyToUTC(fechaStr) : todayColombia();
  const stocks = await computeStocks();

  for (const ing of stocks) {
    const raw = formData.get(`conteo_${ing.id}`);
    if (raw === null || String(raw).trim() === "") continue;
    const contado = Number(raw);
    if (Number.isNaN(contado)) continue;

    await prisma.melcochAjusteInventario.create({
      data: {
        ingredienteId: ing.id,
        teoricoAntes: ing.stock,
        contado,
        diferencia: contado - ing.stock,
        fecha,
        creadoPorId: session.user.id,
      },
    });
  }

  revalidatePath("/melcoch");
}
