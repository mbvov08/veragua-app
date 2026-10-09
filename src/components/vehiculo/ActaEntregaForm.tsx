"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActaDraft } from "@/components/vehiculo/useActaDraft";
import PhotoCaptureField from "@/components/vehiculo/PhotoCaptureField";
import EvaluacionPuntoField from "@/components/vehiculo/EvaluacionPuntoField";
import EquipoChecklistField from "@/components/vehiculo/EquipoChecklistField";
import SignaturePad, { type SignaturePadHandle } from "@/components/vehiculo/SignaturePad";
import {
  ANGULOS,
  PUNTOS_EVALUACION,
  EQUIPAMIENTO_ITEMS,
  COMBUSTIBLE_NIVELES,
  TIPO_USO,
} from "@/lib/vehiculo/constants";
import { validarActaEntrega, type FotoDraft, type EvaluacionDraft, type EquipoDraft } from "@/lib/vehiculo/validacion";
import { crearSalida } from "@/lib/actions/vehiculo";
import { listarPedidosPendientesPorFecha } from "@/lib/actions/vehiculo-entregas";
import { listarProximasRutasDe } from "@/lib/actions/vehiculo-programacion";

type Vehiculo = { id: string; placa: string };
type Conductor = { id: string; name: string };
type PedidoPendiente = {
  id: string;
  cliente: string;
  direccion: string;
  zona: string;
  items: { cantidad: string | null; producto: { nombre: string } }[];
};
type RutaProgramada = { id: string; fecha: Date; notas: string | null };

function hoyISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

type Draft = {
  vehiculoId: string;
  conductorId: string;
  tipoUso: string;
  zona: string;
  destino: string;
  checkoutKm: string;
  checkoutCombustible: string;
  observacionesEntrega: string;
  evaluaciones: EvaluacionDraft[];
  equipamiento: EquipoDraft[];
  fechaRuta: string;
  pedidoIds: string[];
  rutaProgramadaId: string;
};

function draftInicial(vehiculos: Vehiculo[], conductorFijo?: Conductor): Draft {
  return {
    vehiculoId: vehiculos[0]?.id ?? "",
    conductorId: conductorFijo?.id ?? "",
    tipoUso: "",
    zona: "",
    destino: "",
    checkoutKm: "",
    checkoutCombustible: "",
    observacionesEntrega: "",
    evaluaciones: PUNTOS_EVALUACION.map((p) => ({ punto: p.value, estado: "", nota: "" })),
    equipamiento: EQUIPAMIENTO_ITEMS.map((it) => ({ item: it.value, presente: null })),
    fechaRuta: hoyISO(),
    pedidoIds: [],
    rutaProgramadaId: "",
  };
}

