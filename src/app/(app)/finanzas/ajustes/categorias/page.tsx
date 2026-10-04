import CompanyPicker from "@/components/finanzas/CompanyPicker";
import SubmitButton from "@/components/SubmitButton";
import ConfirmButton from "@/components/ConfirmButton";
import { resolveCompanyParam, getCategories, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { createCategory, deleteCategory } from "@/lib/actions/finanzas";

const TYPE_OPTIONS = [
  { value: "ingreso_operacional", label: "Ingreso operacional" },
  { value: "ingreso_no_operacional", label: "Ingreso no operacional" },
  { value: "costo_venta", label: "Costo de venta" },
  { value: "gasto_admin", label: "Gasto de administración" },
  { value: "gasto_ventas", label: "Gasto de ventas" },
  { value: "gasto_no_operacional", label: "Gasto no operacional" },
  { value: "impuesto", label: "Impuesto" },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));

export default async function CategoriasAjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  if (selection.isConsolidated) {
    return <p className="text-sm text-tierra-500">Selecciona una empresa específica para gestionar sus categorías.</p>;
  }
  const company = selection.company!;
  const categories = await getCategories(company);
  const grouped = TYPE_OPTIONS.map((t) => ({ ...t, items: categories.filter((c) => c.tipo === t.value) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Categorías — {COMPANY_LABEL[company]}</h1>
        <CompanyPicker current={company} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Agregar categoría propia</h2>
        <form action={createCategory} className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="company" value={company} />
          <div>
            <label className="label">Código</label>
            <input name="codigo" required className="input" />
          </div>
          <div>
            <label className="label">Nombre</label>
            <input name="nombre" required className="input" />
          </div>
          <div>
            <label className="label">Tipo</label>
            <select name="tipo" required defaultValue="gasto_ventas" className="input">
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-tierra-500">
              <input type="checkbox" name="atribuibleACanal" className="h-4 w-4" /> Atribuible a canal
            </label>
          </div>
          <div className="sm:col-span-4">
            <SubmitButton>Agregar categoría</SubmitButton>
          </div>
        </form>
      </div>

      {grouped.map((g) => (
        <div key={g.value} className="card">
          <h3 className="mb-2 text-sm font-semibold text-verde-800">{TYPE_LABELS[g.value]}</h3>
          <div className="space-y-2">
            {g.items.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between text-sm">
                <span>
                  {cat.codigo} · {cat.nombre}{" "}
                  {cat.company === null && <span className="badge ml-2 bg-tierra-100 text-tierra-600">compartida</span>}
                </span>
                {cat.company !== null && (
                  <ConfirmButton
                    action={deleteCategory.bind(null, cat.id)}
                    confirmMessage="¿Eliminar esta categoría?"
                    className="chip-danger"
                  >
                    Eliminar
                  </ConfirmButton>
                )}
              </div>
            ))}
            {g.items.length === 0 && <p className="text-xs text-tierra-400">Sin categorías en este grupo.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
