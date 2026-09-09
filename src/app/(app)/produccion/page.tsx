import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addDays, dateOnlyToUTC, formatDateOnly, formatDateShortEs, todayColombia } from "@/lib/date";
import {
  registrarGalpon,
  registrarRecepcionLocal,
  eliminarRegistroGalpon,
  eliminarRecepcionLocal,
} from "@/lib/actions/produccion";
import ConfirmButton from "@/components/ConfirmButton";
import CurvaPosturaChart, { PosturaPoint } from "@/components/CurvaPosturaChart";

export default async function ProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role;
  const params = await searchParams;
  const today = todayColombia();
  const from = params.from ? dateOnlyToUTC(params.from) : addDays(today, -30);
  const to = params.to ? dateOnlyToUTC(params.to) : today;

  const rangeForm = (
    <form className="card flex flex-wrap items-end gap-3" method="get">
      <div>
        <label className="label">Desde</label>
        <input type="date" name="from" defaultValue={formatDateOnly(from)} className="input" />
      </div>
      <div>
        <label className="label">Hasta</label>
        <input type="date" name="to" defaultValue={formatDateOnly(to)} className="input" />
      </div>
      <button type="submit" className="btn-primary">Filtrar</button>
    </form>
  );

  if (role === "GALPON") {
    const registros = await prisma.registroGalpon.findMany({
      where: { userId: session.user.id, fecha: { gte: from, lte: to } },
      orderBy: { fecha: "asc" },
    });
    const hoyRegistro = registros.find((r) => formatDateOnly(r.fecha) === formatDateOnly(today));

    const chartData: PosturaPoint[] = registros.map((r) => ({
      fecha: formatDateOnly(r.fecha),
      galpon: r.huevosProducidos - r.huevosRotos,
      local: null,
    }));

    return (
      <div className="space-y-6">
        <h1 className="text-lg font-semibold text-verde-800">Postura/Huevos del galpón</h1>

        <details className="card" open>
          <summary className="cursor-pointer text-sm font-semibold text-verde-800">Registrar producción de hoy</summary>
          <form action={registrarGalpon} className="mt-4 grid gap-3 sm:grid-cols-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" name="fecha" required className="input" defaultValue={formatDateOnly(today)} />
            </div>
            <div>
              <label className="label">Huevos producidos</label>
              <input type="number" name="huevosProducidos" required min={0} className="input" defaultValue={hoyRegistro?.huevosProducidos ?? ""} />
            </div>
            <div>
              <label className="label">Huevos rotos</label>
              <input type="number" name="huevosRotos" min={0} className="input" defaultValue={hoyRegistro?.huevosRotos ?? 0} />
            </div>
            <div>
              <label className="label">Observaciones</label>
              <input type="text" name="observaciones" className="input" defaultValue={hoyRegistro?.observaciones ?? ""} />
            </div>
            <div className="sm:col-span-4">
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        </details>

        {rangeForm}

        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Curva de postura</h2>
          <CurvaPosturaChart data={chartData} showLocal={false} />
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Fecha</th>
                <th className="py-2 pr-2">Producidos</th>
                <th className="py-2 pr-2">Rotos</th>
                <th className="py-2 pr-2">Buenos</th>
                <th className="py-2 pr-2">Observaciones</th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {[...registros].reverse().map((r) => (
                <tr key={r.id} className="border-b border-verde-50">
                  <td className="py-2 pr-2 capitalize">{formatDateShortEs(r.fecha)}</td>
                  <td className="py-2 pr-2">{r.huevosProducidos}</td>
                  <td className="py-2 pr-2">{r.huevosRotos}</td>
                  <td className="py-2 pr-2 font-medium">{r.huevosProducidos - r.huevosRotos}</td>
                  <td className="py-2 pr-2 text-tierra-500">{r.observaciones}</td>
                  <td className="py-2 pr-2">
                    <ConfirmButton
                      action={eliminarRegistroGalpon.bind(null, r.id)}
                      confirmMessage="¿Eliminar este registro?"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Eliminar
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-tierra-500">Sin registros en este rango.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ADMIN o EMPLEADA: ven el panorama completo (galpón + recepción en el local).
  const isAdmin = role === "ADMIN";

  const [galponUsers, registrosGalpon, recepciones] = await Promise.all([
    prisma.user.findMany({ where: { role: "GALPON" }, orderBy: { name: "asc" } }),
    prisma.registroGalpon.findMany({
      where: { fecha: { gte: from, lte: to } },
      include: { user: true },
      orderBy: { fecha: "asc" },
    }),
    prisma.recepcionLocal.findMany({
      where: { fecha: { gte: from, lte: to } },
      include: { registradoPor: true },
      orderBy: { fecha: "asc" },
    }),
  ]);

  const galponPorFecha = new Map<string, number>();
  for (const r of registrosGalpon) {
    const key = formatDateOnly(r.fecha);
    galponPorFecha.set(key, (galponPorFecha.get(key) ?? 0) + (r.huevosProducidos - r.huevosRotos));
  }
  const localPorFecha = new Map<string, number>();
  for (const r of recepciones) {
    localPorFecha.set(formatDateOnly(r.fecha), r.cantidadRecibida);
  }
  const todasFechas = [...new Set([...galponPorFecha.keys(), ...localPorFecha.keys()])].sort();
  const chartData: PosturaPoint[] = todasFechas.map((fecha) => ({
    fecha,
    galpon: galponPorFecha.get(fecha) ?? null,
    local: localPorFecha.get(fecha) ?? null,
  }));

  const totalGalpon = [...galponPorFecha.values()].reduce((a, b) => a + b, 0);
  const totalLocal = [...localPorFecha.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Postura/Huevos</h1>

      {isAdmin && galponUsers.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-verde-800">
            Registrar producción del galpón (corrección)
          </summary>
          <form action={registrarGalpon} className="mt-4 grid gap-3 sm:grid-cols-5">
            <input type="hidden" name="userId" value={galponUsers[0].id} />
            <div>
              <label className="label">Encargado</label>
              <input className="input" disabled value={galponUsers[0].name} />
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" name="fecha" required className="input" defaultValue={formatDateOnly(today)} />
            </div>
            <div>
              <label className="label">Huevos producidos</label>
              <input type="number" name="huevosProducidos" required min={0} className="input" />
            </div>
            <div>
              <label className="label">Huevos rotos</label>
              <input type="number" name="huevosRotos" min={0} className="input" defaultValue={0} />
            </div>
            <div>
              <label className="label">Observaciones</label>
              <input type="text" name="observaciones" className="input" />
            </div>
            <div className="sm:col-span-5">
              <button type="submit" className="btn-primary">Guardar</button>
            </div>
          </form>
        </details>
      )}

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Registrar recepción en el local</summary>
        <form action={registrarRecepcionLocal} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Fecha</label>
            <input type="date" name="fecha" required className="input" defaultValue={formatDateOnly(today)} />
          </div>
          <div>
            <label className="label">Cantidad recibida (huevos)</label>
            <input type="number" name="cantidadRecibida" required min={0} className="input" />
          </div>
          <div>
            <label className="label">Observaciones</label>
            <input type="text" name="observaciones" className="input" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">Guardar</button>
          </div>
        </form>
      </details>

      {rangeForm}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs text-tierra-500">Total producido (galpón, buenos) en el rango</p>
          <p className="text-2xl font-semibold text-verde-800">{totalGalpon.toLocaleString("es-CO")}</p>
        </div>
        <div className="card">
          <p className="text-xs text-tierra-500">Total recibido en el local en el rango</p>
          <p className="text-2xl font-semibold text-tierra-700">{totalLocal.toLocaleString("es-CO")}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Curva de postura</h2>
        <CurvaPosturaChart data={chartData} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Registro del galpón</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Fecha</th>
                <th className="py-2 pr-2">Buenos</th>
                <th className="py-2 pr-2">Rotos</th>
                {isAdmin && <th className="py-2 pr-2"></th>}
              </tr>
            </thead>
            <tbody>
              {[...registrosGalpon].reverse().map((r) => (
                <tr key={r.id} className="border-b border-verde-50">
                  <td className="py-2 pr-2 capitalize">{formatDateShortEs(r.fecha)}</td>
                  <td className="py-2 pr-2">{r.huevosProducidos - r.huevosRotos}</td>
                  <td className="py-2 pr-2">{r.huevosRotos}</td>
                  {isAdmin && (
                    <td className="py-2 pr-2">
                      <ConfirmButton
                        action={eliminarRegistroGalpon.bind(null, r.id)}
                        confirmMessage="¿Eliminar este registro?"
                        className="text-xs text-red-600 hover:underline"
                      >
                        Eliminar
                      </ConfirmButton>
                    </td>
                  )}
                </tr>
              ))}
              {registrosGalpon.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-tierra-500">Sin registros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Recepción en el local</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Fecha</th>
                <th className="py-2 pr-2">Cantidad</th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {[...recepciones].reverse().map((r) => (
                <tr key={r.id} className="border-b border-verde-50">
                  <td className="py-2 pr-2 capitalize">{formatDateShortEs(r.fecha)}</td>
                  <td className="py-2 pr-2">{r.cantidadRecibida}</td>
                  <td className="py-2 pr-2">
                    <ConfirmButton
                      action={eliminarRecepcionLocal.bind(null, r.id)}
                      confirmMessage="¿Eliminar este registro?"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Eliminar
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
              {recepciones.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-tierra-500">Sin registros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
