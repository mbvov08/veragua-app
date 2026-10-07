"use client";

import { useMemo, useRef, useState } from "react";
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

type Vehiculo = { id: string; placa: string };
type Conductor = { id: string; name: string };

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
};

function draftInicial(vehiculos: Vehiculo[]): Draft {
  return {
    vehiculoId: vehiculos[0]?.id ?? "",
    conductorId: "",
    tipoUso: "",
    zona: "",
    destino: "",
    checkoutKm: "",
    checkoutCombustible: "",
    observacionesEntrega: "",
    evaluaciones: PUNTOS_EVALUACION.map((p) => ({ punto: p.value, estado: "", nota: "" })),
    equipamiento: EQUIPAMIENTO_ITEMS.map((it) => ({ item: it.value, presente: null })),
  };
}

export default function ActaEntregaForm({ vehiculos, conductores }: { vehiculos: Vehiculo[]; conductores: Conductor[] }) {
  const router = useRouter();
  const { draft, guardar, borradorDisponible, retomarBorrador, descartarBorrador, limpiarTrasGuardar } = useActaDraft<Draft>(
    "vehiculo-acta-entrega",
    draftInicial(vehiculos)
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
      validarActaEntrega({
        ...draft,
        fotos: fotosDraft,
        firmaConductorVacia,
        firmaRepVacia,
      }),
    [draft, fotosDraft, firmaConductorVacia, firmaRepVacia]
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    guardar({ ...draft, [key]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const faltasFinal = validarActaEntrega({
      ...draft,
      fotos: fotosDraft,
      firmaConductorVacia: firmaConductorRef.current?.isEmpty() ?? true,
      firmaRepVacia: firmaRepRef.current?.isEmpty() ?? true,
    });
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
      for (const a of ANGULOS) {
        const blob = fotos[a.value];
        if (blob) formData.set(`foto__${a.value}`, blob, `${a.value}.jpg`);
      }
      formData.set("firmaConductor", await firmaConductorRef.current!.toBlob(), "firma-conductor.png");
      formData.set("firmaRep", await firmaRepRef.current!.toBlob(), "firma-rep.png");

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
            <select value={draft.conductorId} onChange={(e) => set("conductorId", e.target.value)} className="input">
              <option value="">Selecciona...</option>
              {conductores.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
                <label className="label">Ruta / paradas (si toca varias zonas, descríbelas aquí)</label>
                <textarea
                  value={draft.destino}
                  onChange={(e) => set("destino", e.target.value)}
                  rows={2}
                  className="input"
                  placeholder="Ej. Manizales → Alcalá (dejar concentrado, recoger huevos y pollo) → Local (dejar huevos/lácteos/arepas, recoger pedidos Pereira y Manizales) → Pereira → Manizales"
                />
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
        <SignaturePad ref={firmaRepRef} label="Firma de la persona de la empresa" onVaciaChange={setFirmaRepVacia} />
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
