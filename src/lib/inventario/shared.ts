import { prisma } from "@/lib/prisma";
import { COMPANIES, type Company } from "@/lib/finanzas/queries";

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
