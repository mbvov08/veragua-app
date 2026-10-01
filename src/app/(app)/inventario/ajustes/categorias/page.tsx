import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import SubmitButton from "@/components/SubmitButton";
import ConfirmButton from "@/components/ConfirmButton";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { prisma } from "@/lib/prisma";
import { createProductCategory, deleteProductCategory } from "@/lib/actions/inventario-productos";

export default async function CategoriasProductoPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";
  const categorias = await prisma.finProductCategory.findMany({
    where: { company },
    include: { _count: { select: { productos: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Categorías de producto — {COMPANY_LABEL[company]}</h1>
        <InventarioCompanyPicker current={company} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Agregar categoría</h2>
        <form action={createProductCategory} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="company" value={company} />
          <div>
            <label className="label">Nombre</label>
            <input name="nombre" placeholder="ej. Lácteos Sanorigen" className="input w-64" required />
          </div>
          <SubmitButton>Agregar categoría</SubmitButton>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Categorías existentes</h2>
        <div className="space-y-2">
          {categorias.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span>
                {c.nombre} <span className="text-xs text-tierra-400">({c._count.productos} productos)</span>
              </span>
              {c._count.productos === 0 && (
                <ConfirmButton
                  action={deleteProductCategory.bind(null, c.id)}
                  confirmMessage="¿Eliminar esta categoría?"
                  className="text-xs text-red-500 hover:underline"
                >
                  Eliminar
                </ConfirmButton>
              )}
            </div>
          ))}
          {categorias.length === 0 && <p className="text-sm text-tierra-500">Sin categorías todavía.</p>}
        </div>
      </div>
    </div>
  );
}
