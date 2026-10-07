import ConfirmButton from "@/components/ConfirmButton";
import SubmitButton from "@/components/SubmitButton";
import { formatDateOnly } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { requireVehiculoAdmin } from "@/lib/vehiculo/access";
import { crearOActualizarVehiculo, toggleVehiculoActivo, upsertVehiculoSettings } from "@/lib/actions/vehiculo";

export default async function VehiculoAjustesPage() {
  await requireVehiculoAdmin();

  const [vehiculos, settings] = await Promise.all([
    prisma.vehiculo.findMany({ orderBy: { placa: "asc" } }),
    prisma.vehiculoSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Vehículo — Ajustes</h1>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Valores para el resumen mensual</h2>
        <form action={upsertVehiculoSettings} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Valor por ruta completada</label>
            <input
              type="number"
              name="valorPorRuta"
              min="0"
              step="1000"
              defaultValue={settings?.valorPorRuta ?? 0}
              required
              className="input w-40"
            />
          </div>
          <div>
            <label className="label">Canon diario de alquiler</label>
            <input
              type="number"
              name="canonDiarioAlquiler"
              min="0"
              step="1000"
              defaultValue={settings?.canonDiarioAlquiler ?? 0}
              required
              className="input w-40"
            />
          </div>
          <SubmitButton>Guardar</SubmitButton>
        </form>
      </div>

      <details className="card" open={vehiculos.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo vehículo</summary>
        <form action={crearOActualizarVehiculo.bind(null, null)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Placa</label>
            <input name="placa" required className="input" placeholder="ABC123" />
          </div>
          <div>
            <label className="label">Marca</label>
            <input name="marca" className="input" placeholder="Citroën" />
          </div>
          <div>
            <label className="label">Modelo</label>
            <input name="modelo" className="input" placeholder="Berlingo Van" />
          </div>
          <div>
            <label className="label">Color</label>
            <input name="color" className="input" />
          </div>
          <div>
            <label className="label">Vence SOAT</label>
            <input type="date" name="soatVenceAt" className="input" />
          </div>
          <div>
            <label className="label">Vence revisión técnico-mecánica</label>
            <input type="date" name="revisionTecnicoMecanicaVenceAt" className="input" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Crear vehículo</SubmitButton>
          </div>
        </form>
      </details>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Flota</h2>
        {vehiculos.length === 0 ? (
          <p className="text-sm text-tierra-500">Todavía no hay vehículos registrados.</p>
        ) : (
          <div className="divide-y divide-verde-50">
            {vehiculos.map((v) => (
              <details key={v.id} className="group py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-1 py-1">
                  <div>
                    <p className="text-sm font-medium text-tierra-800">
                      {v.placa} <span className="text-xs font-normal text-tierra-500">{[v.marca, v.modelo].filter(Boolean).join(" ")}</span>
                      {!v.activo && <span className="badge ml-2 bg-tierra-100 text-tierra-500">inactivo</span>}
                    </p>
                    <p className="text-xs text-tierra-500">
                      SOAT: {v.soatVenceAt ? formatDateOnly(v.soatVenceAt) : "sin registrar"} · Revisión: {v.revisionTecnicoMecanicaVenceAt ? formatDateOnly(v.revisionTecnicoMecanicaVenceAt) : "sin registrar"}
                    </p>
                  </div>
                  <ConfirmButton
                    action={toggleVehiculoActivo.bind(null, v.id, !v.activo)}
                    confirmMessage={v.activo ? "¿Desactivar este vehículo?" : "¿Reactivar este vehículo?"}
                    className="chip-neutral"
                  >
                    {v.activo ? "Desactivar" : "Reactivar"}
                  </ConfirmButton>
                </summary>
                <form action={crearOActualizarVehiculo.bind(null, v.id)} className="mt-3 grid gap-3 rounded-lg border border-verde-100 bg-verde-50/40 p-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Placa</label>
                    <input name="placa" required defaultValue={v.placa} className="input" />
                  </div>
                  <div>
                    <label className="label">Marca</label>
                    <input name="marca" defaultValue={v.marca ?? ""} className="input" />
                  </div>
                  <div>
                    <label className="label">Modelo</label>
                    <input name="modelo" defaultValue={v.modelo ?? ""} className="input" />
                  </div>
                  <div>
                    <label className="label">Color</label>
                    <input name="color" defaultValue={v.color ?? ""} className="input" />
                  </div>
                  <div>
                    <label className="label">Vence SOAT</label>
                    <input type="date" name="soatVenceAt" defaultValue={v.soatVenceAt ? formatDateOnly(v.soatVenceAt) : ""} className="input" />
                  </div>
                  <div>
                    <label className="label">Vence revisión técnico-mecánica</label>
                    <input
                      type="date"
                      name="revisionTecnicoMecanicaVenceAt"
                      defaultValue={v.revisionTecnicoMecanicaVenceAt ? formatDateOnly(v.revisionTecnicoMecanicaVenceAt) : ""}
                      className="input"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <SubmitButton>Guardar cambios</SubmitButton>
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
