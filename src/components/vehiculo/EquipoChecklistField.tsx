"use client";

import type { EquipoDraft } from "@/lib/vehiculo/validacion";

export default function EquipoChecklistField({
  label,
  value,
  onChange,
  comparar,
}: {
  label: string;
  value: EquipoDraft;
  onChange: (next: EquipoDraft) => void;
  comparar?: boolean | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-verde-100 bg-white px-2 py-1.5">
      <span className="text-xs text-tierra-700">
        {label}
        {comparar !== undefined && comparar !== null && (
          <span className="ml-1 text-[10px] text-tierra-400">(entrega: {comparar ? "sí" : "no"})</span>
        )}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange({ ...value, presente: true })}
          className={`rounded-lg border px-2 py-0.5 text-xs ${value.presente === true ? "border-verde-400 bg-verde-50 text-verde-800" : "border-verde-100 text-tierra-500"}`}
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, presente: false })}
          className={`rounded-lg border px-2 py-0.5 text-xs ${value.presente === false ? "border-red-400 bg-red-50 text-red-700" : "border-verde-100 text-tierra-500"}`}
        >
          No
        </button>
      </div>
    </div>
  );
}
