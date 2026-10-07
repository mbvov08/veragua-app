"use client";

import { useState } from "react";

const EMOJI: Record<string, string> = {
  Efectivo: "💵",
  Transferencia: "🏦",
  Tarjeta: "💳",
};

export default function MetodoPagoPicker({
  name = "metodoPago",
  metodos = ["Efectivo", "Transferencia", "Tarjeta"],
}: {
  name?: string;
  /** Lista de métodos a mostrar, en orden. Por defecto los 3 de siempre (ventas). */
  metodos?: string[];
}) {
  const [metodo, setMetodo] = useState(metodos[0]);

  return (
    <div className="sm:col-span-2">
      <label className="label">Método de pago</label>
      <input type="hidden" name={name} value={metodo} />
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${metodos.length}, minmax(0, 1fr))` }}>
        {metodos.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetodo(m)}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors ${
              metodo === m
                ? "border-verde-400 bg-verde-50 text-verde-800"
                : "border-verde-100 text-tierra-600 hover:bg-verde-50/60"
            }`}
          >
            <span className="text-lg">{EMOJI[m] ?? "💰"}</span>
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
