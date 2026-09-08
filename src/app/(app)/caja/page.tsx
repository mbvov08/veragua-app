import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateShortEs, todayColombia } from "@/lib/date";
import {
  updateCajaBase,
  crearEgreso,
  crearIngreso,
  decidirEgreso,
  eliminarMovimientoCaja,
} from "@/lib/actions/caja";
import ConfirmButton from "@/components/ConfirmButton";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const CATEGORIA_LABEL: Record<string, string> = {
  PAGO_EFECTIVO: "Pago en efectivo",
  COMPRA_INSUMOS: "Compra de insumos",
  PAGO_DOMICILIARIOS: "Pago a domiciliarios",
  PAGO_SERVICIOS: "Pago de servicios públicos",
  OTROS: "Otros",
};

export default async function CajaPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "EMPLEADA")) {
    return (
      <div className="card">
        <p className="text-sm text-tierra-600">No tienes acceso a esta sección.</p>
      </div>
    );
  }
  const isAdmin = session.user.role === "ADMIN";
  const today = todayColombia();

  const [settings, movimientos] = await Promise.all([
    prisma.cajaSettings.findUnique({ where: { id: "singleton" } }),
    prisma.cajaMovimiento.findMany({
      include: { creadoPor: true, aprobadoPor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const baseInicial = settings?.baseInicial ?? 0;
  const aprobados = movimientos.filter((m) => m.estado === "APROBADO");
  const ingresos = aprobados.filter((m) => m.tipo === "INGRESO").reduce((s, m) => s + m.monto, 0);
  const egresos = aprobados.filter((m) => m.tipo === "EGRESO").reduce((s, m) => s + m.monto, 0);
  const saldoActual = baseInicial + ingresos - egresos;

  const pendientes = movimientos.filter((m) => m.estado === "PENDIENTE");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Caja</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs text-tierra-500">Saldo actual en caja</p>
          <p className="text-3xl font-semibold text-verde-800">{COP.format(saldoActual)}</p>
          <p className="mt-1 text-xs text-tierra-400">
            Base {COP.format(baseInicial)} + ingresos {COP.format(ingresos)} − egresos aprobados {COP.format(egresos)}
          </p>
        </div>

        {isAdmin && (
          <div className="card">
            <h2 className="mb-2 text-sm font-semibold text-verde-800">Base inicial de caja</h2>
            <form action={updateCajaBase} className="flex gap-2">
              <input type="number" step="1" name="baseInicial" defaultValue={baseInicial} className="input" />
              <button type="submit" className="btn-primary">Guardar</button>
            </form>
          </div>
        )}
      </div>

      {pendientes.length > 0 && (
        <div className="card border-tierra-200 bg-tierra-50">
          <h2 className="mb-3 text-sm font-semibold text-tierra-800">
            Egresos pendientes de aprobación ({pendientes.length})
          </h2>
          <ul className="divide-y divide-tierra-100">
            {pendientes.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium text-tierra-800">
                    {COP.format(m.monto)} · {CATEGORIA_LABEL[m.categoria ?? "OTROS"]}
                  </p>
                  <p className="text-xs text-tierra-500">
                    {m.creadoPor.name} · {formatDateShortEs(m.fecha)}
                    {m.observaciones && ` · ${m.observaciones}`}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-3">
                    <ConfirmButton
                      action={decidirEgreso.bind(null, m.id, true)}
                      confirmMessage="¿Aprobar este egreso?"
                      className="text-xs text-verde-700 hover:underline"
                    >
                      Aprobar
                    </ConfirmButton>
                    <ConfirmButton
                      action={decidirEgreso.bind(null, m.id, false)}
                      confirmMessage="¿Rechazar este egreso?"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Rechazar
                    </ConfirmButton>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Registrar egreso</summary>
        <form action={crearEgreso} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Monto ($)</label>
            <input type="number" step="1" name="monto" required min={1} className="input" />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" name="fecha" className="input" defaultValue={today.toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className="label">Motivo</label>
            <select name="categoria" className="input" defaultValue="COMPRA_INSUMOS">
              {Object.entries(CATEGORIA_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Observaciones</label>
            <input type="text" name="observaciones" className="input" />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary">
              {isAdmin ? "Registrar (aprobado)" : "Enviar para aprobación"}
            </button>
          </div>
        </form>
        {!isAdmin && (
          <p className="mt-2 text-xs text-tierra-400">
            Este egreso quedará pendiente hasta que Manuela lo apruebe.
          </p>
        )}
      </details>

      {isAdmin && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-verde-800">Registrar ingreso / reposición</summary>
          <form action={crearIngreso} className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Monto ($)</label>
              <input type="number" step="1" name="monto" required min={1} className="input" />
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" name="fecha" className="input" defaultValue={today.toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className="label">Observaciones</label>
              <input type="text" name="observaciones" className="input" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        </details>
      )}

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Movimientos</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Tipo</th>
              <th className="py-2 pr-2">Motivo</th>
              <th className="py-2 pr-2">Monto</th>
              <th className="py-2 pr-2">Estado</th>
              <th className="py-2 pr-2">Registrado por</th>
              {isAdmin && <th className="py-2 pr-2"></th>}
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id} className="border-b border-verde-50">
                <td className="py-2 pr-2 capitalize">{formatDateShortEs(m.fecha)}</td>
                <td className="py-2 pr-2">{m.tipo === "INGRESO" ? "Ingreso" : "Egreso"}</td>
                <td className="py-2 pr-2">{m.categoria ? CATEGORIA_LABEL[m.categoria] : "—"}</td>
                <td className={`py-2 pr-2 ${m.tipo === "EGRESO" ? "text-red-600" : "text-verde-700"}`}>
                  {m.tipo === "EGRESO" ? "-" : "+"}{COP.format(m.monto)}
                </td>
                <td className="py-2 pr-2">
                  <span
                    className={`badge ${
                      m.estado === "APROBADO"
                        ? "bg-verde-100 text-verde-700"
                        : m.estado === "PENDIENTE"
                          ? "bg-tierra-100 text-tierra-700"
                          : "bg-red-50 text-red-600"
                    }`}
                  >
                    {m.estado === "APROBADO" ? "Aprobado" : m.estado === "PENDIENTE" ? "Pendiente" : "Rechazado"}
                  </span>
                </td>
                <td className="py-2 pr-2">{m.creadoPor.name}</td>
                {isAdmin && (
                  <td className="py-2 pr-2">
                    <ConfirmButton
                      action={eliminarMovimientoCaja.bind(null, m.id)}
                      confirmMessage="¿Eliminar este movimiento?"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Eliminar
                    </ConfirmButton>
                  </td>
                )}
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr><td colSpan={isAdmin ? 7 : 6} className="py-6 text-center text-tierra-500">Sin movimientos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
