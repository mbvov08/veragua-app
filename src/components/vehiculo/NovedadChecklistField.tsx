"use client";

import type { NovedadDraft } from "@/lib/vehiculo/validacion";

export default function NovedadChecklistField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: NovedadDraft;
  onChange: (next: NovedadDraft) => void;
}) {
  return (
    <div className="rounded-lg border border-verde-100 bg-white p-2">
      <label className="flex items-center gap-2 text-xs font-medium text-tierra-700">
        <input
          type="checkbox"
          checked={value.marcado}
          onChange={(e) => onChange({ ...value, marcado: e.target.checked })}
          className="h-4 w-4"
        />
        {label}
      </label>
      {value.marcado && (
        <input
          value={value.detalle}
          onChange={(e) => onChange({ ...value, detalle: e.target.value })}
          placeholder="Detalle obligatorio"
          className="input mt-1 py-1 text-xs"
        />
      )}
    </div>
  );
}
