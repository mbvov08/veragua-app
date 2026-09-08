import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateOnly, formatDateShortEs, todayColombia } from "@/lib/date";
import { computeStocks } from "@/lib/melcoch";
import {
  registrarProduccionMelcoch,
  registrarCompraIngrediente,
  realizarConteoFisico,
} from "@/lib/actions/melcoch";

export default async function MelcochPage() {
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

  const [ingredientes, producciones, compras] = await Promise.all([
    prisma.melcochIngrediente.findMany({ orderBy: { nombre: "asc" } }),
    prisma.melcochProduccionDiaria.findMany({ orderBy: { fecha: "desc" }, take: 30 }),
    prisma.melcochCompraIngrediente.findMany({
      include: { ingrediente: true },
      orderBy: { fecha: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-verde-800">Melcoch — Brownie de Milo</h1>

      <details className="card" open>
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Registrar producción de hoy</summary>
        <p className="mt-2 text-xs text-tierra-500">
          De una mezcla completa salen, a elección, 6 cajas normales (245g) o 2 familiares.
        </p>
        <form action={registrarProduccionMelcoch} className="mt-4 grid gap-3 sm:grid-cols-5">
          <div>
            <label className="label">Fecha</label>
            <input type="date" name="fecha" required className="input" defaultValue={formatDateOnly(today)} />
          </div>
          <div>
            <label className="label">Mezclas producidas</label>
            <input type="number" step="0.5" min={0} name="mezclas" required className="input" />
          </div>
          <div>
            <label className="label">Cajas normales (245g)</label>
            <input type="number" min={0} name="cajasNormales" className="input" defaultValue={0} />
          </div>
          <div>
            <label className="label">Cajas familiares</label>
            <input type="number" min={0} name="cajasFamiliares" className="input" defaultValue={0} />
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

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Registrar compra de ingrediente</summary>
        <form action={registrarCompraIngrediente} className="mt-4 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Ingrediente</label>
            <select name="ingredienteId" required className="input">
              {ingredientes.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cantidad</label>
            <input type="number" step="0.1" min={0} name="cantidad" required className="input" />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" name="fecha" required className="input" defaultValue={formatDateOnly(today)} />
          </div>
          <div>
            <label className="label">Observaciones</label>
            <input type="text" name="observaciones" className="input" />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary">Guardar</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-tierra-400">
          Usa esto también para cargar el inventario inicial de cada ingrediente (regístralo como una compra).
        </p>
      </details>

      {isAdmin && <AdminSections />}

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Producción registrada</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Mezclas</th>
              <th className="py-2 pr-2">Cajas normales</th>
              <th className="py-2 pr-2">Cajas familiares</th>
              <th className="py-2 pr-2">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {producciones.map((p) => (
              <tr key={p.id} className="border-b border-verde-50">
                <td className="py-2 pr-2 capitalize">{formatDateShortEs(p.fecha)}</td>
                <td className="py-2 pr-2">{p.mezclas}</td>
                <td className="py-2 pr-2">{p.cajasNormales}</td>
                <td className="py-2 pr-2">{p.cajasFamiliares}</td>
                <td className="py-2 pr-2 text-tierra-500">{p.observaciones}</td>
              </tr>
            ))}
            {producciones.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-tierra-500">Sin registros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Compras de ingredientes</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Ingrediente</th>
              <th className="py-2 pr-2">Cantidad</th>
              <th className="py-2 pr-2">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {compras.map((c) => (
              <tr key={c.id} className="border-b border-verde-50">
                <td className="py-2 pr-2 capitalize">{formatDateShortEs(c.fecha)}</td>
                <td className="py-2 pr-2">{c.ingrediente.nombre}</td>
                <td className="py-2 pr-2">{c.cantidad} {c.ingrediente.unidad}</td>
                <td className="py-2 pr-2 text-tierra-500">{c.observaciones}</td>
              </tr>
            ))}
            {compras.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-tierra-500">Sin registros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  async function AdminSections() {
    const [stocks, ajustes] = await Promise.all([
      computeStocks(),
      prisma.melcochAjusteInventario.findMany({
        include: { ingrediente: true },
        orderBy: { fecha: "desc" },
        take: 20,
      }),
    ]);

    return (
      <>
        <div className="card overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-verde-800">Inventario calculado (solo tú lo ves)</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                <th className="py-2 pr-2">Ingrediente</th>
                <th className="py-2 pr-2">Por mezcla</th>
                <th className="py-2 pr-2">Saldo teórico actual</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => (
                <tr key={s.id} className="border-b border-verde-50">
                  <td className="py-2 pr-2">{s.nombre}</td>
                  <td className="py-2 pr-2 text-tierra-500">{s.cantidadPorMezcla} {s.unidad}</td>
                  <td className="py-2 pr-2 font-semibold text-verde-700">
                    {s.stock.toFixed(1)} {s.unidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold text-verde-800">
            Conteo físico sorpresa
          </summary>
          <p className="mt-2 text-xs text-tierra-500">
            Cuenta lo que hay físicamente hoy. Solo llena los ingredientes que quieras verificar; el resto se
            deja en blanco y no se toca. La diferencia contra el saldo teórico queda registrada.
          </p>
          <form action={realizarConteoFisico} className="mt-4 space-y-3">
            <input type="hidden" name="fecha" value={formatDateOnly(today)} />
            <div className="grid gap-3 sm:grid-cols-3">
              {stocks.map((s) => (
                <div key={s.id}>
                  <label className="label">{s.nombre} ({s.unidad})</label>
                  <input type="number" step="0.1" name={`conteo_${s.id}`} className="input" placeholder={`Teórico: ${s.stock.toFixed(1)}`} />
                </div>
              ))}
            </div>
            <button type="submit" className="btn-primary">Registrar conteo</button>
          </form>
        </details>

        {ajustes.length > 0 && (
          <div className="card overflow-x-auto">
            <h2 className="mb-3 text-sm font-semibold text-verde-800">Diferencias encontradas en conteos</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-verde-100 text-left text-xs text-tierra-500">
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2 pr-2">Ingrediente</th>
                  <th className="py-2 pr-2">Teórico</th>
                  <th className="py-2 pr-2">Contado</th>
                  <th className="py-2 pr-2">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {ajustes.map((a) => (
                  <tr key={a.id} className="border-b border-verde-50">
                    <td className="py-2 pr-2 capitalize">{formatDateShortEs(a.fecha)}</td>
                    <td className="py-2 pr-2">{a.ingrediente.nombre}</td>
                    <td className="py-2 pr-2">{a.teoricoAntes.toFixed(1)}</td>
                    <td className="py-2 pr-2">{a.contado.toFixed(1)}</td>
                    <td className={`py-2 pr-2 font-medium ${a.diferencia < 0 ? "text-red-600" : "text-verde-700"}`}>
                      {a.diferencia > 0 ? "+" : ""}{a.diferencia.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }
}
