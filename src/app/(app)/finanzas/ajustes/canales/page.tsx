import CompanyPicker from "@/components/finanzas/CompanyPicker";
import SubmitButton from "@/components/SubmitButton";
import { resolveCompanyParam, getChannels, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { createChannel, toggleChannelActive } from "@/lib/actions/finanzas";

export default async function CanalesAjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  if (selection.isConsolidated) {
    return <p className="text-sm text-tierra-500">Selecciona una empresa específica para gestionar sus canales de venta.</p>;
  }
  const company = selection.company!;
  const channels = await getChannels(company);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Canales de venta — {COMPANY_LABEL[company]}</h1>
        <CompanyPicker current={company} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Agregar canal</h2>
        <form action={createChannel} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="company" value={company} />
          <div>
            <label className="label">Nombre del canal</label>
            <input name="nombre" placeholder="ej. Eventos corporativos" className="input w-64" required />
          </div>
          <SubmitButton>Agregar canal</SubmitButton>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Canales existentes</h2>
        <div className="space-y-2">
          {channels.map((ch) => (
            <div key={ch.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {ch.nombre}
                <span className={`badge ${ch.activo ? "bg-verde-100 text-verde-700" : "bg-tierra-100 text-tierra-500"}`}>
                  {ch.activo ? "activo" : "inactivo"}
                </span>
              </span>
              <form action={toggleChannelActive.bind(null, ch.id, !ch.activo)}>
                <button type="submit" className="text-xs text-verde-700 hover:underline">
                  {ch.activo ? "Desactivar" : "Activar"}
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
