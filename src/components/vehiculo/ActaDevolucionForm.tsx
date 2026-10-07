"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActaDraft } from "@/components/vehiculo/useActaDraft";
import PhotoCaptureField from "@/components/vehiculo/PhotoCaptureField";
import EvaluacionPuntoField from "@/components/vehiculo/EvaluacionPuntoField";
import EquipoChecklistField from "@/components/vehiculo/EquipoChecklistField";
import NovedadChecklistField from "@/components/vehiculo/NovedadChecklistField";
import SignaturePad, { type SignaturePadHandle } from "@/components/vehiculo/SignaturePad";
import {
  ANGULOS,
  PUNTOS_EVALUACION,
  EQUIPAMIENTO_ITEMS,
  NOVEDAD_TIPOS,
  COMBUSTIBLE_NIVELES,
} from "@/lib/vehiculo/constants";
import {
  validarActaDevolucion,
  type FotoDraft,
  type EvaluacionDraft,
  type EquipoDraft,
  type NovedadDraft,
} from "@/lib/vehiculo/validacion";
import { cerrarSalida } from "@/lib/actions/vehiculo";

type Draft = {
  checkinKm: string;
  checkinCombustible: string;
  observacionesDevolucion: string;
  evaluaciones: EvaluacionDraft[];
  equipamiento: EquipoDraft[];
  novedades: NovedadDraft[];
};

function draftInicial(): Draft {
  return {
    checkinKm: "",
    checkinCombustible: "",
    observacionesDevolucion: "",
    evaluaciones: PUNTOS_EVALUACION.map((p) => ({ punto: p.value, estado: "", nota: "" })),
    equipamiento: EQUIPAMIENTO_ITEMS.map((it) => ({ item: it.value, presente: null })),
    novedades: NOVEDAD_TIPOS.map((n) => ({ tipo: n.value, marcado: false, detalle: "" })),
  };
}

