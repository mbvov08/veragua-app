import { prisma } from "@/lib/prisma";
import { todayColombia } from "@/lib/date";
import { computeReabastecimientoBulk } from "@/lib/inventario/reabastecimiento";
import type { Company } from "@/lib/finanzas/queries";

const TITULO_ALERTA = "📦 Reabastecimiento";
const COMPANIES: Company[] = ["VERAGUA", "MELCOCH"];

async function getOrCreateReglaSistema() {
  const existente = await prisma.reminderRule.findFirst({ where: { titulo: TITULO_ALERTA, esUnico: true } });
  if (existente) return existente;

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!admin) return null;

  return prisma.reminderRule.create({
    data: { titulo: TITULO_ALERTA, diaSemana: 0, esUnico: true, creadoPorId: admin.id },
  });
}

async function productosParaPedirYa(company: Company): Promise<string[]> {
  const relaciones = await prisma.finProductoProveedor.findMany({
    where: { producto: { company }, activo: true },
    include: { producto: true, proveedor: true },
  });
  if (relaciones.length === 0) return [];

  const productosConRelacion = new Map(relaciones.map((r) => [r.productoId, r.producto]));
  const { sugerenciasPorProducto } = await computeReabastecimientoBulk(
    company,
    [...productosConRelacion.values()],
    relaciones.map((r) => ({
      id: r.id,
      productoId: r.productoId,
      proveedorId: r.proveedorId,
      proveedorNombre: r.proveedor.nombre,
      leadTimeDias: r.leadTimeDias,
      diasRevision: r.diasRevision,
      costoUnitarioReferencia: r.costoUnitarioReferencia,
    }))
  );

  const nombres: string[] = [];
  for (const [productoId, sugerencias] of sugerenciasPorProducto) {
    if (sugerencias.some((s) => s.pedirYa)) nombres.push(productosConRelacion.get(productoId)!.nombre);
  }
  return nombres;
}

/**
 * Genera (si falta) la notificación de hoy sobre qué productos ya tocan pedir. Se
 * calcula una sola vez por día (idempotente, vía el índice único reminderRuleId+fecha):
 * si no hay nada que avisar, igual se crea la instancia con mensajeOverride="" para no
 * tener que recalcular en cada carga de página el resto del día.
 */
export async function ensureReabastecimientoAlertaGenerada() {
  const hoy = todayColombia();
  const regla = await getOrCreateReglaSistema();
  if (!regla) return;

  const yaExiste = await prisma.reminderInstance.findUnique({
    where: { reminderRuleId_fecha: { reminderRuleId: regla.id, fecha: hoy } },
  });
  if (yaExiste) return;

  let nombres: string[] = [];
  try {
    const porCompany = await Promise.all(COMPANIES.map((c) => productosParaPedirYa(c)));
    nombres = porCompany.flat();
  } catch (e) {
    console.error("[reabastecimiento-alertas] error calculando pedirYa:", e);
    return;
  }

  const mensajeOverride = nombres.length > 0 ? `Toca pedir ya: ${nombres.join(", ")}.` : "";

  try {
    await prisma.reminderInstance.create({ data: { reminderRuleId: regla.id, fecha: hoy, mensajeOverride } });
  } catch (e) {
    // Carrera entre dos requests simultáneos generando la misma instancia el mismo
    // día: el índice único la rechaza en el segundo, no pasa nada.
    console.error("[reabastecimiento-alertas] error creando instancia (puede ser carrera benigna):", e);
  }
}
