import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { COMPANIES, type Company } from "@/lib/finanzas/queries";
import { formatCOP } from "@/lib/finanzas/format";

/** Categoría NIIF por defecto para los movimientos generados desde Inventario. */
export async function findDefaultCategory(company: Company, codigo: string) {
  const categoria = await prisma.finCategory.findFirst({
    where: { codigo, OR: [{ company }, { company: null }] },
  });
  if (!categoria) {
    throw new Error(`No existe la categoría ${codigo}. Créala primero en Finanzas › Categorías.`);
  }
  return categoria;
}

// Bold cobra 3.29% + $300 fijo por cada venta pagada con tarjeta (confirmado por
// Daniela). Falta el % de ReteICA que también aplica — cuando se tenga, se suma aquí.
const BOLD_COMISION_PORCENTAJE = 0.0329;
const BOLD_COMISION_FIJA = 300;

/** Registra automáticamente el gasto de comisión de Bold cuando una venta se paga con tarjeta. */
export async function registrarComisionBoldSiAplica(
  tx: Prisma.TransactionClient,
  opts: { company: Company; fecha: Date; metodoPago: string | null; montoVenta: number; canalId: string | null; creadoPorId: string }
) {
  if (opts.metodoPago !== "Tarjeta" || opts.montoVenta <= 0) return;

  const comision = Math.round(opts.montoVenta * BOLD_COMISION_PORCENTAJE) + BOLD_COMISION_FIJA;
  const categoria = await findDefaultCategory(opts.company, "5230");

  await tx.finTransaction.create({
    data: {
      company: opts.company,
      tipo: "expense",
      fecha: opts.fecha,
      monto: comision,
      categoriaId: categoria.id,
      canalId: opts.canalId,
      metodoPago: "Tarjeta",
      descripcion: `Comisión Bold (3.29% + $300) sobre venta de ${formatCOP(opts.montoVenta)}`,
      fuente: "manual",
      creadoPorId: opts.creadoPorId,
    },
  });
}

export function parseCompany(value: FormDataEntryValue | null): Company {
  const v = String(value ?? "");
  if (!COMPANIES.includes(v as Company)) throw new Error("Selecciona una empresa válida.");
  return v as Company;
}

/** Motivos de ajuste manual de inventario (conteo físico / corrección). */
export const MOTIVOS_AJUSTE_INVENTARIO = [
  "Conteo físico / corrección",
  "Producto dañado o vencido",
  "Pérdida o robo",
  "Cortesía / consumo interno",
  "Otro",
] as const;

export type SaleItemInput = { productoId: string; cantidad: number; precioUnitario: number };
export type PurchaseItemInput = { productoId: string; cantidad: number; costoUnitario: number };

export function parseSaleItems(formData: FormData): SaleItemInput[] {
  const raw = String(formData.get("itemsJson") ?? "[]");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it) => it && typeof it.productoId === "string" && it.productoId)
      .map((it) => ({
        productoId: it.productoId,
        cantidad: Number(it.cantidad) || 0,
        precioUnitario: Number(it.precioUnitario) || 0,
      }))
      .filter((it) => it.cantidad > 0);
  } catch {
    return [];
  }
}

export function parsePurchaseItems(formData: FormData): PurchaseItemInput[] {
  const raw = String(formData.get("itemsJson") ?? "[]");
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it) => it && typeof it.productoId === "string" && it.productoId)
      .map((it) => ({
        productoId: it.productoId,
        cantidad: Number(it.cantidad) || 0,
        costoUnitario: Number(it.costoUnitario) || 0,
      }))
      .filter((it) => it.cantidad > 0);
  } catch {
    return [];
  }
}
