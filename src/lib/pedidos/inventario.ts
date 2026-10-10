import { prisma } from "@/lib/prisma";
import { computeSingleProductStock } from "@/lib/inventario/stock";

/** Ignora tildes, mayúsculas y espacios repetidos — el catálogo de Pedidos (Producto) y
 * el de Inventario (FinProduct) son listas separadas que comparten los mismos nombres. */
export function normalizarNombre(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** OrderItem.cantidad es texto libre ("2", "1 cubeta", "1,5"): se toma el primer número;
 * si no hay cantidad escrita se asume 1. */
export function parseCantidadPedido(texto: string | null): number {
  if (!texto) return 1;
  const m = texto.replace(",", ".").match(/\d+(\.\d+)?/);
  const n = m ? Number(m[0]) : NaN;
  return n > 0 ? n : 1;
}

export type ItemPedido = { cantidad: string | null; producto: { nombre: string } };
export type ItemResuelto = { finProductId: string; nombre: string; company: string; precio: number; cantidad: number };

/** El "Domicilio" es un cobro de servicio, no un producto con stock. */
const NOMBRES_SIN_STOCK = new Set(["domicilio"]);

type CatalogoStock = Map<string, { id: string; nombre: string; company: string; precio: number }>;

async function cargarCatalogoStock(): Promise<CatalogoStock> {
  const finProducts = await prisma.finProduct.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, company: true, precio: true },
  });
  return new Map(finProducts.map((p) => [normalizarNombre(p.nombre), p]));
}

function resolverConCatalogo(items: ItemPedido[], porNombre: CatalogoStock): { resueltos: ItemResuelto[]; sinMatch: string[] } {
  const acumulado = new Map<string, ItemResuelto>();
  const sinMatch: string[] = [];
  for (const it of items) {
    const clave = normalizarNombre(it.producto.nombre);
    if (NOMBRES_SIN_STOCK.has(clave)) continue;
    const fp = porNombre.get(clave);
    if (!fp) {
      sinMatch.push(it.producto.nombre);
      continue;
    }
    const cantidad = parseCantidadPedido(it.cantidad);
    const previo = acumulado.get(fp.id);
    if (previo) previo.cantidad += cantidad;
    else acumulado.set(fp.id, { finProductId: fp.id, nombre: fp.nombre, company: fp.company, precio: fp.precio, cantidad });
  }
  return { resueltos: [...acumulado.values()], sinMatch };
}

export async function resolverItemsPedido(items: ItemPedido[]): Promise<{ resueltos: ItemResuelto[]; sinMatch: string[] }> {
  return resolverConCatalogo(items, await cargarCatalogoStock());
}

export type InfoVentaPedido = {
  suscripcion: boolean;
  empresas: { company: string; yaVendida: boolean }[];
};

/** Para pintar, en la lista de Pedidos, qué acción le corresponde a cada pedido: botón
 * "Crear venta" por empresa (si todavía no la tiene) o la marca de suscripción. */
export async function infoVentaPedidos(
  orders: { id: string; recurringRuleId: string | null; entregaTercero: string | null; items: ItemPedido[] }[]
): Promise<Map<string, InfoVentaPedido>> {
  const ids = orders.map((o) => o.id);
  const ruleIds = [...new Set(orders.map((o) => o.recurringRuleId).filter((r): r is string => !!r))];
  const [catalogo, suscripciones, ventas] = await Promise.all([
    cargarCatalogoStock(),
    ruleIds.length ? prisma.suscripcion.findMany({ where: { recurringRuleId: { in: ruleIds } }, select: { recurringRuleId: true } }) : [],
    ids.length ? prisma.finSale.findMany({ where: { pedidoId: { in: ids } }, select: { pedidoId: true, company: true } }) : [],
  ]);
  const reglasSuscripcion = new Set(suscripciones.map((s) => s.recurringRuleId));

  const info = new Map<string, InfoVentaPedido>();
  for (const o of orders) {
    if (o.entregaTercero) continue;
    const suscripcion = !!o.recurringRuleId && reglasSuscripcion.has(o.recurringRuleId);
    const { resueltos } = resolverConCatalogo(o.items, catalogo);
    const empresas = [...new Set(resueltos.map((r) => r.company))].map((company) => ({
      company,
      yaVendida: ventas.some((v) => v.pedidoId === o.id && v.company === company),
    }));
    info.set(o.id, { suscripcion, empresas });
  }
  return info;
}

export async function esPedidoDeSuscripcion(recurringRuleId: string | null): Promise<boolean> {
  if (!recurringRuleId) return false;
  return (await prisma.suscripcion.count({ where: { recurringRuleId } })) > 0;
}

/** Los pedidos de una suscripción ya se cobraron por adelantado (ingreso registrado al
 * pagar), así que al entregarse solo hay que descontar el stock — sin crear otra venta
 * que duplicaría el ingreso. Se hace con ajustes de inventario ligados al pedido, para
 * poder revertirlos si se desmarca como entregado. Pedidos normales no pasan por aquí:
 * descuentan stock al crear su venta con el botón "Crear venta". */
export async function sincronizarInventarioPorEntrega(orderId: string, entregado: boolean, userId: string) {
  await prisma.finInventoryAdjustment.deleteMany({ where: { pedidoId: orderId } });
  if (!entregado) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { producto: true } } },
  });
  if (!order || order.entregaTercero) return; // lo entrega un tercero: no sale de nuestro inventario
  if (!(await esPedidoDeSuscripcion(order.recurringRuleId))) return;

  const { resueltos } = await resolverItemsPedido(order.items);
  const recetas = await prisma.finProductoComponente.findMany({ where: { productoId: { in: resueltos.map((r) => r.finProductId) } } });
  // Un producto armado (ej. Huevos Mixtos x30) descuenta de sus componentes, no de sí mismo.
  const descuentos = new Map<string, { cantidad: number; origen: string }>();
  for (const it of resueltos) {
    const receta = recetas.filter((r) => r.productoId === it.finProductId);
    if (receta.length === 0) {
      const previo = descuentos.get(it.finProductId);
      descuentos.set(it.finProductId, { cantidad: (previo?.cantidad ?? 0) + it.cantidad, origen: it.nombre });
      continue;
    }
    for (const r of receta) {
      if (order.fechaEntrega < r.desde) continue;
      const previo = descuentos.get(r.componenteId);
      descuentos.set(r.componenteId, { cantidad: (previo?.cantidad ?? 0) + it.cantidad * r.cantidad, origen: it.nombre });
    }
  }
  for (const [productoId, d] of descuentos) {
    const teoricoAntes = await computeSingleProductStock(productoId);
    await prisma.finInventoryAdjustment.create({
      data: {
        productoId,
        teoricoAntes,
        contado: teoricoAntes - d.cantidad,
        diferencia: -d.cantidad,
        motivo: `Entrega de suscripción — ${order.cliente}${recetas.length ? ` (${d.origen})` : ""}`,
        fecha: order.fechaEntrega,
        pedidoId: orderId,
        creadoPorId: userId,
      },
    });
  }
}
