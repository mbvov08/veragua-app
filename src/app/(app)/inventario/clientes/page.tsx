import InventarioCompanyPicker from "@/components/inventario/CompanyPicker";
import SubmitButton from "@/components/SubmitButton";
import ImportarContactoButton from "@/components/ImportarContactoButton";
import { Icon } from "@/components/icons";
import { resolveCompanyParam, COMPANY_LABEL } from "@/lib/finanzas/queries";
import { formatCOP } from "@/lib/finanzas/format";
import { formatDateOnly, formatDateShortEs, todayColombia } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { registrarPagoCliente, crearCliente, editarCliente } from "@/lib/actions/inventario-ventas";

const ZONA_LABEL: Record<string, string> = {
  LOCAL: "Local",
  PEREIRA: "Ruta Pereira",
  MANIZALES: "Ruta Manizales",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const selection = resolveCompanyParam(params.company);
  const company = selection.company ?? "VERAGUA";

  const [cuentas, todosLosClientes] = await Promise.all([
    prisma.finCuentaPorCobrar.findMany({
      where: { company, saldo: { gt: 0 } },
      include: { cliente: true, venta: { include: { items: { include: { producto: true } } } } },
      orderBy: { fecha: "asc" },
    }),
    prisma.cliente.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  function describirCuenta(c: (typeof cuentas)[number]) {
    if (c.venta && c.venta.items.length > 0) {
      return c.venta.items.map((it) => `${it.cantidad} ${it.producto.nombre}`).join(", ");
    }
    return c.notas ?? "Saldo pendiente";
  }

  function whatsappLink(telefono: string | null, nombre: string, saldo: number, facturas: typeof cuentas) {
    const detalle = facturas
      .map((f) => `📅 ${formatDateShortEs(f.fecha)} — ${describirCuenta(f)}: ${formatCOP(f.saldo)}`)
      .join("\n");
    const mensaje = `Hola ${nombre.split(" ")[0]}! Te escribimos de Veragua para recordarte con cariño que tienes un saldo pendiente de ${formatCOP(saldo)}, de estas facturas:\n\n${detalle}\n\nCuando puedas, nos cuentas 😊 ¡Gracias!`;
    const digitos = telefono?.replace(/\D/g, "") ?? "";
    if (!digitos) {
      // Sin teléfono registrado: igual abre WhatsApp con el mensaje listo, para que
      // elijas el contacto a mano en vez de bloquear el recordatorio.
      return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    }
    const numero = digitos.startsWith("57") ? digitos : `57${digitos}`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  }

  const saldoPorCliente = new Map<
    string,
    { id: string; nombre: string; telefono: string | null; saldo: number; facturas: typeof cuentas }
  >();
  for (const c of cuentas) {
    const prev = saldoPorCliente.get(c.clienteId);
    saldoPorCliente.set(c.clienteId, {
      id: c.clienteId,
      nombre: c.cliente.nombre,
      telefono: c.cliente.telefono,
      saldo: (prev?.saldo ?? 0) + c.saldo,
      facturas: [...(prev?.facturas ?? []), c],
    });
  }
  const clientesConSaldo = [...saldoPorCliente.values()].sort((a, b) => b.saldo - a.saldo);
  const totalSaldo = clientesConSaldo.reduce((s, c) => s + c.saldo, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-verde-800">Clientes — {COMPANY_LABEL[company]}</h1>
        <InventarioCompanyPicker current={company} />
      </div>

      <details className="card">
        <summary className="cursor-pointer text-sm font-semibold text-verde-800">Nuevo cliente</summary>
        <form action={crearCliente} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nombre</label>
            <input id="clienteNuevoNombre" name="nombre" required className="input" />
          </div>
          <div>
            <label className="label">Teléfono (opcional)</label>
            <div className="flex items-center gap-2">
              <input id="clienteNuevoTelefono" name="telefono" className="input" />
              <ImportarContactoButton nombreInputId="clienteNuevoNombre" telefonoInputId="clienteNuevoTelefono" />
            </div>
          </div>
          <div>
            <label className="label">Dirección (opcional)</label>
            <input name="direccion" className="input" />
          </div>
          <div>
            <label className="label">Zona</label>
            <select name="zona" className="input" defaultValue="LOCAL">
              <option value="LOCAL">Local</option>
              <option value="PEREIRA">Ruta Pereira</option>
              <option value="MANIZALES">Ruta Manizales</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Guardar cliente</SubmitButton>
          </div>
        </form>
      </details>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-verde-800">Todos los clientes ({todosLosClientes.length})</h2>
        {todosLosClientes.length === 0 ? (
          <p className="text-sm text-tierra-500">Todavía no hay clientes registrados.</p>
        ) : (
          <div className="divide-y divide-verde-50">
            {todosLosClientes.map((c) => (
              <details key={c.id} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-2 hover:bg-verde-50/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tierra-800">{c.nombre}</p>
                    <p className="text-xs text-tierra-500">
                      {ZONA_LABEL[c.zona] ?? c.zona}
                      {c.telefono ? ` · ${c.telefono}` : ""}
                    </p>
                  </div>
                  {!c.telefono && <span className="badge bg-tierra-100 text-tierra-500">Sin teléfono</span>}
                  <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-tierra-400 transition-transform group-open:rotate-90" />
                </summary>
                <form
                  action={editarCliente.bind(null, c.id)}
                  className="mt-2 grid gap-3 rounded-lg border border-verde-100 bg-verde-50/40 p-3 sm:grid-cols-2"
                >
                  <div>
                    <label className="label">Nombre</label>
                    <input id={`clienteNombre-${c.id}`} name="nombre" required defaultValue={c.nombre} className="input" />
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <div className="flex items-center gap-2">
                      <input id={`clienteTelefono-${c.id}`} name="telefono" defaultValue={c.telefono ?? ""} className="input" />
                      <ImportarContactoButton nombreInputId={`clienteNombre-${c.id}`} telefonoInputId={`clienteTelefono-${c.id}`} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Dirección</label>
                    <input name="direccion" defaultValue={c.direccion} className="input" />
                  </div>
                  <div>
                    <label className="label">Zona</label>
                    <select name="zona" className="input" defaultValue={c.zona}>
                      <option value="LOCAL">Local</option>
                      <option value="PEREIRA">Ruta Pereira</option>
                      <option value="MANIZALES">Ruta Manizales</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <SubmitButton className="btn-secondary">Guardar cambios</SubmitButton>
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}
      </div>

      {clientesConSaldo.length > 0 && (
        <div className="card flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold text-tierra-800">{formatCOP(totalSaldo)}</p>
            <p className="text-sm text-tierra-500">{clientesConSaldo.length} cliente{clientesConSaldo.length === 1 ? "" : "s"}</p>
          </div>
          <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-dorado-100 px-2 text-sm font-semibold text-tierra-800">
            {cuentas.length}
          </span>
        </div>
      )}

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-verde-800">Saldo pendiente por cliente</h2>
          {clientesConSaldo.length > 0 && (
            <span className="text-sm font-semibold text-red-600">{formatCOP(totalSaldo)}</span>
          )}
        </div>
        {clientesConSaldo.length === 0 ? (
          <p className="text-sm text-tierra-500">Ningún cliente te debe nada ahora mismo.</p>
        ) : (
          <div className="divide-y divide-verde-50">
            {clientesConSaldo.map((c) => (
              <details key={c.id} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-2 hover:bg-verde-50/60">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dorado-100 text-sm font-semibold text-tierra-800">
                    {c.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tierra-800">{c.nombre}</p>
                    <p className="text-xs text-tierra-500">{c.facturas.length} factura{c.facturas.length === 1 ? "" : "s"} pendiente{c.facturas.length === 1 ? "" : "s"}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{formatCOP(c.saldo)}</span>
                  <Icon name="chevron-right" className="h-4 w-4 shrink-0 text-tierra-400 transition-transform group-open:rotate-90" />
                </summary>

                <div className="mt-2 rounded-lg border border-verde-100 bg-verde-50/40 p-3">
                  <a
                    href={whatsappLink(c.telefono, c.nombre, c.saldo, c.facturas)}
                    target="_blank"
                    rel="noreferrer"
                    className="chip-edit mb-3 inline-flex items-center gap-1"
                  >
                    💬 Enviar recordatorio por WhatsApp
                    {!c.telefono && <span className="text-tierra-400">(elige el contacto)</span>}
                  </a>
                  {!c.telefono && (
                    <p className="mb-3 text-xs text-tierra-400">
                      Sin teléfono registrado — agrégalo en &quot;Todos los clientes&quot; abajo para que el mensaje vaya directo.
                    </p>
                  )}

                  <div className="mb-3 space-y-2">
                    {c.facturas.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-2 border-b border-verde-100 pb-2 text-sm last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-tierra-800">{describirCuenta(f)}</p>
                          <p className="text-xs text-tierra-500">{formatDateOnly(f.fecha)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-medium text-red-600">{formatCOP(f.saldo)}</span>
                          {f.ventaId && (
                            <a
                              href={`/api/inventario/export/comprobante/${f.ventaId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="chip-edit"
                            >
                              Comprobante
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form action={registrarPagoCliente} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="clienteId" value={c.id} />
                    <input type="hidden" name="company" value={company} />
                    <div>
                      <label className="label">Monto pagado</label>
                      <input type="number" name="monto" min="0" step="1" required className="input w-32" />
                    </div>
                    <div>
                      <label className="label">Fecha</label>
                      <input type="date" name="fecha" required defaultValue={formatDateOnly(todayColombia())} className="input" />
                    </div>
                    <div>
                      <label className="label">Método (opcional)</label>
                      <input name="metodoPago" className="input w-32" />
                    </div>
                    <SubmitButton className="btn-secondary">Registrar pago</SubmitButton>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <a href={`/api/inventario/export/historial/cliente/${c.id}`} className="chip-edit inline-flex items-center gap-1">
                      <Icon name="download" className="h-3.5 w-3.5" />
                      Descargar historial
                    </a>
                    <form action={`/api/inventario/export/cuenta-cobro`} method="get" className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="clienteId" value={c.id} />
                      <span className="text-tierra-500">Cuenta de cobro desde</span>
                      <input type="date" name="start" required className="input w-36 py-1" />
                      <span className="text-tierra-500">hasta</span>
                      <input type="date" name="end" required defaultValue={formatDateOnly(todayColombia())} className="input w-36 py-1" />
                      <button type="submit" className="chip-edit inline-flex items-center gap-1">
                        <Icon name="receipt" className="h-3.5 w-3.5" />
                        Generar PDF
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
