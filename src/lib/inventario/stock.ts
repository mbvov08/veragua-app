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

/** Saldo teórico de cada producto: compras − ventas + ajustes de conteo. */
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

  const compradoMap = new Map(compras.map((c) => [c.productoId, c._sum.cantidad ?? 0]));
  const vendidoMap = new Map(ventas.map((v) => [v.productoId, v._sum.cantidad ?? 0]));
  const ajusteMap = new Map(ajustes.map((a) => [a.productoId, a._sum.diferencia ?? 0]));

  return productos.map((p) => {
    const comprado = compradoMap.get(p.id) ?? 0;
    const vendido = vendidoMap.get(p.id) ?? 0;
    const ajuste = ajusteMap.get(p.id) ?? 0;
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
      stock: comprado - vendido + ajuste,
      grupo: p.grupo,
      nombreVariante: p.nombreVariante,
      esServicio: p.esServicio,
    };
  });
}

export async function computeSingleProductStock(productoId: string): Promise<number> {
  const [compra, venta, ajuste] = await Promise.all([
    prisma.finPurchaseItem.aggregate({ where: { productoId, purchase: { recibido: true } }, _sum: { cantidad: true } }),
    prisma.finSaleItem.aggregate({ where: { productoId }, _sum: { cantidad: true } }),
    prisma.finInventoryAdjustment.aggregate({ where: { productoId }, _sum: { diferencia: true } }),
  ]);
  return (compra._sum.cantidad ?? 0) - (venta._sum.cantidad ?? 0) + (ajuste._sum.diferencia ?? 0);
}
