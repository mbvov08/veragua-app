import { prisma } from "@/lib/prisma";
import type { Company } from "@/lib/finanzas/queries";

export type ProductStock = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string;
  categoriaNombre: string;
  precio: number;
  imagenUrl: string | null;
  activo: boolean;
  comparaConGalpon: boolean;
  unidadesGalpon: number;
  stock: number;
  grupo: string | null;
  nombreVariante: string | null;
  esServicio: boolean;
};

type Composicion = { productoId: string; componenteId: string; cantidad: number; desde: Date };

/** Cuánto de cada componente se ha usado armando productos compuestos (ej. Huevos Mixtos x30),
 * contando las ventas desde la fecha de vigencia de cada receta. */
async function consumoPorComposicion(composiciones: Composicion[]): Promise<Map<string, number>> {
  const consumo = new Map<string, number>();
  for (const c of composiciones) {
    const vendido = await prisma.finSaleItem.aggregate({
      where: { productoId: c.productoId, sale: { fecha: { gte: c.desde } } },
      _sum: { cantidad: true },
    });
    consumo.set(c.componenteId, (consumo.get(c.componenteId) ?? 0) + (vendido._sum.cantidad ?? 0) * c.cantidad);
  }
  return consumo;
}

/** Saldo teórico de cada producto: compras − ventas + ajustes de conteo. Los productos armados
 * con otros descuentan a sus componentes, y su stock es cuántos se pueden armar. */
export async function computeProductStocks(company: Company): Promise<ProductStock[]> {
  const productos = await prisma.finProduct.findMany({
    where: { company },
    include: { categoria: true },
    orderBy: { nombre: "asc" },
  });

  const [compras, ventas, ajustes] = await Promise.all([
    prisma.finPurchaseItem.groupBy({
      by: ["productoId"],
      _sum: { cantidad: true },
      where: { producto: { company }, purchase: { recibido: true } },
    }),
    prisma.finSaleItem.groupBy({
      by: ["productoId"],
      _sum: { cantidad: true },
      where: { producto: { company } },
    }),
    prisma.finInventoryAdjustment.groupBy({
      by: ["productoId"],
      _sum: { diferencia: true },
      where: { producto: { company } },
    }),
  ]);

  const composiciones = await prisma.finProductoComponente.findMany();
  const consumoMap = await consumoPorComposicion(composiciones);

  const compradoMap = new Map(compras.map((c) => [c.productoId, c._sum.cantidad ?? 0]));
  const vendidoMap = new Map(ventas.map((v) => [v.productoId, v._sum.cantidad ?? 0]));
  const ajusteMap = new Map(ajustes.map((a) => [a.productoId, a._sum.diferencia ?? 0]));

  const base = new Map(
    productos.map((p) => [
      p.id,
      (compradoMap.get(p.id) ?? 0) - (vendidoMap.get(p.id) ?? 0) + (ajusteMap.get(p.id) ?? 0) - (consumoMap.get(p.id) ?? 0),
    ])
  );
  const armables = new Map<string, number>();
  for (const c of composiciones) {
    const posibles = (base.get(c.componenteId) ?? 0) / c.cantidad;
    armables.set(c.productoId, Math.min(armables.get(c.productoId) ?? Infinity, posibles));
  }

  return productos.map((p) => {
    return {
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      categoriaId: p.categoriaId,
      categoriaNombre: p.categoria.nombre,
      precio: p.precio,
      imagenUrl: p.imagenUrl,
      activo: p.activo,
      comparaConGalpon: p.comparaConGalpon,
      unidadesGalpon: p.unidadesGalpon,
      // Un producto armado no puede tener stock negativo: si faltan cubetas de las que se arma, son 0.
      stock: armables.has(p.id) ? Math.max(0, Math.floor(armables.get(p.id)!)) : base.get(p.id) ?? 0,
      grupo: p.grupo,
      nombreVariante: p.nombreVariante,
      esServicio: p.esServicio,
    };
  });
}

export async function computeSingleProductStock(productoId: string): Promise<number> {
  const [propias, usadoEn] = await Promise.all([
    prisma.finProductoComponente.findMany({ where: { productoId } }),
    prisma.finProductoComponente.findMany({ where: { componenteId: productoId } }),
  ]);
  if (propias.length > 0) {
    // Producto armado: cuántos se pueden armar con el stock de sus componentes.
    const posibles = await Promise.all(propias.map(async (c) => (await computeSingleProductStock(c.componenteId)) / c.cantidad));
    return Math.max(0, Math.floor(Math.min(...posibles)));
  }
  const consumo = [...(await consumoPorComposicion(usadoEn)).values()].reduce((s, v) => s + v, 0);
  const [compra, venta, ajuste] = await Promise.all([
    prisma.finPurchaseItem.aggregate({ where: { productoId, purchase: { recibido: true } }, _sum: { cantidad: true } }),
    prisma.finSaleItem.aggregate({ where: { productoId }, _sum: { cantidad: true } }),
    prisma.finInventoryAdjustment.aggregate({ where: { productoId }, _sum: { diferencia: true } }),
  ]);
  return (compra._sum.cantidad ?? 0) - (venta._sum.cantidad ?? 0) + (ajuste._sum.diferencia ?? 0) - consumo;
}
