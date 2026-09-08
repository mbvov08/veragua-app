import { prisma } from "@/lib/prisma";

export type IngredienteStock = {
  id: string;
  nombre: string;
  unidad: string;
  cantidadPorMezcla: number;
  stock: number;
};

/** Saldo teórico de cada ingrediente: compras − (mezclas totales × receta) + ajustes de conteo. */
export async function computeStocks(): Promise<IngredienteStock[]> {
  const ingredientes = await prisma.melcochIngrediente.findMany({ orderBy: { nombre: "asc" } });

  const [compras, produccion, ajustes] = await Promise.all([
    prisma.melcochCompraIngrediente.groupBy({ by: ["ingredienteId"], _sum: { cantidad: true } }),
    prisma.melcochProduccionDiaria.aggregate({ _sum: { mezclas: true } }),
    prisma.melcochAjusteInventario.groupBy({ by: ["ingredienteId"], _sum: { diferencia: true } }),
  ]);

  const comprasMap = new Map(compras.map((c) => [c.ingredienteId, c._sum.cantidad ?? 0]));
  const ajustesMap = new Map(ajustes.map((a) => [a.ingredienteId, a._sum.diferencia ?? 0]));
  const totalMezclas = produccion._sum.mezclas ?? 0;

  return ingredientes.map((ing) => {
    const comprado = comprasMap.get(ing.id) ?? 0;
    const consumido = totalMezclas * ing.cantidadPorMezcla;
    const ajuste = ajustesMap.get(ing.id) ?? 0;
    return {
      id: ing.id,
      nombre: ing.nombre,
      unidad: ing.unidad,
      cantidadPorMezcla: ing.cantidadPorMezcla,
      stock: comprado - consumido + ajuste,
    };
  });
}
