import type { PrismaClient } from "@prisma/client";

/** Costos directos del local: arrendamiento, servicios públicos y aseo y limpieza. */
export const CATEGORIAS_COSTO_LOCAL = ["5205", "5210", "5240"];

type Db = Pick<PrismaClient, "finCategory" | "finChannel">;

/** Si la categoría es un costo directo del local, devuelve el canal "Ventas del local" de esa
 * empresa, para que el gasto cuente en el margen del canal y no como gasto compartido. */
export async function canalDelLocalSiAplica(db: Db, company: string, categoriaId: string): Promise<string | null> {
  const categoria = await db.finCategory.findUnique({ where: { id: categoriaId }, select: { codigo: true } });
  if (!categoria || !CATEGORIAS_COSTO_LOCAL.includes(categoria.codigo)) return null;
  const canal = await db.finChannel.findFirst({ where: { company, nombre: "Ventas del local" }, select: { id: true } });
  return canal?.id ?? null;
}