export default function ActaEntregaForm({
  vehiculos,
  conductores,
  autoservicio = false,
  rutaProgramadaIdInicial,
}: {
  vehiculos: Vehiculo[];
  conductores: Conductor[];
  autoservicio?: boolean;
  /** Llegó por ?rutaProgramadaId=... desde el botón "Comenzar ruta" del inicio — se
   * aplica sola en cuanto se cargan las rutas programadas del conductor. */
  rutaProgramadaIdInicial?: string;
}) {
  const router = useRouter();
  const conductorFijo = autoservicio ? conductores[0] : undefined;
  const { draft, guardar, borradorDisponible, retomarBorrador, descartarBorrador, limpiarTrasGuardar } = useActaDraft<Draft>(
    "vehiculo-acta-entrega",
    draftInicial(vehiculos, conductorFijo)
  );
  const [fotos, setFotos] = useState<Record<string, Blob | null>>({});
  const [procesandoCount, setProcesandoCount] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [firmaConductorVacia, setFirmaConductorVacia] = useState(true);
  const [firmaRepVacia, setFirmaRepVacia] = useState(true);
  const firmaConductorRef = useRef<SignaturePadHandle>(null);
  const firmaRepRef = useRef<SignaturePadHandle>(null);
  const rutaInicialAplicadaRef = useRef(false);
  const [pedidosDisponibles, setPedidosDisponibles] = useState<PedidoPendiente[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [rutasProgramadas, setRutasProgramadas] = useState<RutaProgramada[]>([]);

  useEffect(() => {
    // Por si quedó un borrador viejo de antes de que existiera el autoservicio, sin
    // conductorId — se corrige solo en vez de dejar el formulario atascado.
    if (conductorFijo && draft.conductorId !== conductorFijo.id) {
      guardar({ ...draft, conductorId: conductorFijo.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conductorFijo?.id]);

  useEffect(() => {
    if (draft.tipoUso !== "RUTA_EMPRESA" || !draft.fechaRuta) return;
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCargandoPedidos(true);
    listarPedidosPendientesPorFecha(draft.fechaRuta)
      .then((pedidos) => {
        if (!cancelado) setPedidosDisponibles(pedidos);
      })
      .finally(() => {
        if (!cancelado) setCargandoPedidos(false);
      });
    return () => {
      cancelado = true;
    };
  }, [draft.tipoUso, draft.fechaRuta]);

  useEffect(() => {
    if (!draft.conductorId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRutasProgramadas([]);
      return;
    }
    let cancelado = false;
    listarProximasRutasDe(draft.conductorId).then((rutas) => {
      if (cancelado) return;
      setRutasProgramadas(rutas);
      // Vino del botón "Comenzar ruta" del inicio — se aplica una sola vez en cuanto
      // sabemos que esa ruta programada es real (y del conductor correcto).
      if (rutaProgramadaIdInicial && !rutaInicialAplicadaRef.current) {
        const ruta = rutas.find((r) => r.id === rutaProgramadaIdInicial);
        if (ruta) {
          rutaInicialAplicadaRef.current = true;
          aplicarRutaProgramada(ruta);
        }
      }
    });
    return () => {
      cancelado = true;
    };
    // aplicarRutaProgramada depende de `draft`, que cambia en cada tecla — no se
    // incluye para no re-disparar la carga de rutas en cada edición del formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.conductorId, rutaProgramadaIdInicial]);

  const fotosDraft: FotoDraft[] = useMemo(
    () => ANGULOS.map((a) => ({ angulo: a.value, blob: fotos[a.value] ?? null })),
    [fotos]
  );

  const faltas = useMemo(
    () =>
      validarActaEntrega(
        {
          ...draft,
          fotos: fotosDraft,
          firmaConductorVacia,
          firmaRepVacia,
        },
        { requiereFirmaRep: !autoservicio }
      ),
    [draft, fotosDraft, firmaConductorVacia, firmaRepVacia, autoservicio]
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    guardar({ ...draft, [key]: value });
  }

  function aplicarRutaProgramada(ruta: RutaProgramada) {
    guardar({
      ...draft,
      tipoUso: "RUTA_EMPRESA",
      rutaProgramadaId: ruta.id,
      fechaRuta: new Date(ruta.fecha).toISOString().slice(0, 10),
      destino: !draft.destino && ruta.notas ? ruta.notas : draft.destino,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const faltasFinal = validarActaEntrega(
      {
        ...draft,
        fotos: fotosDraft,
        firmaConductorVacia: firmaConductorRef.current?.isEmpty() ?? true,
        firmaRepVacia: firmaRepRef.current?.isEmpty() ?? true,
      },
      { requiereFirmaRep: !autoservicio }
    );
    // (chequeo final vía ref, fuera de render — está bien aquí, es un event handler)
    if (faltasFinal.length > 0) {
      setErrorMsg("Falta completar: " + faltasFinal.join("; "));
      return;
    }

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.set("vehiculoId", draft.vehiculoId);
      formData.set("conductorId", draft.conductorId);
      formData.set("tipoUso", draft.tipoUso);
      formData.set("zona", draft.zona);
      formData.set("destino", draft.destino);
      formData.set("checkoutKm", draft.checkoutKm);
      formData.set("checkoutCombustible", draft.checkoutCombustible);
      formData.set("observacionesEntrega", draft.observacionesEntrega);
      formData.set("evaluacionesJson", JSON.stringify(draft.evaluaciones));
      formData.set("equipamientoJson", JSON.stringify(draft.equipamiento));
      formData.set("pedidoIdsJson", JSON.stringify(draft.pedidoIds));
      formData.set("rutaProgramadaId", draft.rutaProgramadaId);
      for (const a of ANGULOS) {
        const blob = fotos[a.value];
        if (blob) formData.set(`foto__${a.value}`, blob, `${a.value}.jpg`);
      }
      formData.set("firmaConductor", await firmaConductorRef.current!.toBlob(), "firma-conductor.png");
      if (!(firmaRepRef.current?.isEmpty() ?? true)) {
        formData.set("firmaRep", await firmaRepRef.current!.toBlob(), "firma-rep.png");
      }

      const result = await crearSalida(formData);
      limpiarTrasGuardar();
      router.push(`/vehiculo/${result.id}`);
    } catch (err) {
      setEnviando(false);
      setErrorMsg(err instanceof Error ? err.message : "No se pudo guardar el acta.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {borradorDisponible && (
        <div className="card flex items-center justify-between bg-dorado-50">
          <p className="text-sm text-tierra-700">Tienes un borrador sin terminar de una acta anterior.</p>
          <div className="flex gap-2">
            <button type="button" onClick={retomarBorrador} className="chip-edit">
              Retomar borrador
            </button>
            <button type="button" onClick={descartarBorrador} className="chip-danger">
              Descartar
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-verde-800">Datos generales</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Vehículo</label>
            <select value={draft.vehiculoId} onChange={(e) => set("vehiculoId", e.target.value)} className="input">
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>{v.placa}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Conductor</label>
            {autoservicio ? (
              <p className="input bg-verde-50/60 text-tierra-700">{conductores[0]?.name}</p>
            ) : (
              <select value={draft.conductorId} onChange={(e) => set("conductorId", e.target.value)} className="input">
                <option value="">Selecciona...</option>
                {conductores.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="label">Tipo de uso</label>
            <select value={draft.tipoUso} onChange={(e) => set("tipoUso", e.target.value)} className="input">
              <option value="">Selecciona...</option>
              {TIPO_USO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {draft.tipoUso === "RUTA_EMPRESA" && rutasProgramadas.length > 0 && (
            <div className="sm:col-span-2">
              <label className="label">Ruta programada que estás abriendo (opcional)</label>
              <select
                value={draft.rutaProgramadaId}
                onChange={(e) => {
                  const ruta = rutasProgramadas.find((r) => r.id === e.target.value);
                  if (ruta) aplicarRutaProgramada(ruta);
                  else set("rutaProgramadaId", "");
                }}
                className="input"
              >
                <option value="">Ninguna / no estaba programada</option>
                {rutasProgramadas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.fecha).toLocaleDateString("es-CO")}{r.notas ? ` — ${r.notas}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {draft.tipoUso === "RUTA_EMPRESA" && (
            <>
              <div>
                <label className="label">Zona principal (opcional)</label>
                <select value={draft.zona} onChange={(e) => set("zona", e.target.value)} className="input">
                  <option value="">Varias zonas / no aplica</option>
                  <option value="LOCAL">Local</option>
                  <option value="PEREIRA">Ruta Pereira</option>
                  <option value="MANIZALES">Ruta Manizales</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Ruta / paradas — una por línea, cada una queda como un ítem marcable</label>
                <textarea
                  value={draft.destino}
                  onChange={(e) => set("destino", e.target.value)}
                  rows={5}
                  className="input"
                  placeholder={
                    "Ej.:\nAlcalá: dejar concentrado de gallinas\nAlcalá: recoger huevos y un pollo (nevera de icopor)\nLocal: dejar huevos azules, lácteos y arepas\nLocal: recoger pedidos de ruta Pereira y Manizales\nEntregar en Pereira\nEntregar en Manizales"
                  }
                />
                <p className="mt-1 text-xs text-tierra-400">
                  Cada línea se convierte en un checklist que el conductor puede ir marcando.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Pedidos a incluir en esta ruta</label>
                <input
                  type="date"
                  value={draft.fechaRuta}
                  onChange={(e) => set("fechaRuta", e.target.value)}
                  className="input mb-2 w-44"
                />
                {cargandoPedidos ? (
                  <p className="text-xs text-tierra-400">Buscando pedidos pendientes...</p>
                ) : pedidosDisponibles.length === 0 ? (
                  <p className="text-xs text-tierra-400">No hay pedidos pendientes sin asignar para esa fecha.</p>
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-verde-100 bg-white p-2">
                    {pedidosDisponibles.map((p) => {
                      const seleccionado = draft.pedidoIds.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-start gap-2 rounded-lg px-1 py-1 text-xs hover:bg-verde-50/60">
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            onChange={() =>
                              set(
                                "pedidoIds",
                                seleccionado ? draft.pedidoIds.filter((id) => id !== p.id) : [...draft.pedidoIds, p.id]
                              )
                            }
                            className="mt-0.5 h-4 w-4"
                          />
                          <span>
                            <span className="font-medium text-tierra-800">{p.cliente}</span>{" "}
                            <span className="badge bg-tierra-100 text-tierra-600">{p.zona}</span>
                            <br />
                            <span className="text-tierra-500">{p.direccion}</span>
                            <br />
                            <span className="text-tierra-400">
                              {p.items.map((it) => `${it.cantidad ?? ""} ${it.producto.nombre}`).join(", ")}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1 text-xs text-tierra-400">
                  Los que marques quedan asignados a esta salida desde ya. Si llegan pedidos nuevos después,
                  el conductor igual los va a ver en su panel el día de la ruta.
                </p>
              </div>
            </>
          )}
          {draft.tipoUso === "ALQUILER" && (
            <div>
              <label className="label">Destino / para quién</label>
              <input value={draft.destino} onChange={(e) => set("destino", e.target.value)} className="input" />
            </div>
          )}
          <div>
            <label className="label">Kilometraje de salida</label>
            <input
              type="number"
              inputMode="numeric"
              value={draft.checkoutKm}
              onChange={(e) => set("checkoutKm", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Nivel de combustible</label>
            <select value={draft.checkoutCombustible} onChange={(e) => set("checkoutCombustible", e.target.value)} className="input">
              <option value="">Selecciona...</option>
              {COMBUSTIBLE_NIVELES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-verde-800">Fotos (las 7 son obligatorias)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {ANGULOS.map((a) => (
            <PhotoCaptureField
              key={a.value}
              label={a.label}
              value={fotos[a.value] ?? null}
              onChange={(blob) => setFotos((prev) => ({ ...prev, [a.value]: blob }))}
              onProcesandoChange={(p) => setProcesandoCount((c) => Math.max(0, c + (p ? 1 : -1)))}
            />
          ))}
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-verde-800">Evaluación del vehículo</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PUNTOS_EVALUACION.map((p) => {
            const ev = draft.evaluaciones.find((e) => e.punto === p.value)!;
            return (
              <EvaluacionPuntoField
                key={p.value}
                label={p.label}
                value={ev}
                onChange={(next) =>
                  set(
                    "evaluaciones",
                    draft.evaluaciones.map((e) => (e.punto === p.value ? next : e))
                  )
                }
              />
            );
          })}
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-verde-800">Documentos y dotación</h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {EQUIPAMIENTO_ITEMS.map((it) => {
            const eq = draft.equipamiento.find((e) => e.item === it.value)!;
            return (
              <EquipoChecklistField
                key={it.value}
                label={it.label}
                value={eq}
                onChange={(next) =>
                  set(
                    "equipamiento",
                    draft.equipamiento.map((e) => (e.item === it.value ? next : e))
                  )
                }
              />
            );
          })}
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-verde-800">Observaciones</h2>
        <textarea
          value={draft.observacionesEntrega}
          onChange={(e) => set("observacionesEntrega", e.target.value)}
          rows={2}
          className="input"
        />
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-verde-800">Firmas</h2>
        <SignaturePad ref={firmaConductorRef} label="Firma del conductor" onVaciaChange={setFirmaConductorVacia} />
        <SignaturePad
          ref={firmaRepRef}
          label={autoservicio ? "Firma de la persona de la empresa (opcional si estás solo)" : "Firma de la persona de la empresa"}
          onVaciaChange={setFirmaRepVacia}
        />
        {autoservicio && (
          <p className="text-xs text-tierra-400">
            Si no hay nadie de la empresa contigo para recibir el vehículo, deja esta firma en blanco.
          </p>
        )}
      </div>

      {errorMsg && (
        <div className="card bg-red-50 text-sm text-red-700">
          <p className="font-medium">No se pudo guardar:</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {faltas.length > 0 && !errorMsg && (
        <p className="text-xs text-tierra-500">Falta: {faltas.join(", ")}</p>
      )}

      <button
        type="submit"
        disabled={enviando || procesandoCount > 0 || faltas.length > 0}
        className="btn-primary w-full"
      >
        {enviando ? "Guardando..." : procesandoCount > 0 ? "Procesando fotos..." : "Guardar acta de entrega"}
      </button>
    </form>
  );
}
