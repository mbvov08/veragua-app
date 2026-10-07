"use client";

import { ESTADO_EVALUACION, labelDe } from "@/lib/vehiculo/constants";
import type { EvaluacionDraft } from "@/lib/vehiculo/validacion";

export default function EvaluacionPuntoField({
  label,
  value,
  onChange,
  comparar,
}: {
  label: string;
  value: EvaluacionDraft;
  onChange: (next: EvaluacionDraft) => void;
  /** Estado del mismo punto en la entrega, para mostrarlo al lado en la devolución. */
  comparar?: string;
}) {
  const requiereNota = value.estado === "REGULAR" || value.estado === "MALO";

  return (
    <div className="rounded-lg border border-verde-100 bg-white p-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-tierra-700">{label}</p>
        {comparar && <span className="text-[10px] text-tierra-400">entrega: {labelDe(ESTADO_EVALUACION, comparar)}</span>}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {ESTADO_EVALUACION.map((e) => (
          <button
            key={e.value}
            type="button"
            onClick={() => onChange({ ...value, estado: e.value })}
            className={`rounded-lg border py-1 text-xs transition-colors ${
              value.estado === e.value
                ? e.value === "BUENO"
                  ? "border-verde-400 bg-verde-50 text-verde-800"
                  : e.value === "REGULAR"
                  ? "border-dorado-400 bg-dorado-50 text-tierra-800"
                  : "border-red-400 bg-red-50 text-red-700"
                : "border-verde-100 text-tierra-500"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>
      {requiereNota && (
        <input
          value={value.nota}
          onChange={(e) => onChange({ ...value, nota: e.target.value })}
          placeholder="Observación obligatoria"
          className="input mt-1 py-1 text-xs"
        />
      )}
    </div>
  );
}