export default function ActaDevolucionForm({
  salidaId,
  checkoutKm,
  entregaFotos,
  entregaEvaluaciones,
  entregaEquipamiento,
}: {
  salidaId: string;
  checkoutKm: number;
  /** angulo -> id del VehiculoArchivo de la foto de entrega, para comparar lado a lado. */
  entregaFotos: Record<string, string>;
  entregaEvaluaciones: Record<string, string>;
  entregaEquipamiento: Record<string, boolean>;
}) {
  const router = useRouter();
  const { draft, guardar, borradorDisponible, retomarBorrador, descartarBorrador, limpiarTrasGuardar } = useActaDraft<Draft>(
    `vehiculo-acta-devolucion-${salidaId}`,
    draftInicial()
  );
  const [fotos, setFotos] = useState<Record<string, Blob | null>>({});
  const [procesandoCount, setProcesandoCount] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [firmaConductorVacia, setFirmaConductorVacia] = useState(true);
  const [firmaRepVacia, setFirmaRepVacia] = useState(true);
  const firmaConductorRef = useRef<SignaturePadHandle>(null);
  const firmaRepRef = useRef<SignaturePadHandle>(null);

  const fotosDraft: FotoDraft[] = useMemo(
    () => ANGULOS.map((a) => ({ angulo: a.value, blob: fotos[a.value] ?? null })),
    [fotos]
  );

  const faltas = useMemo(
    () =>
      validarActaDevolucion(
        { ...draft, fotos: fotosDraft, firmaConductorVacia, firmaRepVacia },
        checkoutKm
      ),
    [draft, fotosDraft, firmaConductorVacia, firmaRepVacia, checkoutKm]
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    guardar({ ...draft, [key]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const faltasFinal = validarActaDevolucion(
      {
        ...draft,
        fotos: fotosDraft,
        firmaConductorVacia: firmaConductorRef.current?.isEmpty() ?? true,
        firmaRepVacia: firmaRepRef.current?.isEmpty() ?? true,
      },
      checkoutKm
    );
    if (faltasFinal.length > 0) {
      setErrorMsg("Falta completar: " + faltasFinal.join("; "));
      return;
    }

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.set("checkinKm", draft.checkinKm);
      formData.set("checkinCombustible", draft.checkinCombustible);
      formData.set("observacionesDevolucion", draft.observacionesDevolucion);
      formData.set("evaluacionesJson", JSON.stringify(draft.evaluaciones));
      formData.set("equipamientoJson", JSON.stringify(draft.equipamiento));
      formData.set("novedadesJson", JSON.stringify(draft.novedades));
      for (const a of ANGULOS) {
        const blob = fotos[a.value];
        if (blob) formData.set(`foto__${a.value}`, blob, `${a.value}.jpg`);
      }
      formData.set("firmaConductor", await firmaConductorRef.current!.toBlob(), "firma-conductor.png");
      formData.set("firmaRep", await firmaRepRef.current!.toBlob(), "firma-rep.png");

      await cerrarSalida(salidaId, formData);
      limpiarTrasGuardar();
      router.push(`/vehiculo/${salidaId}`);
    } catch (err) {
      setEnviando(false);
      setErrorMsg(err instanceof Error ? err.message : "No se pudo cerrar el acta.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {borradorDisponible && (
        <div className="card flex items-center justify-between bg-dorado-50">
          <p className="text-sm text-tierra-700">Tienes un borrador sin terminar de esta devolución.</p>
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
        <h2 className="text-sm font-semibold text-verde-800">Datos de la devolución</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Kilometraje de devolución (entrega: {checkoutKm.toLocaleString("es-CO")})</label>
            <input
              type="number"
              inputMode="numeric"
              value={draft.checkinKm}
              onChange={(e) => set("checkinKm", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Nivel de combustible</label>
            <select value={draft.checkinCombustible} onChange={(e) => set("checkinCombustible", e.target.value)} className="input">
              <option value="">Selecciona...</option>
              {COMBUSTIBLE_NIVELES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-verde-800">Fotos (comparadas con la entrega)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {ANGULOS.map((a) => (
            <PhotoCaptureField
              key={a.value}
              label={a.label}
              value={fotos[a.value] ?? null}
              onChange={(blob) => setFotos((prev) => ({ ...prev, [a.value]: blob }))}
              onProcesandoChange={(p) => setProcesandoCount((c) => Math.max(0, c + (p ? 1 : -1)))}
              compararUrl={entregaFotos[a.value] ? `/api/vehiculo/archivo/${entregaFotos[a.value]}` : undefined}
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
                comparar={entregaEvaluaciones[p.value]}
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
                comparar={entregaEquipamiento[it.value]}
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
        <h2 className="text-sm font-semibold text-verde-800">Novedades</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {NOVEDAD_TIPOS.map((n) => {
            const nov = draft.novedades.find((x) => x.tipo === n.value)!;
            return (
              <NovedadChecklistField
                key={n.value}
                label={n.label}
                value={nov}
                onChange={(next) =>
                  set(
                    "novedades",
                    draft.novedades.map((x) => (x.tipo === n.value ? next : x))
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
          value={draft.observacionesDevolucion}
          onChange={(e) => set("observacionesDevolucion", e.target.value)}
          rows={2}
          className="input"
        />
      </div>

      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-verde-800">Firmas</h2>
        <SignaturePad ref={firmaConductorRef} label="Firma del conductor" onVaciaChange={setFirmaConductorVacia} />
        <SignaturePad ref={firmaRepRef} label="Firma de la persona de la empresa" onVaciaChange={setFirmaRepVacia} />
      </div>

      {errorMsg && (
        <div className="card bg-red-50 text-sm text-red-700">
          <p className="font-medium">No se pudo guardar:</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {faltas.length > 0 && !errorMsg && <p className="text-xs text-tierra-500">Falta: {faltas.join(", ")}</p>}

      <button
        type="submit"
        disabled={enviando || procesandoCount > 0 || faltas.length > 0}
        className="btn-primary w-full"
      >
        {enviando ? "Guardando..." : procesandoCount > 0 ? "Procesando fotos..." : "Cerrar acta de devolución"}
      </button>
    </form>
  );
}
