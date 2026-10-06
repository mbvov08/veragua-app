"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, todayColombia } from "@/lib/date";
import { requireFinanzas } from "@/lib/actions/finanzas";

async function getBaseInicial() {
  const settings = await prisma.cajaSettings.findUnique({ where: { id: "singleton" } });
  return settings?.baseInicial ?? 0;
}

export interface SaldoEsperadoCaja {
  desde: Date;
  esPrimerCierre: boolean;
  saldoAnterior: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  saldoEsperado: number;
}

/** Calcula en vivo cuánto efectivo debería haber en la caja ahora mismo: el saldo contado
 * del último cierre (o la base inicial si nunca se ha cerrado) más las ventas en efectivo
 * menos los gastos pagados en efectivo desde entonces. */
export async function getSaldoEsperadoCaja(): Promise<SaldoEsperadoCaja> {
  const ultimo = await prisma.cajaCierre.findFirst({ orderBy: { fecha: "desc" } });
  const saldoAnterior = ultimo ? ultimo.saldoContado : await getBaseInicial();
  // Sin cierre previo no tiene sentido sumar efectivo "desde siempre" (arrastraría años de
  // movimientos históricos que ya no están físicamente en la caja) — se asume que la base
  // inicial representa lo que hay hoy, y solo se suman los movimientos de HOY en adelante.
  const desde = ultimo?.fecha ?? new Date(todayColombia().getTime() - 1);

  // Sin filtro de company: Veragua y Melcoch comparten la misma caja física en el local,
  // así que un gasto en efectivo de cualquiera de las dos sale del mismo efectivo contado.
  const tx = await prisma.finTransaction.findMany({
    where: {
      anulado: false,
      metodoPago: "Efectivo",
      fecha: { gt: desde },
    },
    select: { tipo: true, monto: true },
  });
  const ingresosEfectivo = tx.filter((t) => t.tipo === "income").reduce((s, t) => s + t.monto, 0);
  const egresosEfectivo = tx.filter((t) => t.tipo === "expense").reduce((s, t) => s + t.monto, 0);

  return {
    desde,
    esPrimerCierre: !ultimo,
    saldoAnterior,
    ingresosEfectivo,
    egresosEfectivo,
    saldoEsperado: saldoAnterior + ingresosEfectivo - egresosEfectivo,
  };
}

export async function registrarCierreCaja(formData: FormData) {
  const session = await requireFinanzas();

  const fechaStr = String(formData.get("fecha") ?? "");
  const saldoContado = Number(formData.get("saldoContado"));
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

  if (!fechaStr) throw new Error("La fecha es obligatoria.");
  if (Number.isNaN(saldoContado) || saldoContado < 0) throw new Error("El saldo contado es inválido.");

  const esperado = await getSaldoEsperadoCaja();

  await prisma.cajaCierre.create({
    data: {
      fecha: dateOnlyToUTC(fechaStr),
      desde: esperado.desde,
      saldoAnterior: esperado.saldoAnterior,
      ingresosEfectivo: esperado.ingresosEfectivo,
      egresosEfectivo: esperado.egresosEfectivo,
      saldoEsperado: esperado.saldoEsperado,
      saldoContado,
      diferencia: saldoContado - esperado.saldoEsperado,
      observaciones,
      creadoPorId: session.user.id,
    },
  });

  revalidatePath("/finanzas/caja");
}

export async function actualizarBaseInicial(formData: FormData) {
  const session = await requireFinanzas();
  if (session.user.role !== "ADMIN") throw new Error("Solo la administradora puede cambiar la base inicial.");

  const baseInicial = Number(formData.get("baseInicial"));
  if (Number.isNaN(baseInicial) || baseInicial < 0) throw new Error("La base inicial es inválida.");

  const yaHayCierres = (await prisma.cajaCierre.count()) > 0;
  if (yaHayCierres) {
    throw new Error("Ya hay cierres registrados — la base inicial solo se puede fijar antes del primer cierre.");
  }

  await prisma.cajaSettings.upsert({
    where: { id: "singleton" },
    update: { baseInicial },
    create: { id: "singleton", baseInicial },
  });

  revalidatePath("/finanzas/caja");
}
