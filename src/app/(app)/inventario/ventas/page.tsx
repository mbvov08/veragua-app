import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import NuevaVentaForm from "@/components/inventario/NuevaVentaForm";
import { resolveCompanyParam, COMPANY_LABEL, getChannels } from "@/lib/finanzas/queries";
import { formatCOP } from "@/lib/finanzas/format";
import { formatDateOnly, formatDateShortEs } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { resolverItemsPedido } from "@/lib/pedidos/inventario";

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; pedidoId?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";

  // Viene del botón "Crear venta" de un pedido: se precarga cliente, fecha y productos
  // (los de esta empresa — un pedido puede mezclar Veragua y Melcoch, y cada venta es de
  // una sola empresa).
  let pedido: {
    id: string;
    cliente: string;
    fecha: string;
    items: { productoId: string; nombre: string; cantidad: string; precio: string }[];
    avisos: { texto: string; href?: string }[];
    yaRegistrada: boolean;
  } | null = null;
  if (params.pedidoId) {
    const order = await prisma.order.findUnique({
      where: { id: params.pedidoId },
      include: { items: { include: { producto: true } } },
    });
    if (order) {
      const { resueltos, sinMatch } = await resolverItemsPedido(order.items);
      const avisos: { texto: string; href?: string }[] = [];
      const deOtra = resueltos.filter((r) => r.company !== company);
      if (deOtra.length > 0) {
        const otra = deOtra[0].company as "VERAGUA" | "MELCOCH";
        avisos.push({
          texto: `Este pedido también tiene productos de ${COMPANY_LABEL[otra]} (${deOtra.map((r) => r.nombre).join(", ")}) — se registran en una venta aparte de esa empresa.`,
          href: `/inventario/ventas?company=${otra}&pedidoId=${order.id}`,
        });
      }
      if (sinMatch.length > 0) {
        avisos.push({ texto: `Sin equivalente en Inventario (no descuentan stock): ${sinMatch.join(", ")}.` });
      }
      pedido = {
        id: order.id,
        cliente: order.cliente,
        fecha: formatDateOnly(order.fechaEntrega),
        items: resueltos
          .filter((r) => r.company === company)
          .map((r) => ({ productoId: r.finProductId, nombre: r.nombre, cantidad: String(r.cantidad), precio: String(r.precio) })),
        avisos,
        yaRegistrada: (await prisma.finSale.count({ where: { pedidoId: order.id, company } })) > 0,
      };
    }
  }

  const [productos, canales, clientes, ventas] = await Promise.all([
    prisma.finProduct.findMany({ where: { company, activo: true }, include: { categoria: true }, orderBy: { nombre: "asc" } }),
    getChannels(company),
    prisma.cliente.findMany({ orderBy: { nombre: "asc" } }),
    prisma.finSale.findMany({
      where: { company },
      include: { items: { include: { producto: true } }, cliente: true, canal: true },
      orderBy: { fecha: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Ventas — {COMPANY_LABEL[company]}</h1>
        <InventarioCompanyPicker current={company} />
      </div>

      <details className="card" open={productos.length > 0 || !!pedido}>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nueva venta</summary>
        {productos.length === 0 ? (
          <p className="mt-3 text-sm text-tierra-500">Primero crea productos en la pestaña Inventario.</p>
        ) : (
          <NuevaVentaForm
            company={company}
            companyLabel={COMPANY_LABEL[company]}
            canales={canales}
            clientes={clientes}
            productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, precioDefault: p.precio, categoria: p.categoria.nombre }))}
            pedido={pedido}
          />
        )}
      </details>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Ventas recientes</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Cliente</th>
              <th className="py-2 pr-2">Canal</th>
              <th className="py-2 pr-2">Productos</th>
              <th className="py-2 pr-2">Total</th>
              <th className="py-2 pr-2">Estado</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className="border-b border-verde-50">
                <td className="py-2 pr-2 capitalize">{formatDateShortEs(v.fecha)}</td>
                <td className="py-2 pr-2">{v.cliente?.nombre ?? "—"}</td>
                <td className="py-2 pr-2 text-tierra-500">{v.canal?.nombre ?? "—"}</td>
                <td className="py-2 pr-2 text-tierra-500">
                  {v.items.map((it) => `${it.cantidad} ${it.producto.nombre}`).join(", ")}
                </td>
                <td className="py-2 pr-2">{formatCOP(v.total)}</td>
                <td className="py-2 pr-2">
                  <span className={`badge ${v.estado === "pagada" ? "bg-verde-100 text-verde-700" : "bg-tierra-100 text-tierra-600"}`}>
                    {v.estado === "pagada" ? "Pagada" : "Fiada"}
                  </span>
                </td>
                <td className="py-2 pr-2 text-right">
                  <a href={`/inventario/comprobante/${v.id}`} className="chip-edit">
                    Comprobante
                  </a>
                </td>
              </tr>
            ))}
            {ventas.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-tierra-500">Sin ventas registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
