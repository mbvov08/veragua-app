import Link from "next/link";
import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { computeProductStocks } from "@/lib/inventario/stock";
import { formatCOP } from "@/lib/finanzas/format";

export default async function InventarioResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";
  const stocks = await computeProductStocks(company);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-verde-800">Inventario</h1>
          <p className="text-sm text-tierra-500">{COMPANY_LABEL[company]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InventarioCompanyPicker current={company} />
          <Link href="/inventario/ventas" className="btn-primary text-sm">Nueva venta</Link>
          <Link href="/inventario/proveedores" className="btn-outline text-sm">Registrar compra</Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Stock actual</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Producto</th>
              <th className="py-2 pr-2">Categoría</th>
              <th className="py-2 pr-2">Precio</th>
              <th className="py-2 pr-2">Stock</th>
              <th className="py-2 pr-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <tr key={s.id} className="border-b border-verde-50">
                <td className="py-2 pr-2">{s.nombre}</td>
                <td className="py-2 pr-2 text-tierra-500">{s.categoriaNombre}</td>
                <td className="py-2 pr-2">{formatCOP(s.precio)}</td>
                <td className={`py-2 pr-2 font-semibold ${s.stock < 0 ? "text-red-600" : "text-verde-700"}`}>
                  {s.stock}
                </td>
                <td className="py-2 pr-2 text-xs">
                  {s.activo ? (
                    <span className="badge bg-verde-100 text-verde-700">Activo</span>
                  ) : (
                    <span className="badge bg-tierra-100 text-tierra-600">Inactivo</span>
                  )}
                </td>
              </tr>
            ))}
            {stocks.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-tierra-500">
                  Todavía no hay productos.{" "}
                  <Link href="/inventario/productos" className="text-verde-700 hover:underline">
                    Crea el primero
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
