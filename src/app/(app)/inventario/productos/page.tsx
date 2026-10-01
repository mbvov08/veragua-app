import Link from "next/link";
import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { computeProductStocks } from "@/lib/inventario/stock";
import { formatCOP } from "@/lib/finanzas/format";
import { prisma } from "@/lib/prisma";
import { createProduct, toggleProductActivo, registrarAjusteInventario } from "@/lib/actions/inventario-productos";
import { formatDateOnly, todayColombia } from "@/lib/date";
import ConfirmButton from "@/components/ConfirmButton";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";

  const [stocks, categorias] = await Promise.all([
    computeProductStocks(company),
    prisma.finProductCategory.findMany({ where: { company }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-verde-800">Productos — {COMPANY_LABEL[company]}</h1>
        </div>
        <InventarioCompanyPicker current={company} />
      </div>

      <details className="card" open={categorias.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo producto</summary>
        {categorias.length === 0 ? (
          <p className="mt-3 text-sm text-tierra-500">
            Primero crea una categoría en{" "}
            <Link href="/inventario/ajustes/categorias" className="text-verde-700 hover:underline">
              Categorías
            </Link>
            .
          </p>
        ) : (
          <form action={createProduct} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="company" value={company} />
            <div>
              <label className="label">Nombre</label>
              <input name="nombre" required className="input" />
            </div>
            <div>
              <label className="label">Categoría</label>
              <select name="categoriaId" required className="input">
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Precio de venta (COP)</label>
              <input type="number" name="precio" min="0" step="1" required className="input" />
            </div>
            <div>
              <label className="label">Foto (opcional)</label>
              <input type="file" name="foto" accept="image/*" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Descripción (opcional)</label>
              <textarea name="descripcion" rows={2} className="input" />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" name="visibleEnCatalogo" id="visibleEnCatalogo" defaultChecked className="h-4 w-4" />
              <label htmlFor="visibleEnCatalogo" className="text-sm text-tierra-700">Visible en el catálogo</label>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary">Guardar producto</button>
            </div>
          </form>
        )}
      </details>

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Conteo físico / ajuste de inventario</summary>
        <form action={registrarAjusteInventario} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Producto</label>
            <select name="productoId" required className="input">
              {stocks.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre} (teórico: {s.stock})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cantidad contada</label>
            <input type="number" step="1" name="contado" required className="input" />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" name="fecha" required defaultValue={formatDateOnly(todayColombia())} className="input" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Registrar</button>
          </div>
        </form>
      </details>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Productos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Foto</th>
              <th className="py-2 pr-2">Nombre</th>
              <th className="py-2 pr-2">Categoría</th>
              <th className="py-2 pr-2">Precio</th>
              <th className="py-2 pr-2">Stock</th>
              <th className="py-2 pr-2"></th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <tr key={s.id} className="border-b border-verde-50">
                <td className="py-2 pr-2">
                  {s.imagenUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.imagenUrl} alt={s.nombre} className="h-10 w-10 rounded-md object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-verde-50" />
                  )}
                </td>
                <td className="py-2 pr-2">{s.nombre}</td>
                <td className="py-2 pr-2 text-tierra-500">{s.categoriaNombre}</td>
                <td className="py-2 pr-2">{formatCOP(s.precio)}</td>
                <td className="py-2 pr-2">{s.stock}</td>
                <td className="py-2 pr-2 text-right">
                  <ConfirmButton
                    action={toggleProductActivo.bind(null, s.id, !s.activo)}
                    confirmMessage={s.activo ? "¿Desactivar este producto?" : "¿Reactivar este producto?"}
                    className="text-xs text-tierra-600 hover:underline"
                  >
                    {s.activo ? "Desactivar" : "Reactivar"}
                  </ConfirmButton>
                </td>
              </tr>
            ))}
            {stocks.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-tierra-500">Sin productos todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
